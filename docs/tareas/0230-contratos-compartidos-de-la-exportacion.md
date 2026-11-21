# 0230 — Contratos compartidos de la exportación

- Estado: Pendiente
- Paso del pipeline: 6
- Depende de: fase 4 integrada; tipos de la fase 5 que amplían `estilo` y añaden `modalidad` ([ADR 0018](../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md) §1 y §5, tareas de la fase 5 del rango 0200–0229 que tocan `shared/estilo.ts` y `shared/cancion.ts`)
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
- **IPC**: esquemas Zod en `shared/ipc.ts` y nombres en `shared/canales.ts` de los canales de §10 y los eventos `exportacion:cambio`, `exportacion:progreso` (principal) y `exportacion:fotograma` (exportación). Rol `exportacion` en `ROLES_POR_CANAL`, con el test de cobertura.
- **Errores** en `shared/errores.ts`: `SIN_ESPACIO` (si no existe), `DESTINO_NO_DISPONIBLE`, `DESTINO_OCUPADO`, `PERFIL_NO_SOPORTADO`, `SIN_CODIFICADOR`, `LIMPIEZA_FALLIDA`, `ENTRADA_INCOMPLETA`; reutiliza `CANCION_NO_DISPONIBLE`, `MEMORIA_INSUFICIENTE`, `RUNTIME_NO_DISPONIBLE`, `ERROR_INTERNO`.
- **Config** en `shared/config.ts`: `exportacion = { formato, audio, proporcion, ancho, alto, fps, carpeta, factor_corrector }`, lectura tolerante por campo. No entra en `configParcialRendererSchema` (lo escribe main).
- **Preload**: `window.shinobi.exportacion.*` en `preload/index.ts`; nuevo `preload/exportacion.ts` con `window.shinobiExportacion` (`inicial`, `listo`, `alFotograma`). Dobles para el renderer (API falsa) y fixtures en `shared/__fixtures__/exportacion.ts`.

## Criterios de aceptación
- [ ] `combinaciones()` da 48 combinaciones, todas con dimensiones pares y dentro de los techos de 0050.
- [ ] `nombrePropuesto` cubre caracteres prohibidos, artista vacío, nombres largos y puntos finales.
- [ ] Los esquemas rechazan resoluciones o FPS fuera del catálogo, rutas en `iniciar` y `n` negativo en `listo`.
- [ ] `ROLES_POR_CANAL` cubre todos los canales y la ventana de exportación solo tiene `exportacion.inicial` y `exportacion.listo`.
- [ ] Un `config.json` sin `exportacion` o con valores inválidos se lee con los valores por defecto.

## Pruebas de feedback
- Unitarias: `shared/exportacion.test.ts` (catálogo, estimaciones, nombre, fotogramas), tests de esquemas en `ipc.test.ts`, cobertura de `ROLES_POR_CANAL`, lectura tolerante de `config`.
- E2E: ninguna.
- Críticos: sí (toca `shared/` y `preload/`).
- Manual: nada.

## Notas de implementación
