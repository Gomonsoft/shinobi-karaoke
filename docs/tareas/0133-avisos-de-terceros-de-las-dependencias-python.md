# 0133 — Avisos de terceros: dependencias Python transitivas
- Estado: En curso
- Paso del pipeline: 0 (distribución)
- Depende de: — (orden en `THIRD_PARTY_NOTICES.md`: después de 0132)
- ADRs: 0012 §7; 0002; 0009 §1; 0014
- ¿Red?: **el script, sí** (API JSON de PyPI, con el índice de PyTorch si hace falta), por eso **no** entra en `pytest` por defecto. Sus tests, no: usan respuestas fijas.

## Objetivo
Cumplir lo que `THIRD_PARTY_NOTICES.md` promete desde la Fase 2: "El resto de dependencias transitivas se revisarán al empaquetar". No se redistribuyen, pero el usuario debe ver qué instala y hay que confirmar que nada viola el ADR 0002.

## Archivos
- `worker/scripts/licencias_requisitos.py` y `worker/tests/test_licencias_requisitos.py`;
- `THIRD_PARTY_NOTICES.md`.

## Contratos
- Sin dependencias nuevas: patrón de `worker/scripts/medir_descarga.py`.
- Lee los 5 archivos de `worker/requisitos/`, une los paquetes y consulta `license_expression`, `license` y clasificadores de PyPI.
- Salida ordenada entre `<!-- inicio:dependencias-python -->` y `<!-- fin:dependencias-python -->`: paquete, versión, licencia, en qué perfiles.
- `--comprobar`: compara con el archivo.
- Una licencia que no se pueda clasificar o contenga términos no comerciales, "research only" o similares falla, salvo una entrada revisada a mano en una lista con su motivo. Los `nvidia-*` se listan como licencia de NVIDIA, no redistribuida.
- Si aparece una licencia incompatible, **no se decide en la tarea**: se abre pregunta para el arquitecto.

## Criterios de aceptación
- [x] Tests sin red, con respuestas de PyPI grabadas e inventadas: expresión SPDX, clasificador, licencia desconocida, no comercial, lista revisada.
- [x] `uv run pytest` sigue sin usar la red.
- [ ] Ejecutado una vez con red; resultado en `THIRD_PARTY_NOTICES.md`.
- [ ] Se quita la frase "se revisarán al empaquetar".

## Verificación
```bash
cd worker
uv run ruff check . && uv run ruff format --check scripts/licencias_requisitos.py tests/test_licencias_requisitos.py
uv run pytest tests/test_licencias_requisitos.py     # sin red
uv run python scripts/licencias_requisitos.py        # CON RED
```

## Notas de implementación
Se implementaron `worker/scripts/licencias_requisitos.py` y `worker/tests/test_licencias_requisitos.py`. El script lee los cinco archivos de requisitos, agrupa versiones por perfil, consulta PyPI en paralelo, clasifica `license_expression`, `license` y clasificadores, rechaza licencias no comerciales/desconocidas/incompatibles, admite excepciones manuales con motivo y clasifica los paquetes `nvidia-*` como licencia de NVIDIA no redistribuida. `cuda-toolkit==12.8.1`, sin licencia declarada en PyPI, se registró manualmente con el motivo revisado en `REVISIONES_MANUALES` (meta-paquete publicado por NVIDIA que instala paquetes `nvidia-*`).

Verificación sin red: las 8 pruebas pasan; Ruff check y format:check pasan. Ejecución real contra PyPI el 2026-11-06: falla de forma intencional y no modifica `THIRD_PARTY_NOTICES.md`. PyPI declara `Creative Commons Attribution-NonCommercial 4.0 International` para `diffq==0.2.4` (macOS arm64 y Linux x64 CPU/CUDA) y `diffq-fixed==0.2.4` (Windows x64 CPU/CUDA). La licencia restringe el uso comercial y contradice ADR 0002. Se abrió [`pregunta 0046`](../preguntas/0046-licencia-no-comercial-de-diffq.md) para el arquitecto; no se añadió excepción.

### Reanudación tras la respuesta 0046

- `worker/requisitos/exclusiones.txt` contiene `diffq` y `diffq-fixed` y se instala como `resources/worker/requisitos/exclusiones.txt`. El compilador lo pasa por `--excludes` y comprueba que coincide con la configuración de uv del proyecto. La copia temporal de macOS conserva la restricción de plataforma.
- uv 0.13.7 regeneró el lock y los cinco perfiles. Pasaron `uv lock --check` y `uv run --locked python scripts/compilar_requisitos.py --comprobar`. Solo se eliminaron las distribuciones DiffQ, DiffQ-fixed y su transitiva Cython. Las demás versiones se conservaron.
- El adaptador real rechaza los pares de identificador y archivo ajenos al catálogo antes de instanciar `Separator`. Las pruebas incluyen Demucs, archivos de la misma extensión, pares cruzados e identificadores ajenos.
- La auditoría con red de los cinco perfiles regenerados pasó y produjo 92 entradas en `/tmp/shinobi-0133-inventario.md`. La medición de bytes de descarga quedó en `/tmp/shinobi-0133-descargas.json`.
- En macOS arm64, `uv sync --locked --extra separacion` pasó en un venv aislado, con ausencia de ambas distribuciones y del módulo `diffq`. También pasó la simulación de `uv pip install` con `--no-config`, `--require-hashes` y `--excludes` contra el perfil macOS. Ruff y las 38 pruebas del compilador, del inventario y del contrato del separador pasaron. `uv pip check` señaló únicamente el requisito de DiffQ de los metadatos de audio-separator, previsto por el ADR.
- Inferencia real en macOS arm64 con CPU forzada: Rápido y Calidad generaron dos FLAC PCM 16 estéreo a 44,1 kHz y de 4 s cada uno a partir de audio sintético. Los SHA-256 de los dos pesos y del YAML coincidieron con el manifiesto. Se bloqueó la red desde Python y se usó un PATH sin ffmpeg ni ffprobe. Esta ejecución cubre el worker directo.
- Suite normal del worker: 326 aprobadas, 7 deseleccionadas y 1 fallo en `test_largo_11_min_rapido_y_sin_error`, por superar el límite de 10 s (17,1 s). La misma prueba pasó al repetirla sola en el venv aislado.
- Se integró el inventario de 92 entradas tras 0132 y pasó `licencias_requisitos.py --comprobar`. El manifiesto v2 recoge los cinco hashes y tamaños de descarga recalculados. Se conservan los límites de espacio y las referencias de caché anteriores hasta medirlos de nuevo.
- El gestor recrea el entorno al reparar o migrar un marcador obsoleto, aplica `--excludes` a la instalación y verifica la ausencia de DiffQ antes de guardar el marcador. Las pruebas cubren la retirada de una distribución simulada, la conservación del modelo y un fallo en la comprobación seguido de reintento. El verificador confirmó el archivo de exclusiones en el paquete macOS reconstruido. Pasaron los 13 E2E de primer arranque y reparación.
- La actualización de yt-dlp pasa el mismo archivo de exclusiones. Se ejecutó la comprobación Python exacta del gestor sobre dos intérpretes reales. Rechazó el entorno anterior que contenía DiffQ y aceptó el entorno aislado creado con la resolución nueva.
- La repetición de la suite del worker pasó con 327 pruebas y 7 deseleccionadas.
- Para cerrar 0133 faltan la inferencia en Windows y Linux CPU/CUDA y las medidas de caché y espacio requerido por perfil del ADR 0014.
