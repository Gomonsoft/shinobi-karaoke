# 0014 — Excluir DiffQ del runtime de separación

- Estado: Aceptado
- Fecha: 2026-11-06
- Paso del pipeline: 2 (separación) y 0 (distribución)

## Contexto

Los cinco requisitos de Python 3.12 y `worker/uv.lock` resuelven `diffq==0.2.4` en macOS arm64 y Linux x64 (CPU/CUDA), y `diffq-fixed==0.2.4` en Windows x64 (CPU/CUDA). El `Requires-Dist` publicado de `audio-separator==0.48.0` exige uno u otro según `sys_platform`, también con el extra `cpu`. Ambos paquetes declaran CC BY-NC 4.0 en PyPI y sus repositorios publican el mismo texto de licencia. El ADR 0002 excluye dependencias no comerciales, incluidas las que el gestor descarga después de instalar la app.

En la etiqueta v0.48.0, `Separator.load_model` importa dinámicamente la implementación según el tipo de modelo. El manifiesto de Shinobi solo ofrece Calidad (`vocals_mel_band_roformer.ckpt` y YAML, MDXC/MelBand RoFormer sobre PyTorch) y Rápido (`UVR-MDX-NET-Inst_HQ_4.onnx`, MDX/ONNX). Las entradas de esas arquitecturas llevan a MDXC y MDX, respectivamente. DiffQ restaura estados cuantizados en la ruta Demucs, ajena a esos dos formatos. La inspección de fuentes justifica probar la exclusión con los archivos fijados. La inferencia real con ambos paquetes ausentes queda como condición de entrega.

## Alternativas consideradas

| Opción | Licencia | Pros | Contras |
|---|---|---|---|
| Excluir ambos nombres en uv y limitar el adaptador a los modelos del manifiesto | Conserva la distribución MIT de audio-separator | Mantiene la versión, pesos y parches actuales; uv resuelve las demás dependencias | Los metadatos de la rueda conservan los dos requisitos; exige exclusión explícita en cada ruta y pruebas de inferencia |
| Mantener la resolución publicada o autorizarla en el inventario | CC BY-NC 4.0 para ambos paquetes | Instalación upstream sin cambios | Infringe el ADR 0002; la descarga posterior y el consentimiento no resuelven la restricción |
| Distribución derivada de v0.48.0 sin soporte Demucs ni requisitos DiffQ | MIT para el código upstream, sujeto a auditoría del contenido de la rueda | Metadatos coherentes para instaladores genéricos | Añade mantenimiento, compilación, procedencia y distribución de una rueda propia |
| Cambiar de versión o sustituir el motor | Por verificar para código, dependencias y pesos | Una versión upstream que haga DiffQ opcional simplificaría el mantenimiento | Requiere verificar los dos modelos exactos, el parche sin ffmpeg y los perfiles; el cambio de versión por sí solo no garantiza excluir DiffQ |

## Decisión

Excluir `diffq` y `diffq-fixed` de la resolución y de los entornos administrados, manteniendo la rueda oficial fijada de `audio-separator==0.48.0`. Limitar la entrada al catálogo de dos modelos ya fijado en el manifiesto, incluido el rechazo de Demucs y de nombres ajenos al catálogo antes de llegar a la librería. La excepción es de resolución para esos dos nombres. El inventario sigue rechazando licencias no comerciales.

Se precisa el ADR 0009 §1. Usar `--excludes <archivo>` de uv 0.13.7 tanto en `uv pip compile` como en `uv pip install` del gestor, pasando la ruta explícitamente también con `--no-config` y conservando `--require-hashes`. El archivo debe contener exclusivamente ambos nombres y estar disponible en la app empaquetada. Para `uv lock/sync/run`, aplicar `[tool.uv].exclude-dependencies` en el proyecto raíz del worker. Verificar que ambas listas coinciden y que la copia temporal del compilador conserva la configuración de macOS arm64. Borrar líneas del lock o usar `--no-emit-package` solo oculta la dependencia en la salida y permite que se resuelva de nuevo al instalar. `--no-deps` omitiría la resolución de todo el grafo en esa instalación.

Al actualizar desde un runtime anterior, recrear el entorno virtual administrado cuando corresponda aplicar esta migración. Invalidar el marcador anterior y conservar los modelos verificados y los datos de usuario. La instalación incremental sobre el entorno anterior puede dejar paquetes huérfanos. La actualización, la reparación y la reanudación deben llegar a un entorno sin ambas distribuciones y sin el módulo `diffq`. Registrar el nuevo marcador solo después de instalar y comprobar esa ausencia.

Se mantiene el criterio del ADR 0004 para los pesos. Calidad tiene declaración MIT en la ficha de la autora. Rápido conserva su estado provisional y su descarga con consentimiento según el ADR 0004 y la tarea 0134. Los pesos de Rápido siguen con licencia no declarada. Si la fuente declara términos incompatibles, retirar la oferta según el ADR 0004. El consentimiento tampoco habilita paquetes no comerciales.

## Consecuencias

