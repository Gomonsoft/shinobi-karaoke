# 0035 — Runtime: comprobación al arrancar, reutilización tras recrear `config.json` y `resolverLanzador` en producción
- Estado: Hecha
- Paso del pipeline: 0
- Depende de: 0034
- ADRs: 0001, 0006 (revisión 2026-11-04: reutilizar runtime), 0009 §5–§6
- Spec UX: docs/ux/01-primer-arranque.md ("Instalación dañada en un arranque posterior", criterio 12)

## Objetivo
Que la app arranque bien en todos los estados del runtime: completo, incompleto, dañado o presente pero "olvidado" porque `config.json` se recreó; y que el worker se lance con el intérprete del venv cuando la app está empaquetada (deuda de 0013/0014: hoy `index.ts` usa siempre el modo desarrollo).

## Criterios de aceptación
- [x] `comprobarAlArrancar()` en el gestor de runtime, antes de crear la ventana (o mientras la ventana muestra su primera pantalla), aplica ADR 0009 §6:
  - `completa` + comprobación barata OK → nada (Biblioteca).
  - `completa` + falta el venv, el marcador no coincide con la `version` del manifiesto o falta el modelo del perfil → `estado = "dañada"` y fases afectadas a `pendiente` (B5 "Hay que reparar el motor de audio").
  - no `completa` + marcador válido → verificación completa (diagnóstico + SHA-256 de los modelos presentes, 0033 `completo: true`); si pasa, reconstruye `instalacion` y `separacion.modelos_descargados` y marca `completa` **sin descargar nada**; si no, deja pendientes solo las fases no válidas.
  - Siempre: `limpiarModelos()` (borra `*.partial`).
- [x] La comprobación barata tarda < 200 ms; la verificación completa se registra con su duración (esperado ~3–5 s con el modelo Calidad). Mientras dura, el renderer recibe un estado `verificando` (presentación: `preguntas/0013` §3; provisional: B1 sin botón con "Comprobando tu instalación…").
- [x] `resolverUv()`: empaquetado → `process.resourcesPath/bin/uv[.exe]`; sin empaquetar → `SHINOBI_UV` o PATH (como 0013).
- [x] `configurarWorker` en `index.ts`: empaquetado → `resolverLanzador({ modo: 'produccion', datos, plataforma, rutaCodigoWorker: process.resourcesPath/worker })` y el directorio de scripts del venv antepuesto al `PATH` del hijo; sin empaquetar → modo desarrollo como hasta ahora. Variable `SHINOBI_LANZADOR=produccion` (solo sin empaquetar) para probar el modo producción en desarrollo con un runtime instalado de verdad.
- [x] Si se intenta lanzar un trabajo con la instalación no completa, el cliente del worker devuelve `RUNTIME_NO_DISPONIBLE` (ya existe) sin lanzar procesos.
- [x] Tests unitarios (dobles de fs y puertos): cada rama de `comprobarAlArrancar`; marcador de otra versión del manifiesto → solo se repite componentes; `config.json` recreado con runtime válido → `completa` sin llamar al descargador ni a uv `pip install`; lanzador de producción en win32 y POSIX (rutas, `PATH`, `PYTHONPATH`).
- [x] Test de integración (CI, sin red): con un venv real creado con `uv venv` en un temporal + `PYTHONPATH` al worker del repo, `resolverLanzador` en modo producción ejecuta `demo` correctamente en los 3 SO (cubre la deuda "sin probar en Windows" de 0013).

## Notas de implementación
- **Qué se hizo**:
  - `main/runtime/gestor.ts`: `comprobarAlArrancar()` (ADR 0009 §6) con resultado `completa` | `dañada` (motivo `venv`/`marcador`/`modelo`) | `reutilizada` | `pendiente`. Siempre empieza con `limpiarModelos()`. `completa`: comprobación barata (intérprete del venv, marcador = versión del manifiesto + plataforma + perfil + SHA de requisitos, tamaño del modelo vía el nuevo `modeloPresente`) sin SHA-256; si falla → `dañada` y solo las fases afectadas a `pendiente` (marcador de otra versión: solo `componentes`). No completa + marcador válido: diagnóstico + SHA-256 completo de los modelos presentes; si el del perfil pasa → `completa` con `instalacion` y `modelos_descargados` reconstruidos, sin uv ni descargas; si no, solo el modelo queda pendiente. Diagnóstico fallido → `componentes` pendiente. Duraciones registradas en `registro` (módulo `runtime`).
  - `ProgresoRuntime` gana `verificando: boolean` (evento `true`/`false` alrededor de la verificación completa; presentación provisional en 0037).
  - `runtime/uv.ts`: `resolverUv()` (empaquetado `resources/bin/uv[.exe]`, ignorando `SHINOBI_UV`; si no, `SHINOBI_UV` o PATH).
  - `trabajos/worker.ts`: `resolverLanzador` producción admite `envBase` y antepone `<datos>/runtime/venv/{bin|Scripts}` al `PATH` del hijo (clave `Path` respetada en Windows, separador por plataforma); `ConfigCliente.disponible` → `RUNTIME_NO_DISPONIBLE` sin lanzar proceso.
  - `main/lanzadorApp.ts`: `lanzadorDeApp()` elige desarrollo/producción (`app.isPackaged` o `SHINOBI_LANZADOR=produccion` sin empaquetar, que usa `<repo>/worker` como `PYTHONPATH`). `main/index.ts` lo usa y activa `disponible` (`instalacion.estado === 'completa'`) solo en modo producción.
- **Cómo probarlo**: `cd app && npx vitest run src/main/runtime src/main/trabajos src/main/lanzadorApp.test.ts` (`arranque.test.ts` con dobles de puertos y un manifiesto con modelos diminutos; `lanzador.integracion.test.ts` con `uv venv` real y `demo`, se omite sin uv; en CI hay uv en los 3 SO). Prueba manual en desarrollo: instalar un runtime real en `SHINOBI_DATOS` y arrancar con `SHINOBI_LANZADOR=produccion`.
- **Deuda / pendiente**:
  - La invocación de `comprobarAlArrancar()` antes de crear la ventana, la creación del gestor real en `index.ts`, `SHINOBI_RUNTIME_FALSO` y el IPC son de 0036/0039 (para no pisar su cableado); `resolverUv()` queda lista para esa creación.
  - La prueba de integración con venv real no se ha ejecutado en la máquina del programador (sin uv instalado); su primera ejecución real será la CI.
  - Con `SHINOBI_LANZADOR=produccion` y el runtime sin instalar los trabajos devuelven `RUNTIME_NO_DISPONIBLE` (esperado).

### Mantenimiento

- Causa: `lanzador.integracion.test.ts` (venv vacío con `uv venv`, `demo` en modo producción) fallaba con `No module named 'av'` en cuanto había `uv`, porque `shinobi_worker/comandos.py` importaba al cargar `importar_archivo`, `diagnostico` y `youtube` (av, numpy, pyloudnorm, soundfile, yt-dlp) aunque `demo`/`version` no los usen. Antes el test se omitía y el fallo no se veía.
- Arreglo: `comandos.py` registra envoltorios que importan el módulo de cada comando de forma perezosa. `demo`/`version` arrancan sin dependencias pesadas (y el worker arranca más rápido). Sin cambios en el test. Verificado con `SHINOBI_UV`: test afectado 3/3, pytest del worker (253) y vitest completo de app en verde.
