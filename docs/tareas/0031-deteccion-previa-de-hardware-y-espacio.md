# 0031 — Runtime: detección previa de hardware (sin Python) y espacio libre
- Estado: Hecha
- Paso del pipeline: 0
- Depende de: 0029, 0030
- ADRs: 0004 (detección en dos pasos, paso 1), 0006, 0009
- Spec UX: docs/ux/01-primer-arranque.md ("Perfil previsto", "Comprobación de espacio", B6, criterios 2 y 15); `preguntas/0014` §2 (plataforma real)

## Objetivo
Conocer **antes de instalar nada** el perfil previsto (NVIDIA / Apple Silicon / solo CPU), lo que se va a descargar, el espacio requerido y el espacio libre real, para pintar B1.

## Criterios de aceptación
- [x] `app/src/main/runtime/deteccion.ts` con puertos inyectables (`DetectorGpu`, `EspacioLibre`, ADR 0009 §8):
  - `plataformaReal(process.platform, process.arch, app.runningUnderARM64Translation)` → `{ so, arquitectura }`, con la arquitectura **real** (`arm64` si la app va bajo Rosetta o bajo la emulación x64 de Windows on ARM, ADR 0009 Revisiones). `plataformaActual(real)` → `darwin-arm64 | darwin-x64 | win32-x64 | linux-x64 | null`, decidido por la presencia de la plataforma en el manifiesto. `null` = no soportada: Windows/Linux arm64, ia32… Un Mac Apple Silicon con el build x64 da `darwin-arm64`, no `darwin-x64`.
  - `equipo`: `{ so: 'windows'|'macos'|'linux'|'otro', versionSo, arquitectura: 'x64'|'arm64'|'ia32'|'otra' }` (`os.release()`/`process.getSystemVersion()`), para `pa.nocompat.equipo` y "Copiar detalles"; la UI lo traduce a nombres legibles.
  - `detectarGpuNvidia()`: ejecuta `nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits` (en Windows prueba también `%SystemRoot%\System32\nvidia-smi.exe`) con `shell: false` y plazo de 3 s; parsea varias GPU (se queda con la de más VRAM). Sin binario, plazo vencido o salida ilegible → `null` (no es error). Nunca en macOS.
  - `perfilPrevisto(plataforma, gpu)`: `darwin-arm64` → `mps`; NVIDIA detectada en win32/linux x64 → `cuda` (aunque tenga < 4 GB: el diagnóstico rebajará, `ux/01` criterio 5b); resto → `cpu`. Plataforma `null` → `null`.
  - `espacioLibre(ruta)`: `fs.statfs` sobre el directorio de datos o, si no existe, su ancestro existente más cercano; devuelve bytes disponibles para el usuario (`bavail * bsize`).
  - `requisitosPrevios()` → `{ plataforma, equipo, emulada, perfil, gpu, bytesDescarga, espacioRequerido, espacioLibre, modoPrevisto }` leyendo el manifiesto (0030). Sin perfil (detección fallida) → descarga `null` (la UI usa `pa.req.descarga.generica`) y el `espacio_requerido` mayor del manifiesto.
- [x] La detección completa tarda < 100 ms sin GPU y ≤ 3 s en el peor caso (plazo de `nvidia-smi`); se cachea durante la sesión salvo `espacioLibre` (se recalcula en "Comprobar de nuevo").
- [x] Guarda `instalacion.perfil_previsto` y `instalacion.hardware` (`gpu`, `vram_mb`) en `config.json` mediante el servicio de configuración (0008).
- [x] Tests unitarios con dobles: salidas reales de `nvidia-smi` (1 y 2 GPU, con espacios, código ≠ 0, vacía, *timeout*), las 4 plataformas soportadas y 2 no soportadas, Mac bajo Rosetta (→ `darwin-arm64`, `mps`), Windows on ARM con el build x64 (→ `null`, arquitectura `arm64`), `statfs` sobre una ruta inexistente (sube al ancestro), cálculo de requisitos por perfil y sin perfil.
- [x] Test de integración sin dobles (se ejecuta en CI): en la máquina actual devuelve una plataforma conocida y un espacio libre > 0.

## Notas de implementación
- **Qué se hizo**: `app/src/main/runtime/deteccion.ts` (+`deteccion.test.ts`, 36 tests; `runtime/index.ts` lo reexporta). `plataformaReal`, `plataformaActual(real, manifiesto)` (por presencia en el manifiesto), `describirEquipo`, `parsearNvidiaSmi`/`detectarGpuNvidia` (puerto `EjecutarComando`, `shell: false`, plazo 3 s, Windows prueba también `%SystemRoot%\System32`, nunca en macOS), `perfilPrevisto`, `crearEspacioLibre` (`statfs` con subida al ancestro), `calcularRequisitosPrevios` y `crearServicioDeteccion` (cachea todo salvo `espacioLibre`; guarda `instalacion.perfil_previsto` y `instalacion.hardware` con `guardarPrevision` vía `ServicioConfig.actualizar`). Puertos `DetectorGpu` y `EspacioLibre` exportados para los dobles de ADR 0009 §8.
- **Decisiones**: macOS Intel (`darwin-x64`) no está en el manifiesto, así que da `plataforma: null` (B6 / `PLATAFORMA_NO_SOPORTADA`); si el arquitecto decide otra cosa (preguntas/0015) basta con añadirla al manifiesto (hay un test que lo demuestra). `perfil` queda `null` también si el manifiesto no tiene esa plataforma/perfil. `modoPrevisto` = `rapido` (cpu) / `calidad` (cuda, mps) / `null`; no considera el `separacion.modo` manual del usuario. `bytesDescarga` es el total de `bytesTotalesInstalacion` (Python + dependencias + modelo del perfil). El servicio recibe el manifiesto ya cargado: no hay cargador de manifiesto en main (lo necesita 0034/0036); `entornoReal(emulada)` debe recibir `app.runningUnderARM64Translation` desde el main (cableado en 0036, no hecho aquí).
- **Cómo probarlo**: `cd app && npx vitest run src/main/runtime/deteccion`; `npm run lint`, `typecheck`, `format:check`.
- **Deuda**: el cableado IPC y la lectura de `app.runningUnderARM64Translation` son de 0036; la salida de `nvidia-smi` solo se ha probado con dobles (sin GPU NVIDIA en el equipo de desarrollo).
