# 0011 — API IPC tipada y preload
- Estado: Hecha
- Paso del pipeline: 0
- Depende de: 0008, 0010
- ADRs: 0001, 0006, 0007
- Spec UX: —

## Objetivo
Exponer al renderer, mediante `contextBridge`, una API mínima, tipada y validada para biblioteca, configuración y sistema, con eventos de cambio.

## Criterios de aceptación
- [x] Contrato único en `src/shared/ipc.ts`: nombre de cada canal, esquema Zod de argumentos y de respuesta. Preload y main lo importan; no hay cadenas de canal sueltas.
- [x] `window.shinobi` expone: `biblioteca.listar()`, `obtener(id)`, `actualizarMetadatos(id, {titulo, artista, album})`, `volverABorrador(id)`, `eliminar(id)`, `mostrarEnCarpeta(id)`; `config.obtener()`, `config.actualizar(parcial)` (solo campos permitidos al renderer: `reproductor`, `separacion.modo`, `estilo_predeterminado`, `aviso_youtube_aceptado`); `sistema.info()` (versión, SO, plataforma); `sistema.abrirEnlace(url)` (solo `https:` a una lista blanca: web del proyecto, lrclib.net); y suscripciones `alCambiarCancion(cb)` y `alCambiarConfig(cb)` que devuelven una función para desuscribirse.
- [x] Main valida **todos** los argumentos con Zod; argumentos inválidos → error tipado, nunca excepción sin controlar. Los errores llegan al renderer como `{ codigo, mensaje }`.
- [x] El renderer no tiene acceso a `ipcRenderer` ni a Node; solo a `window.shinobi` (tipado en `src/renderer/src/env.d.ts`).
- [x] Tests unitarios de los handlers (con servicios simulados) y una prueba E2E: `biblioteca.listar()` devuelve las canciones de la semilla.

## Notas de implementación
- **Qué se hizo**: contrato único en `app/src/shared/ipc.ts` (esquemas Zod de argumentos y respuesta por canal en `CONTRATO`, tipo `ApiShinobi`, lista blanca de enlaces) y nombres de canal en `app/src/shared/canales.ts` (sin dependencias, para que el preload con sandbox no empaquete Zod; `ipc.ts` los reexporta). Manejadores en `app/src/main/ipc/handlers.ts` (`crearManejadores`, `registrarIpc`, con servicios inyectables), cableados en `main/index.ts`. Preload en `app/src/preload/index.ts` (`contextBridge`, sin exponer `ipcRenderer` ni el `event`). Tipado del renderer en `app/src/renderer/src/env.d.ts`.
- **Decisiones**: main responde `{ ok, valor } | { ok: false, error: { codigo, mensaje } }` y el preload rechaza la promesa con `{ codigo, mensaje }`. Argumentos inválidos (tipos, campos sobrantes, `config.actualizar` con campos no permitidos, enlaces fuera de lista) -> `ARGUMENTOS_NO_VALIDOS`; errores desconocidos -> `ERROR_INTERNO` genérico (el detalle va al registro, nunca al renderer). `ResumenCancion.miniatura` (ruta absoluta) se convierte en `shinobi-media://<id>/fuente/miniatura.jpg` (o `null` si no hay miniatura o el id no es servible), también en los eventos. `actualizarMetadatos` solo acepta `{titulo (no vacío), artista, album}` y pasa solo `metadatos` al servicio. Cada manejador comprueba que el remitente sea una ventana de la app. Lista blanca de enlaces: `https:` sin credenciales ni puerto a `lrclib.net` y a `github.com/Gomonsoft/shinobi-karaoke[/...]` (URL del proyecto tomada de la insignia del README; ajustar en `ENLACES_PERMITIDOS` si la web es otra). `sistema.info` -> `{ version, so, plataforma }`. `obtener(id)` devuelve la `Cancion` completa (rutas relativas) o `null`.
- **Cómo probarlo** (desde `app/`): `npx vitest run --project node src/main/ipc` (20 tests con servicios simulados), `npm run build && npx playwright test e2e/ipc.spec.ts` (E2E: `listar()` devuelve las canciones de la semilla con miniaturas como URLs, error tipado, enlace rechazado, y `ipcRenderer`/`require`/`process` no existen en el renderer), `npx tsc --noEmit -p tsconfig.node.json` y `-p tsconfig.web.json`, `npx eslint .`.
- **Deuda técnica**: los eventos no tienen test E2E (solo unitario con difusión simulada); aún no hay canales para importar/trabajos (tareas posteriores); el renderer no consume todavía `window.shinobi` (vistas de Fase 1).
