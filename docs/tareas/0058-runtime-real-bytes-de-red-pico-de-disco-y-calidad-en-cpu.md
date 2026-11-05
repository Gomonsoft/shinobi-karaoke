# 0058 — `runtime-real`: bytes reales de descarga, pico de disco y Calidad en CPU
- Estado: Pendiente
- Paso del pipeline: 0
- Depende de: 0040 (Hecha), 0055, 0056
- ADRs: 0009 (Revisiones 2026-11-05, puntos 3–6)
- Spec UX: —
- Cuándo: **durante la Fase 3**, en paralelo (no la bloquea). Es necesaria **antes de la Fase 7** (`medido: true` y cifras de descarga publicadas)

## Objetivo
Medir lo que `preguntas/0018` dejó abierto:
- los **bytes que se transfieren por red** al instalar (la caché de uv está descomprimida y no sirve);
- el **pico de disco real** de la instalación con Calidad en CPU (¿comparten bloques la caché de uv y el venv?).
Después, validar o corregir `bytes_descarga` y `medido` del manifiesto.

## Criterios de aceptación
- [ ] `worker/scripts/medir_descarga.py` (sin instalar nada; reutiliza la lectura de requisitos de `inspeccionar_av.py`):
  - **Selección de ruedas**: para cada archivo de `worker/requisitos/` y cada paquete fijado, elige entre sus `--hash` la rueda compatible con la plataforma (etiquetas de `packaging.tags` para el triple del archivo; en `darwin-arm64-mps`, macOS 14 arm64 y Python 3.12).
  - **Tamaño de cada rueda**: campo `size` de la API JSON de PyPI (`/pypi/<paquete>/<versión>/json`, emparejando por `sha256`), o `Content-Length` de una petición HEAD para los índices sin API JSON (`download.pytorch.org`).
  - **Salida**: total de bytes por archivo, los 10 paquetes más grandes y los paquetes sin tamaño (si los hay, la salida no es válida). Con `--json` escribe el resultado.
  - **Tests sin red**: respuestas de índice simuladas y una línea con varios hashes.
- [ ] `.github/workflows/runtime-real.yml`: el trabajo de licencias (Ubuntu) ejecuta también `medir_descarga.py` para las 5 combinaciones y sube su JSON en el artefacto.
- [ ] `app/scripts/instalar-runtime.mjs`:
  - **Tráfico de red de la instalación** (`red_mb`, aproximado): diferencia de los contadores de recepción de la interfaz antes y después de las fases motor y componentes, leídos de `/proc/net/dev` (Linux), `netstat -ib` (macOS) o `Get-NetAdapterStatistics` en PowerShell (Windows). Si no se puede leer, vale `null` sin fallar.
  - **Pico de disco**: muestrea el espacio libre del volumen de `SHINOBI_DATOS` cada 1 s durante toda la instalación. El JSON añade `espacio_libre_mb.minimo` y `pico_mb` = libre al inicio − mínimo.
  - **Caché de uv**: renombra `mb_descargados.cache_uv` a `cache_uv_descomprimida`.
  - **Modelo**: instala **Calidad** en todos los perfiles (0056). La opción `--modelo rapido` prueba la vía con consentimiento de 0057 (el script escribe `rapido_aceptado` como haría la interfaz).
  - **Comprobación**: falla si `pico_mb + 500 > espacio_requerido` del perfil, con el mensaje "abrir pregunta para el arquitecto".
- [ ] **Primera ejecución en GitHub**:
  - se copian a las notas de esta tarea, por SO: `red_mb`, la suma de ruedas, `pico_mb` y el disco final con Calidad;
  - el programador actualiza `bytes_descarga` de los 5 perfiles con la suma de ruedas;
  - `medido: true` en Windows y Linux CPU solo si `red_mb` coincide con la suma de ruedas ± 10 % (los perfiles `cuda` se miden sin instalar, pero siguen con `medido: false` hasta tener un equipo NVIDIA);
  - si alguna cifra difiere > 20 % del manifiesto, o el pico no cumple el criterio, se abre una pregunta `Para: arquitecto`.
- [ ] Cuando exista el comando `separar` (Fase 3), opcional en el mismo workflow: separar 60 s de audio generado con Calidad en Windows y Linux CPU para obtener un primer factor x86 (medición pendiente de 0040).

## Notas de implementación
(las rellena el programador al terminar)
