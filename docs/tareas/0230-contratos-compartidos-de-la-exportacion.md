# 0230 — Contratos compartidos de la exportación

- Estado: Hecha
- Paso del pipeline: 6
- Depende de: fase 4 integrada; [0200](0200-esquema-del-estilo-ampliado-y-normalizacion.md) y [0201](0201-contratos-de-cancion-apariencia-config-e-ipc-de-la-fase-5.md) de la fase 5 (estilo ampliado y `cancion.modalidad`, [ADR 0018](../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md) §1 y §5)
- ADRs: [0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md) §5, §6, §10 y §11, [0008](../adr/0008-seguridad-de-electron-y-protocolos-propios.md#revisión-para-020--fase-6), [0006](../adr/0006-persistencia-y-modelo-de-datos.md#revisión-para-020--fase-6)
- Spec UX: [10 · Exportar a video](../ux/10-exportacion.md) (catálogo, nombre propuesto, códigos de error)

## Objetivo

Publicar los tipos, esquemas, canales y funciones puras de la exportación para que main, worker y renderer avancen en paralelo. **Única tarea de la fase que toca `shared/` y `preload/`.**

## Contrato

- **`shared/exportacion.ts`** (puro, sin dependencias de Electron):
  - `FORMATOS` (`mkv_av1`, `webm_vp9`: contenedor, extensión, nombres para la interfaz, por defecto `mkv_av1`) y `RESOLUCIONES` por proporción (16:9: 1280 × 720, 1920 × 1080, 2560 × 1440, 3840 × 2160; 4:3: 640 × 480, 1024 × 768, 1600 × 1200, 2880 × 2160), `FPS = [24, 30, 60]`.
  - `PARAMETROS_CODIFICACION` (preset/CRF por formato y resolución) y `MEMORIA_MINIMA` por resolución, con los valores del ADR 0019 §5.
  - `combinaciones()` (48), `esCombinacionValida`.
  - `estimarBytes(...)` y `estimarSegundos(...)` con las tablas del ADR 0019 §2 de la prueba (fondo fijo o móvil) y el `factor_corrector`.
  - `nombrePropuesto(titulo, artista, extension)` según `exp.nombre` (sustituir `/ \ : * ? " < > |` y controles por «-», recortar espacios y puntos finales, 120 caracteres).
  - `perfilCompatibleConSesion(perfil, plataforma)` con la tabla vacía de bloqueos (ADR 0019 §9).
  - `totalFotogramas(duracionMs, fps)` = `ceil(duracionMs × fps / 1000)` y `tiempoDeFotograma(n, fps)`.
  - Tipos `InstantaneaExportacion` (letra, estilo resuelto, modalidad, título, artista, duración, `gananciaDb`, voz disponible), `ExportacionIpc`, `PerfilIpc`, `DestinoIpc`, `ProgresoExportacionIpc`.
- **IPC**: `destinoPropuesto` admite `desdeDestinoId?: uuid` ([0124](../preguntas/0124-destino-conservado-al-cambiar-de-formato.md)). Esquemas Zod en `shared/ipc.ts` y nombres en `shared/canales.ts` de los canales de §10 y los eventos `exportacion:cambio`, `exportacion:progreso` (principal) y `exportacion:fotograma` (exportación). Rol `exportacion` en `ROLES_POR_CANAL`, con el test de cobertura.
- **Errores** en `shared/errores.ts`: `SIN_ESPACIO` (si no existe), `DESTINO_NO_DISPONIBLE`, `DESTINO_OCUPADO`, `PERFIL_NO_SOPORTADO`, `SIN_CODIFICADOR`, `LIMPIEZA_FALLIDA`, `ENTRADA_INCOMPLETA`; reutiliza `CANCION_NO_DISPONIBLE`, `MEMORIA_INSUFICIENTE`, `RUNTIME_NO_DISPONIBLE`, `ERROR_INTERNO`.
- **Config** en `shared/config.ts`: `exportacion = { formato, audio, proporcion, ancho, alto, fps, carpeta, factor_corrector }`, lectura tolerante por campo. No entra en `configParcialRendererSchema` (lo escribe main).
- **Preload**: `window.shinobi.exportacion.*` en `preload/index.ts`; nuevo `preload/exportacion.ts` con `window.shinobiExportacion` (`inicial`, `listo`, `alFotograma`). Dobles para el renderer (API falsa) y fixtures en `shared/__fixtures__/exportacion.ts`.

## Criterios de aceptación

- [x] `combinaciones()` da 48 combinaciones, todas con dimensiones pares y dentro de los techos de 0050.
- [x] `nombrePropuesto` cubre caracteres prohibidos, artista vacío, nombres largos y puntos finales.
- [x] Los esquemas rechazan resoluciones o FPS fuera del catálogo, rutas en `iniciar` y `n` negativo en `listo`.
- [x] `ROLES_POR_CANAL` cubre todos los canales y la ventana de exportación solo tiene `exportacion.inicial` y `exportacion.listo`.
- [x] Un `config.json` sin `exportacion` o con valores inválidos se lee con los valores por defecto.

## Pruebas de feedback

- Unitarias: `shared/exportacion.test.ts` (catálogo, estimaciones, nombre, fotogramas), tests de esquemas en `ipc.test.ts`, cobertura de `ROLES_POR_CANAL`, lectura tolerante de `config`.
- E2E: ninguna.
- Críticos: sí (toca `shared/` y `preload/`).
- Manual: nada.

## Notas de implementación

**Qué se hizo.** Contratos completos de la exportación en `shared/` y los dos preloads.

- `shared/exportacion.ts`: `FORMATOS`, `RESOLUCIONES`, `FPS`, `combinaciones()` (48), `esCombinacionValida`, `PARAMETROS_CODIFICACION` / `parametrosDe` (claves `preset` o `cpu_used` y `crf`, las que lee el worker), `MEMORIA_MINIMA` / `memoriaMinimaDe` (8 GiB en 2160 líneas), `estimarBytes`, `estimarSegundos` (+ `acotarFactorCorrector`), `nombrePropuesto`, `perfilCompatibleConSesion` (tabla `BLOQUEOS_CON_SESION` vacía), `totalFotogramas`, `tiempoDeFotograma` y los tipos IPC (`InstantaneaExportacion`, `ExportacionIpc`, `PerfilIpc`, `DestinoIpc`, `ProgresoExportacionIpc`, `InicialExportacionIpc`...).
- `shared/ipc.ts`: esquemas Zod y entradas de `CONTRATO` de los 10 canales; `destinoPropuesto` con `desdeDestinoId?`; `iniciar` y `estimar` validan el catálogo (`strictObject` + `refine`, sin rutas); `ApiShinobi.exportacion` y `ApiExportacion`. `canales.ts`: grupo `exportacion` (con `:`, como el resto), eventos `exportacionCambio`, `exportacionProgreso`, `exportacionFotograma`, rol `exportacion` (solo `inicial` y `listo`).
- `errores.ts`: `DESTINO_OCUPADO`, `PERFIL_NO_SOPORTADO`, `LIMPIEZA_FALLIDA` (solo main). `protocolo.ts`: `detalle` opcional en `mensajeErrorSchema`. `config.ts`: `exportacion` con lectura tolerante por campo (la proporción se deduce de ancho × alto; resolución fuera del catálogo vuelve a 1920 × 1080); no entra en `configParcialRendererSchema`.
- Preload: `window.shinobi.exportacion` en `preload/index.ts` y `preload/exportacion.ts` (`window.shinobiExportacion`: `inicial`, `listo`, `alFotograma`).
- `shared/__fixtures__/exportacion.ts`: fixtures y `crearApiExportacionFalsa()` (llamadas registradas, emisores de `alCambiar` y `alProgreso`).

**Ajustes mínimos fuera de la propiedad de archivos** (para que compile y no se rompan los tests; sus dueños los reemplazan):
- `main/ipc/handlers.ts` (0237): los 10 canales nuevos se registran con un manejador que responde `ERROR_INTERNO` hasta que exista el servicio; `rolDe` se acota a `principal | secundaria`.
- `main/seguridad.ts` (0234): `RUTAS_POR_ROL.exportacion = ['/exportacion.html']`, exigido por el tipo `Record<RolVentana, ...>`.
- `main/sesion/servicio.ts`: `solicitarCierre` acota el rol a `Exclude<RolVentana, 'exportacion'>`.
- Tests existentes actualizados: `separacion.test.ts` (lista de códigos solo-main) y `config.test.ts` (valor por defecto).

**Cómo probarlo.** `npm run test:cambios` (`exportacion.test.ts` y `exportacionIpc.test.ts`); `npm run test:e2e:criticos`.

**Deuda y decisiones.**
- No se tocó `electron.vite.config.ts`: el tercer preload y la tercera entrada HTML los compila 0234. Tampoco hay `env.d.ts` de `window.shinobiExportacion` (lo añade 0234/0235).
- Los canales usan `exportacion:perfiles`... (con dos puntos, como el resto del código) en vez de los puntos del ADR.
- `MEMORIA_MINIMA` es 8 GiB exactos como en el ADR; un equipo de «8 GB» de Windows o Linux puede informar menos de 8 GiB y quedar sin 4K. Si la guía manual lo muestra, bajar el umbral (cambio de tabla).
- `nombrePropuesto` con título vacío usa «Sin título»; el corte a 120 caracteres puede quitar « (karaoke)» en títulos muy largos, como dice la spec.
- Sin preguntas nuevas.
