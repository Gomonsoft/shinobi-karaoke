# 0008 — Seguridad de Electron: origen del renderer, protocolos propios y política de navegación

- Estado: Aceptado
- Fecha: 2026-11-04
- Paso del pipeline: 0 (transversal)

## Contexto
La revisión de cierre de la Fase 1 encontró que la base de seguridad del renderer está bien planteada (`sandbox`, `contextIsolation`, sin `nodeIntegration`, CSP sin `unsafe-eval`, IPC validada con Zod, preload que no expone `ipcRenderer`), pero que varias decisiones se tomaron en las tareas sin ADR:

1. **Origen del renderer**: en producción se carga con `loadFile` (origen `file://`). Para que el renderer pudiera hacer `fetch` a `shinobi-media://` (necesario para decodificar audio con Web Audio), la tarea 0012 registró el esquema con `corsEnabled: true` y respondió con `Access-Control-Allow-Origin: *`, y amplió la CSP con `connect-src 'self' shinobi-media:`.
2. **Navegación externa**: `setWindowOpenHandler` y `will-navigate` abren en el navegador del sistema **cualquier** URL `http(s)`, mientras que el canal IPC `sistema.abrirEnlace` sí aplica una lista blanca (0011). Las dos vías deberían tener la misma política.
3. **Permisos de Chromium**: no hay `setPermissionRequestHandler`/`setPermissionCheckHandler`; por defecto Electron concede los permisos que pida la página (notificaciones, micrófono, geolocalización…).
4. **Varias instancias**: no se pide `requestSingleInstanceLock`; dos instancias abiertas a la vez romperían la regla "el servicio de biblioteca es el único escritor de `cancion.json`" (ADR 0006).
5. **Comprobación del remitente IPC**: se comprueba que `event.sender` sea una ventana de la app, pero no el *frame* ni su URL.

### Análisis del protocolo de medios
- **¿Puede otra web leer los medios?** No desde un navegador: `shinobi-media:` solo existe dentro de la sesión de Electron de la app. Dentro de la app, solo pueden pedirlo los documentos cargados en sus `webContents`; como la navegación a otros orígenes está bloqueada, no se permiten `<webview>` y la CSP limita `frame-src` (vía `default-src 'self'`), hoy el único origen real es el propio renderer. El contenido servible está limitado a 4 archivos por canción (lista blanca, `realpath`, id validado) y todo fallo devuelve 404 sin detalle. **Riesgo actual: bajo.**
- **Por qué no basta `*`**: la cabecera comodín convierte el protocolo en legible por *cualquier* origen que algún día llegue a cargarse en la sesión (p. ej. un error futuro de navegación, una vista web de ayuda, o una página remota abierta por descuido en una ventana de la app). Es defensa en profundidad barata restringirla.
- **El problema de fondo es `file://`**: la guía de seguridad de Electron recomienda no servir la app desde `file://` (el origen es opaco y, mientras no se desactive el *fuse* `GrantFileProtocolExtraPrivileges`, una página `file://` tiene privilegios extra sobre otros `file://`). Con un esquema propio para el renderer el origen es concreto y estable, y se puede usar en `Access-Control-Allow-Origin`.

## Alternativas consideradas
| Opción | Licencia | Pros | Contras |
|--------|----------|------|---------|
| A. Mantener `file://` + `Access-Control-Allow-Origin: *` (estado actual) | — | Ya funciona; cero trabajo | Origen opaco; comodín legible por cualquier origen de la sesión; contra la recomendación de Electron |
| B. Mantener `file://` y responder con el origen exacto (`Origin: null`/`file://`) | — | Cambio mínimo | Un origen opaco no identifica a nadie (cualquier `file://` o `data:`/sandbox da el mismo valor); no aporta seguridad real |
| C. **Servir el renderer desde un esquema propio privilegiado (`shinobi-app://app/`) y responder en medios solo al origen del renderer** | — | Origen concreto en dev (`http://localhost:<puerto>`) y producción (`shinobi-app://app`); CORS exacto; sigue la guía de Electron; permite desactivar el *fuse* de `file://` al empaquetar | Un manejador más (`protocol.handle` que sirva `out/renderer/` con confinamiento de rutas); hay que revisar rutas relativas del build de Vite |
| D. No usar `fetch`: pasar el audio por IPC como `ArrayBuffer` | — | Sin CORS | 40–90 MB por pista copiados por IPC; peor memoria y latencia; pierde `Range`/streaming para `<audio>` |