- Positivas. Se conservan los dos formatos y la rueda upstream sin incorporar paquetes CC BY-NC.
- Riesgos. Una comprobación genérica de metadatos como `uv pip check` puede señalar el requisito DiffQ de la rueda oficial. Si se usa, verificar que el único requisito faltante atribuible a la decisión es el aplicable por plataforma y tratar cualquier otro error como fallo. Revisar esta decisión antes de cambiar audio-separator o añadir un modelo.
- Impacto en UX. Una migración puede reinstalar los componentes Python. Volver a medir bytes, caché y espacio requerido antes de distribuir. Rápido requiere el consentimiento existente.

## Trabajo y validación antes de cerrar 0133

1. **Programación, resolución.** Regenerar `worker/uv.lock` y los cinco perfiles con uv 0.13.7. Ejecutar `uv lock --check` y `uv run python scripts/compilar_requisitos.py --comprobar` desde `worker/`. Comprobar ausencia de ambos nombres normalizados en las resoluciones, revisar el diff de transitivas y mantener las versiones ajenas al cambio cuando sigan siendo necesarias. Probar sin red que compilador e instalador pasan la exclusión y que se rechazan modelos fuera del catálogo.
2. **Programación, gestor y paquete.** Coordinar con 0130/0131 la inclusión y verificación del archivo de exclusión en el paquete y con 0134 el flujo de consentimiento. Actualizar la versión del manifiesto, los cinco `sha256_requisitos` y las estimaciones afectadas. Probar instalación limpia, reparación y actualización desde un venv que contenga una distribución de prueba inocua con el nombre excluido. Verificar con `importlib.metadata` y `importlib.util.find_spec` que ninguna distribución ni el módulo quedan disponibles. Cubrir reanudación tras fallo de migración.
3. **Programación, validación con red y hardware.** Ejecutar `runtime-real` y probar el gestor real y `uv sync --locked --extra separacion`. Cubrir macOS arm64 y Windows/Linux x64 en CPU, más CUDA en Windows y Linux con GPU real. Para cada perfil, verificar ausencia de DiffQ y separar audio generado con ambos modelos exactos, pesos y YAML verificados por SHA-256. Comprobar dos pistas FLAC legibles y de duración coherente, sin ffmpeg en el PATH, Calidad por defecto y Rápido tras consentimiento explícito. Ejecutar la separación con los pesos ya verificados y sin red para detectar descargas implícitas. Validar el paquete en 0135–0137. Registrar resultados por perfil y mantener pendiente cualquier cobertura que falte.
4. **Programación, tarea 0133.** Con los cinco requisitos regenerados, ejecutar los tests del inventario sin red y el script real con red. Integrar el bloque de avisos después de 0132, ejecutar `uv run python scripts/licencias_requisitos.py --comprobar` y retirar la promesa de revisión futura. Si falla la exclusión, la inferencia o la auditoría, conservar el bloqueo de cierre y publicación. Reevaluar con Arquitectura una versión upstream compatible o una rueda derivada auditada.

Verificado para esta decisión mediante lectura de fuentes y requisitos, y consulta de la ayuda de uv 0.13.7 instalado. La terminal no pudo resolver `pypi.org` en esta intervención. La regeneración, la migración y las pruebas de inferencia pertenecen a la implementación.

## Fuentes

- [PyPI, metadatos de audio-separator 0.48.0](https://pypi.org/pypi/audio-separator/0.48.0/json) y [declaración de dependencias en v0.48.0](https://github.com/nomadkaraoke/python-audio-separator/blob/v0.48.0/pyproject.toml).
- [PyPI, diffq 0.2.4](https://pypi.org/pypi/diffq/0.2.4/json) y [licencia de DiffQ](https://github.com/facebookresearch/diffq/blob/main/LICENSE).
- [PyPI, diffq-fixed 0.2.4](https://pypi.org/pypi/diffq-fixed/0.2.4/json) y [licencia del fork](https://github.com/JackismyShephard/diffq/blob/main/LICENSE).
- [Carga por arquitectura en v0.48.0](https://github.com/nomadkaraoke/python-audio-separator/blob/v0.48.0/audio_separator/separator/separator.py#L913-L947), [MDXC](https://github.com/nomadkaraoke/python-audio-separator/blob/v0.48.0/audio_separator/separator/architectures/mdxc_separator.py), [MDX](https://github.com/nomadkaraoke/python-audio-separator/blob/v0.48.0/audio_separator/separator/architectures/mdx_separator.py) y [restauración de estados cuantizados en Demucs](https://github.com/facebookresearch/demucs/blob/main/demucs/states.py).
- [Ficha de MelBand RoFormer de Kimberley Jensen](https://huggingface.co/KimberleyJSN/melbandroformer), [publicación de los pesos UVR](https://github.com/TRvlvr/model_repo/releases/tag/all_public_uvr_models) y [manifiesto de Shinobi](../../app/resources/runtime-manifest.json).
- [uv pip compile](https://docs.astral.sh/uv/reference/cli/#uv-pip-compile--excludes), [uv pip install](https://docs.astral.sh/uv/reference/cli/#uv-pip-install--excludes) y [exclusiones del proyecto uv](https://docs.astral.sh/uv/reference/settings/#exclude-dependencies).
