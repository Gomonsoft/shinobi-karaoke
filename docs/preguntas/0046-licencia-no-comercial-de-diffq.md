# 0046 — Dependencias `diffq` con licencia no comercial
- De: programador
- Para: arquitecto
- Estado: Respondida
- Bloquea: no (decisión resuelta; cierre de 0133 sujeto a implementación y validación)

## Contexto
La tarea 0133 consulta los metadatos JSON de PyPI para los cinco archivos de requisitos. La consulta real a PyPI del 2026-11-06 encontró:

| Paquete fijado | Perfiles | `license_expression` | `license` en PyPI |
|---|---|---|---|
| `diffq==0.2.4` | `darwin-arm64-mps`, `linux-x64-cpu`, `linux-x64-cuda` | `null` | `Creative Commons Attribution-NonCommercial 4.0 International` |
| `diffq-fixed==0.2.4` | `win32-x64-cpu`, `win32-x64-cuda` | `null` | `Creative Commons Attribution-NonCommercial 4.0 International` |

Los requisitos señalan `audio-separator` como quien incorpora `diffq` y `diffq-fixed`. En PyPI, `diffq` remite a `facebookresearch/diffq` y `diffq-fixed` a `JackismyShephard/diffq`. Los dos términos incluyen una restricción no comercial, contraria al criterio de ADR 0002 de no introducir dependencias con cláusulas no comerciales. No se redistribuyen dentro del instalador, pero sí se instalan al equipo usuario desde PyPI.

El script 0133 las rechaza como licencias no comerciales y no escribe el inventario. Las pruebas fijas y Ruff pasan. La excepción manual actual `cuda-toolkit==12.8.1` es distinta: PyPI no declara licencia, identifica como publicador a NVIDIA Kitmaker Team y describe un meta-paquete sin software que instala paquetes `nvidia-*`; no anula la comprobación de `diffq`.

Fuentes primarias consultadas:
- https://pypi.org/pypi/diffq/0.2.4/json
- https://pypi.org/pypi/diffq-fixed/0.2.4/json
- https://github.com/facebookresearch/diffq
- https://github.com/JackismyShephard/diffq

## Pregunta
¿Cómo deben resolverse estas dos dependencias antes de aceptar el inventario? ¿Hay que retirarlas o sustituirlas en la resolución de `audio-separator`, o el arquitecto considera que la licencia declarada no limita el uso del programa según el ADR 0002? Si se permite continuar, hace falta dejar la decisión documentada y su fundamento; el programador no debe declarar compatible por su cuenta una licencia no comercial.

## Opción provisional tomada (si no bloquea)
Ninguna. No se añaden excepciones manuales para `diffq` ni `diffq-fixed` hasta recibir respuesta del arquitecto.

## Respuesta
Excluir ambos paquetes de los cinco requisitos, del lock del worker y de las instalaciones administradas. Sus licencias CC BY-NC 4.0 incumplen el ADR 0002, también cuando se descargan tras instalar la app. El inventario de 0133 debe seguir rechazándolas. [PyPI, diffq](https://pypi.org/pypi/diffq/0.2.4/json) y [PyPI, diffq-fixed](https://pypi.org/pypi/diffq-fixed/0.2.4/json).

Se conserva la rueda oficial de `audio-separator==0.48.0`. Aunque sus metadatos exigen DiffQ según el sistema operativo, la carga de arquitectura es dinámica. Los modelos fijados usan MDXC/RoFormer y MDX/ONNX, respectivamente. Esa separación de rutas permite excluir ambos nombres mediante uv, con una prueba de inferencia real pendiente. La política de licencia y consentimiento de los pesos sigue regida por el ADR 0004. [Metadatos de la rueda](https://pypi.org/pypi/audio-separator/0.48.0/json) y [carga por arquitectura](https://github.com/nomadkaraoke/python-audio-separator/blob/v0.48.0/audio_separator/separator/separator.py#L913-L947).

Para Programación, aplicar las exclusiones en resolución e instalación, migrar los venv existentes, validar los modelos en los cinco perfiles y ejecutar después la auditoría de 0133 con red. El [ADR 0014](../adr/0014-excluir-diffq-del-runtime-de-separacion.md) fija la secuencia, las comprobaciones y la coordinación con 0130/0131, 0134 y 0135–0137. La decisión permite reanudar la implementación. El cierre de 0133 requiere el inventario generado y la evidencia de validación del runtime.
