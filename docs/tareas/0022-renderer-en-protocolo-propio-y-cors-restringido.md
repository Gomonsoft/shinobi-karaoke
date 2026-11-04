# 0022 — Renderer en el esquema `shinobi-app://` y CORS restringido en `shinobi-media://`
- Estado: Hecha
- Paso del pipeline: 0 (transversal; lo usarán editor y reproductor)
- Depende de: 0012, 0021
- ADRs: 0001, 0008
- Spec UX: —

## Objetivo
Dejar de cargar el renderer desde `file://` y limitar la lectura de medios al origen del renderer (ADR 0008, puntos 1–3), manteniendo el comportamiento de 0012.

## Criterios de aceptación
- [ ] Esquema `shinobi-app` registrado como privilegiado (`standard`, `secure`, `supportFetchAPI`) antes de `app.ready`, manejado con `protocol.handle`, que sirve `out/renderer/` (en empaquetado, la ruta dentro del asar): solo GET/HEAD, ruta resuelta y confinada a esa carpeta (`..`, codificaciones, symlinks → 404), `Content-Type` por extensión (html, js, css, woff2, svg, png, json) y `X-Content-Type-Options: nosniff`. La raíz `shinobi-app://app/` sirve `index.html`.
- [ ] Producción y E2E cargan `shinobi-app://app/index.html`; desarrollo sigue usando `ELECTRON_RENDERER_URL` solo si `!app.isPackaged`. El build de Vite genera rutas que funcionan con ese origen (comprobar `base`). Fuentes, imágenes y CSS cargan sin errores de CSP.
- [ ] Función pura `origenRenderer()` (desarrollo: origen de `ELECTRON_RENDERER_URL`; producción: `shinobi-app://app`) usada por medios, permisos y remitente IPC (0021).
- [ ] `shinobi-media`: `Access-Control-Allow-Origin` = `origenRenderer()` (nunca `*`) y `Vary: Origin`; una petición con `Origin` distinto → 404 sin cabeceras CORS; sin `Origin` → se sirve igual que ahora. También en 404/416.
- [ ] Tests unitarios: servidor de `shinobi-app` (archivo, raíz, traversal, symlink, tipo MIME) y CORS de medios (origen permitido, otro origen, sin origen). E2E existentes (`medios.spec.ts`, `ipc.spec.ts`, etc.) pasan con el nuevo origen; nuevo E2E: `fetch` a medios funciona desde el renderer y la URL de la ventana es `shinobi-app://app/…`.
- [ ] `docs/arquitectura.md` §8 ya refleja la decisión; si la implementación obliga a cambiar algo (p. ej. nombre del host), anotarlo en las notas.

## Notas de implementación
- Hecho: `app/src/main/appProtocolo.ts` (+ test): `shinobi-app://app/` sirve `out/renderer/` (en empaquetado `app.getAppPath()/out/renderer`, dentro del asar) con GET/HEAD, ruta sin decodificar (`%`, `\\`, `..` -> 404), `realpath` confinado (symlinks -> 404), MIME por extensión, `nosniff`; la raíz da `index.html`. `main/index.ts`: esquema privilegiado (`standard`, `secure`, `supportFetchAPI`), producción y E2E cargan `shinobi-app://app/index.html` (dev sigue con `ELECTRON_RENDERER_URL` si `!isPackaged`); `origenRenderer()` (origen de dev o `shinobi-app://app`) alimenta navegación, permisos, remitente IPC y medios. Vite: la base relativa por defecto de electron-vite funciona, sin cambios de config.
- `medios.ts`: `servirMedio(..., cors?)` responde `Access-Control-Allow-Origin` = origen del renderer + `Vary: Origin` (también 404/416); origen distinto -> 404 sin CORS; sin origen -> se sirve. `seguridad.ts`: `origenDe` ahora calcula el origen de esquemas propios (`protocolo//host`) y `origenDePeticion`.
- Desviación importante (ver pregunta `docs/preguntas/0011-...`): `protocol.handle` no expone `Origin`/`Referer` y Chromium no aplica CORS a ese esquema, así que se usa `request.referrer` (con `<meta name="referrer" content="origin">` en el renderer). Una página con `no-referrer`/`data:` no se distingue; no hay forma de cargarla hoy.
- E2E nuevo en `e2e/medios.spec.ts`: la URL de la ventana es `shinobi-app://app/...`, el `fetch` a medios funciona con ACAO exacto y una página `http://127.0.0.1:<puerto>` recibe 404.
- Probar (desde `app/`): `npm run lint && npm run typecheck && npm run format:check && npm test && npm run test:e2e`.
- Deuda: sin test unitario del handler de `index.ts`; el fuse `GrantFileProtocolExtraPrivileges` queda para la tarea de empaquetado (0025).