## Decisión
**Opción C**, más una política común de navegación y permisos:

1. **Renderer en esquema propio** `shinobi-app` (privilegios `standard`, `secure`, `supportFetchAPI`; sin `corsEnabled`), servido con `protocol.handle` desde la carpeta del build del renderer con las mismas garantías que `shinobi-media` (solo GET, `realpath` dentro de la carpeta, 404 sin detalle). En desarrollo sigue usándose el servidor de Vite (`ELECTRON_RENDERER_URL`), solo si `!app.isPackaged`.
2. **`shinobi-media` con CORS exacto**: `Access-Control-Allow-Origin` = origen del renderer vigente (`shinobi-app://app` en producción; el origen de `ELECTRON_RENDERER_URL` en desarrollo), con `Vary: Origin`. Peticiones con otro `Origin` → 404 sin cabeceras CORS. Peticiones sin `Origin` (p. ej. `<audio src>` o `<img src>` sin `crossorigin`) se siguen sirviendo: no permiten leer bytes desde otro origen. Se conserva `corsEnabled: true` en el esquema de medios. *Corrección (pregunta 0011)*: en Electron 45 `protocol.handle` no recibe `Origin`/`Referer` y Chromium no bloquea por CORS las respuestas de este esquema, así que el origen de la petición se toma de `Origin` si llega y, si no, de `request.referrer`; el renderer declara `<meta name="referrer" content="origin">`. Una página con `no-referrer` o `data:` se trata como "sin origen"; se acepta porque no hay forma de cargar documentos ajenos en la sesión (punto 10).
3. **CSP**: se mantiene la de 0002/0012 (`connect-src 'self' shinobi-media:`). Con el nuevo origen, `'self'` pasa a ser `shinobi-app://app`.
4. **Navegación y ventanas**: `will-navigate`, `will-redirect` y `setWindowOpenHandler` niegan siempre; solo llaman a `shell.openExternal` si la URL pasa `enlacePermitido` (la misma lista blanca de `shared/ipc.ts`). Se aplica a **todos** los `webContents` desde `app.on('web-contents-created')`, que además impide `<webview>` (`will-attach-webview` → `preventDefault`).
5. **Permisos**: `session.defaultSession.setPermissionRequestHandler` y `setPermissionCheckHandler` deniegan todo salvo `fullscreen` (reproductor) y `clipboard-sanitized-write` ("Copiar detalles"), y solo si la petición viene del origen del renderer.
6. **Una sola instancia**: `app.requestSingleInstanceLock()`; si falla, la segunda instancia sale y la primera muestra y enfoca su ventana (`second-instance`).
7. **Remitente IPC**: además de la ventana, `event.senderFrame` debe ser el *frame* principal y su origen el del renderer.
8. **Lista blanca de enlaces externos** (0011): se acepta tal cual: `https:` sin credenciales ni puerto, a `lrclib.net` (cualquier ruta) y `github.com/Gomonsoft/shinobi-karaoke[/...]` (web del proyecto e incidencias, `ux/01` y `ux/08`). Ampliarla exige editar `ENLACES_PERMITIDOS` y anotarlo en este ADR. *Ampliación (2026-11-04, `preguntas/0017`, tarea 0036)*: `support.apple.com` solo con la ruta `/es-es/108382` ("Actualizar macOS en el Mac", botón "Cómo actualizar macOS" de B6b).
9. **Al empaquetar** (tarea de empaquetado): *fuses* `RunAsNode`, `EnableNodeOptionsEnvironmentVariable`, `EnableNodeCliInspectArguments` y `GrantFileProtocolExtraPrivileges` desactivados; `EnableEmbeddedAsarIntegrityValidation` y `OnlyLoadAppFromAsar` activados.
10. **Aislamiento por sesión** (pregunta 0011): la sesión por defecto (la única con `shinobi-app` y `shinobi-media`) solo carga el renderer propio. Cualquier contenido remoto o no confiable que se muestre en el futuro dentro de la app va en una `session.fromPartition(...)` propia, sin esos protocolos, sin preload y con `sandbox`. Se descartan, por ahora, el token efímero en las URL de medios y la comprobación de `webContents` vía `webRequest`: no protegen frente al único vector alcanzable (código inyectado en el propio renderer, que es del mismo origen) y añaden complejidad.

