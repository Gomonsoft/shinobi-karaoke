# 0011 — `protocol.handle` no expone `Origin` y Chromium no aplica CORS a `shinobi-media`
- De: programador
- Para: arquitecto
- Estado: Respondida
- Bloquea: no

## Contexto
Al implementar la tarea 0022 (ADR 0008, punto 2) se comprobó en Electron 45.2 que, en el manejador de `protocol.handle`, `request.headers` no incluye `Origin` ni `Referer` (solo `accept`, `user-agent`, `range`) y que Chromium **no bloquea** el `fetch` desde una página de otro origen aunque `Access-Control-Allow-Origin` sea otro (la respuesta llega como `basic`). Es decir, la cabecera CORS por sí sola no protege.

## Pregunta
¿Se acepta la mitigación adoptada o se prefiere otra?
- Adoptado (conservador): se usa `Origin` si llega y, si no, el origen de `request.referrer` (la propiedad sí se rellena para páginas `http(s)`; para el renderer se añadió `<meta name="referrer" content="origin">`). Si el origen no es el del renderer: 404 sin cabeceras CORS (E2E con una página `http://127.0.0.1:<puerto>`). Sin origen detectable se sigue sirviendo (`<audio src>`, o una página con `no-referrer`/`data:`), como pide el ADR.
- Limitación: una página ajena con `Referrer-Policy: no-referrer` o un documento `data:` no se distingue del renderer. Hoy no hay forma de cargarlas en la sesión (navegación bloqueada, sin webview), pero la defensa no es completa. Alternativas: sesión/partición dedicada solo para el renderer, o token efímero en la URL de medios.

## Respuesta
**Se acepta la mitigación adoptada tal como está. No se añade token ni partición propia ahora; no hace falta tarea nueva.** Decisión recogida en ADR 0008 (punto 2 corregido y punto 10 nuevo).

### Riesgo real tras 0021 y 0022
¿Qué documento de otro origen puede ejecutarse hoy en la sesión por defecto (la única que tiene `shinobi-media`)?
- **Navegación de la ventana / ventanas nuevas / frames**: `will-navigate`, `will-redirect`, `will-frame-navigate` y `setWindowOpenHandler` niegan siempre, para todos los `webContents` (`web-contents-created`). No.
- **`<webview>`**: `will-attach-webview` → `preventDefault` (y `webviewTag` desactivado por defecto). No.
- **`<iframe>` de otro origen, `data:` o `blob:` ajeno**: la CSP del renderer (`default-src 'self'`, sin `frame-src` propio) los bloquea. No.
- **Otra `BrowserWindow`**: solo la crea el proceso principal, y siempre con el renderer propio. No.
- **Código inyectado en el propio renderer (XSS)**: es el único vector plausible, y ahí ninguna medida de CORS, `Origin` ni token sirve: el atacante es *del mismo origen*, puede leer las URL (y cualquier token) del DOM y hasta llamar a la IPC. La defensa para ese caso es la regla del ADR 0008 (nunca HTML sin escapar, CSP sin `unsafe-eval`) y la validación Zod de la IPC, no el protocolo de medios.

Conclusión: el hueco descrito (página `no-referrer` o `data:` indistinguible) **no es alcanzable** con las barreras actuales; el filtro por `Origin`/`referrer` es defensa en profundidad para un fallo futuro de navegación, que es justo lo que pedía el ADR. **Riesgo: bajo.**

### Alternativas valoradas
| Opción | Por qué no (ahora) |
|---|---|
| Token efímero por sesión en la URL de medios | No protege del único vector real (XSS lee el token del DOM); añade estado, rompe URLs cacheables y complica tests. Coste > beneficio. |
| Comprobar `webContents`/frame vía `session.webRequest` | `webRequest` sobre esquemas de `protocol.handle` no está documentado como garantizado en todas las versiones y duplicaría la política en otro sitio; no aporta frente a XSS. |
| Partición dedicada solo para el renderer | Hoy el renderer es el único contenido de la sesión por defecto: equivale al estado actual. Se convierte en **regla** para el futuro (abajo). |

### Regla para fases futuras (la que de verdad cierra el hueco)
Los esquemas de `protocol.handle` solo existen en la sesión donde se registran (`protocol` = `session.defaultSession`). Por tanto: **cualquier contenido remoto o no confiable que algún día se muestre dentro de la app (ayuda web, vista previa de letras, OAuth, etc.) debe cargarse en una `session.fromPartition('...')` propia, sin `shinobi-media` ni `shinobi-app`, sin preload y con `sandbox`.** Nunca en la sesión por defecto. Quien proponga esa vista debe citar este punto en su tarea.

### Para el programador
- Mantener `<meta name="referrer" content="origin">` en `index.html` (si se quita, el `fetch` del renderer pasaría a "sin origen" y seguiría funcionando, pero se pierde la detección); un comentario en el HTML que remita a ADR 0008 basta, sin tarea propia: puede hacerse en la próxima tarea que toque el renderer.
- Si una versión futura de Electron expone `Origin` en `protocol.handle`, el código ya lo prefiere; no hace falta cambiar nada.
