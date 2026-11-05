# 0033 — Runtime: descarga reanudable de modelos con SHA-256 y limpieza de `*.partial`
- Estado: Hecha
- Paso del pipeline: 0 (y 2: lo reutilizará la descarga bajo demanda de Ajustes en la Fase 3)
- Depende de: 0029, 0030
- ADRs: 0004, 0006, 0009 §4
- Spec UX: docs/ux/01-primer-arranque.md (fase "Descargando el modelo de separación", `pa.error.verificacion`, `pa.error.servidor`)

## Objetivo
Un módulo del proceso principal que descargue un modelo del manifiesto a `modelos/` con progreso exacto en bytes, reanudación, verificación SHA-256 y errores clasificados, y que mantenga limpia la carpeta.

## Criterios de aceptación
- [ ] `app/src/main/runtime/modelos.ts`: `descargarModelo(modelo, { dirModelos, señal, alProgreso })` descarga el archivo principal y sus `extra` a `<archivo>.descarga`; si ya existe parte, pide `Range: bytes=<n>-` y continúa si la respuesta es 206 (si es 200, empieza de cero); calcula SHA-256 en streaming (incluida la parte previa), comprueba `bytes` y `sha256` y renombra a `<archivo>`. Prueba las `urls` en orden ante error de red o HTTP ≥ 400.
- [ ] SHA-256 o tamaño incorrectos → borra el `.descarga` y reintenta **una vez** desde cero; si vuelve a fallar → `VERIFICACION_FALLIDA`. Errores: sin red/DNS/conexión rechazada → `SIN_CONEXION`; HTTP 5xx/429 o todas las URLs fallan → `SERVICIO_NO_DISPONIBLE`; `ENOSPC` → `SIN_ESPACIO`; resto → `ERROR_INTERNO`. Cancelar (`AbortSignal`) deja el `.descarga` para reanudar.
- [ ] Progreso: `{ bytes, total }` con `total` del manifiesto, como máximo ~4 eventos/s.
- [ ] `verificarModelo(modelo, dirModelos, { completo })`: usa `modelos/verificados.json` (`bytes`, `sha256`, `mtimeMs`) para no recalcular si nada cambió; con `completo: true` recalcula siempre. Escritura atómica (0007).
- [ ] `limpiarModelos(dirModelos)`: borra `*.partial` (restos de audio-separator, 0005 §8); **no** borra `*.descarga`. Se llama al arrancar la app y tras cancelar una descarga.
- [ ] Los modelos `provisional` se descargan igual; el registro (`registros/app.log`) anota su licencia "no declarada".
- [ ] Tests con un servidor HTTP local (`node:http` en `127.0.0.1`, archivo generado de ~2 MB): descarga completa; corte a mitad y reanudación con 206; servidor que ignora `Range` (200); SHA incorrecto una vez (se recupera) y siempre (`VERIFICACION_FALLIDA`); primera URL 500 y segunda OK; todas fallan; puerto cerrado (`SIN_CONEXION`); cancelación; `verificados.json` evita recalcular; `limpiarModelos` respeta `.descarga`. Sin acceso a Internet.

## Notas de implementación
- **Qué se hizo**: `app/src/main/runtime/modelos.ts` (+ `modelos.test.ts`): `descargarModelo`, `verificarModelo`, `limpiarModelos`, `ErrorModelo` (código del catálogo), `totalModelo`. Usa `fetch` (undici) con `Accept-Encoding: identity`, `Range: bytes=<n>-` desde `<archivo>.descarga`, SHA-256 en streaming (releyendo la parte previa), renombrado final y `verificados.json` (escritura atómica con `escribirJsonAtomico`). Si el servidor responde 200 a un `Range` empieza de cero; 416 o `Content-Range` inesperado → borra la parte y pasa a la siguiente URL.
- **Decisiones**: el progreso `{ bytes, total }` suma el modelo y sus `extra` (`total` = bytes del manifiesto de todos ellos) y se limita a ~4 eventos/s (con un último evento forzado al terminar cada archivo). Un corte de conexión a mitad se trata como error de red de esa URL (se prueba la siguiente, que reanuda con Range); si todas son de red → `SIN_CONEXION`, si alguna fue HTTP → `SERVICIO_NO_DISPONIBLE`. Cancelar lanza `CANCELADO`, deja el `.descarga` y llama a `limpiarModelos`. El índice guarda `mtimeMs` truncado a ms. Los modelos con licencia "no declarada" anotan un aviso en el registro (`registro` opcional en las opciones). Los archivos ya completos y verificados se omiten.
- **Cómo probarlo**: `cd app && npx vitest run src/main/runtime/modelos.test.ts` (servidor `node:http` local, 2 MB, sin Internet); con `SHINOBI_TESTS_RED=1` también pide `Range: bytes=0-15` a la primera URL real de cada modelo (no descarga los modelos).
- **Deuda**: no está conectado aún: 0034/0035 deben llamar a `limpiarModelos` al arrancar y a `descargarModelo`; no hay reintento automático interno tras un corte (lo hace el llamador).