Se mantienen como están: `SHINOBI_DATOS` también en builds empaquetados (útil para E2E y soporte; un atacante que controla el entorno ya controla la cuenta) y `style-src 'unsafe-inline'` (Vite/React y las `@font-face` generadas; no hay HTML de terceros en el renderer). **Regla para fases futuras**: el renderer nunca inserta HTML sin escapar (`dangerouslySetInnerHTML`); `THIRD_PARTY_NOTICES.md` y la GPL (`ux/08`) se muestran como texto o con un renderizador de Markdown que no admita HTML en bruto.

## Consecuencias
- Positivas: origen del renderer concreto y estable; medios legibles solo por la app; una única política de enlaces externos; sin permisos de Chromium concedidos por defecto; se garantiza el "único escritor" también entre instancias.
- Negativas / riesgos: un manejador de protocolo más que mantener y probar; los E2E y el build deben verificar que Vite genera rutas compatibles con `shinobi-app://app/` (base relativa o absoluta `/`).
- Impacto en UX: ninguno visible. Abrir la app dos veces enfoca la ventana existente.

## Revisiones
- 2026-11-04: creado en la revisión de cierre de la Fase 1 (tareas 0021 y 0022).
- 2026-11-04: pregunta 0011 — el origen de medios se detecta por `Origin` o `request.referrer` (punto 2); nuevo punto 10 (aislamiento por sesión para contenido no confiable). Sin tarea nueva.
- 2026-11-06 (ADR 0011, tarea 0113): el reproductor pone la **ventana** a pantalla completa desde el main (`BrowserWindow.setFullScreen`) y no usa la API Fullscreen del DOM. Se retira `fullscreen` de los permisos concedidos del punto 5: solo queda `clipboard-sanitized-write`. Los canales nuevos `ventana.*` y `biblioteca.comprobarPistas` siguen las reglas del punto 4 (Zod y remitente).
- 2026-11-06 (ADR 0012 y 0013, Fase 7):
  - Los *fuses* del punto 9 se aplican con `electronFuses` y sin cambiar sus valores; `WasmTrapHandlers` queda activo por defecto.
  - La integridad del asar solo existe en macOS y Windows.
  - Límite aceptado: el AppImage en sistemas con la restricción de AppArmor arranca con `--no-sandbox`, sin el sandbox de Chromium del SO. El `.deb` lo conserva con un perfil propio.
  - `--remote-debugging-port` sigue disponible en producción, como en cualquier app Electron: ningún *fuse* lo controla. Dentro del límite de confianza de `SHINOBI_DATOS`.

## Fuentes
- Electron — Security checklist (contexto aislado, sandbox, permisos, navegación, `file://` frente a protocolos propios, validar el remitente de IPC): https://www.electronjs.org/docs/latest/tutorial/security
- Electron — `protocol.registerSchemesAsPrivileged` y `protocol.handle`: https://www.electronjs.org/docs/latest/api/protocol
- Electron — Fuses: https://www.electronjs.org/docs/latest/tutorial/fuses
- Electron — `app.requestSingleInstanceLock`: https://www.electronjs.org/docs/latest/api/app#apprequestsingleinstancelockadditionaldata
- MDN — CORS y `Vary: Origin`: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS

## Revisión para 0.2.0 · Lectura de picos

El IPC de picos valida canción y ventana de lectura en main. El renderer recibe estado y porciones binarias acotadas. Se mantiene confinamiento de archivos y validación de remitente, sin exponer rutas ni ampliar el protocolo de medios. Ver [ADR 0015](0015-linea-de-tiempo-y-picos-de-voz.md).

## Revisión para 0.2.0 · fase 3

Canales de temas y apariencia ([ADR 0016](0016-catalogo-de-temas-e-identidad-de-artista-y-album.md) §11). Fecha: 2026-11-09.

- **Canales nuevos**: `temas.catalogo`, `temas.previsualizar`, `temas.ejecutar`, `temas.crear`, `temas.renombrar`, `temas.duplicar`, `temas.reanudarBorrado`, `temas.cancelarBorrado`, `temas.descartarAvisoApartado` y `biblioteca.guardarApariencia`, que sustituye a `biblioteca.guardarEstilo`. Eventos `temas:cambiado` y `temas:progreso`.
- **Mismas reglas del punto 4**: argumentos en tupla validados con Zod en main, remitente comprobado (ventana, *frame* principal y origen del renderer) y respuestas `{ ok, valor | error }` sin rutas ni detalles internos.
- **Límites**:
  - UUID para temas y fichas;
  - nombres de 1 a 60 caracteres normalizados en main;
  - de 1 a 2000 ids únicos en lote;
  - artista y álbum de 1 a 200 caracteres;
  - `estiloSchema` completo.
- **Fichas de confirmación**: son opacas, de un solo uso y caducan. Main las guarda en memoria y recalcula el impacto antes de escribir. No autorizan nada por sí solas: main revalida tema, canciones y estado del catálogo.
- **Fase 4**: con roles de ventana, `temas.*` y `guardarApariencia` solo se aceptan desde la ventana principal.

## Revisión para 0.2.0 — fase 4

Ventana secundaria, sesión en vivo y cola. Fecha: 2026-11-11. El detalle está en el [ADR 0017](0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md), §1, §2 y §11.

- **Roles de ventana.** Hay dos roles fijos, `principal` y `secundaria`. Main los asigna al crear cada ventana y los guarda por identidad de `webContents` en `RegistroVentanas`. Nunca los toma de la URL ni de un argumento del renderer.
- **Punto 7 ampliado.** `remitenteIpcValido(evento, canal)` pasa a comprobar:
  1. que el `webContents` esté registrado;
  2. que su rol tenga permitido el canal según `ROLES_POR_CANAL`, una tabla en `shared/canales.ts` que cubre **todos** los canales y que un test mantiene completa;
  3. que el *frame* sea el principal;
  4. el origen del renderer;
  5. la ruta del documento del rol: `/index.html` (o `/` en desarrollo) para la principal y `/reproductor.html` para la secundaria.

  Los canales de la secundaria exigen además que el `webContents` sea el de la sesión vigente. El fallo devuelve el mismo error genérico de hoy y no revela el motivo.
- **Superficie mínima de la secundaria.** Usa una entrada HTML propia (`reproductor.html`, misma CSP) y un preload propio (`preload/secundaria.ts`). Ese preload expone `window.shinobiReproductor` con unos pocos canales (`sesion.inicial`, `sesion.informar`, cierre, preferencias de `reproductor` y pantalla completa de su propia ventana), y no expone `window.shinobi`. Las demás medidas:
  - `will-navigate` se bloquea siempre, además de la política común del punto 4;
  - `setMenu(null)` en Windows y Linux;
  - zoom fijo en 1;
  - `backgroundThrottling: false`;
  - `autoplayPolicy` explícito (`no-user-gesture-required`, que ya es el valor por defecto).
- **Eventos dirigidos.** `difundir` pasa a `enviarA(rol, …)`. La secundaria solo recibe sus comandos de sesión, su estado de pantalla completa y sus preferencias de reproducción. No recibe la biblioteca, ni los trabajos, ni el catálogo.
- **Medios.** No cambia nada. La secundaria comparte el origen `shinobi-app://app`, así que el CORS exacto del punto 2 la cubre. Recibe datos de la canción sin rutas y construye las URL `shinobi-media://` como el reproductor actual. Se mantiene descartado el token por URL del punto 10.
- **Permisos.** No cambian. La ventana se pone a pantalla completa y se coloca desde main, así que no se concede `window-management` ni `fullscreen`.
- **Silencio de la principal.** Durante una sesión, main silencia la principal con `webContents.setAudioMuted(true)` como garantía de un único audio.
- **Dobles de prueba.** `SHINOBI_PANTALLAS_SIMULADAS` y su puerto de pruebas en main solo existen sin empaquetar, como los demás `SHINOBI_*`.
- **Nota sobre la fase 3.** La restricción «con roles de ventana, `temas.*` y `guardarApariencia` solo desde la principal» queda aplicada por `ROLES_POR_CANAL`.
