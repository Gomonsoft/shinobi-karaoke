# 0018 — ¿Cómo incorporamos al manifiesto los datos reales de `runtime-real` y el pico de disco en Linux?
- De: sesión principal (tras la primera ejecución de la tarea 0040)
- Para: arquitecto
- Estado: Respondida
- Bloquea: no (antes de la Fase 7 sí)

## Contexto
La primera ejecución real del workflow `runtime-real.yml` (run 41967889708) pasó en los 3 SO. Los datos están en las notas de `docs/tareas/0040-*.md`, sección "Primera ejecución real".

## Preguntas
1. **`bytes_disco`**: ¿actualizamos el manifiesto con lo medido (Windows CPU ≈ 1,29 GB y Linux CPU ≈ 1,78 GB de datos tras limpiar la caché; macOS ≈ 2,19 GB con Calidad) y marcamos `medido: true`?
2. **`bytes_descarga`**: el script mide la caché de uv descomprimida (1,2–1,6 GB), no la transferencia de red. ¿Hay que cambiar el script para medir los bytes reales descargados antes de validar este campo?
3. **Pico de disco en Linux CPU**: venv (1,62 GB) + caché (1,62 GB) + Python + modelo ≈ 3,4 GB, por encima del `espacio_requerido` de 3 GB, salvo que uv comparta bloques mediante enlaces duros (el script los mide por separado). ¿Hay que subir `espacio_requerido`, cambiar el modo de enlace de uv o medir el pico real?
4. **Modelo descargado según el perfil**: en macOS (mps) se descargó Calidad (913 MB). Está pendiente de decidir si debe depender del modo elegido (Automático, Calidad o Rápido) y no solo del perfil.

## Respuesta
Decisiones del usuario (2026-11-05), sobre los puntos 3 y 4:
- **Modelo por defecto: Calidad en todos los perfiles**, también solo CPU, porque es el más conveniente. Si no está disponible (falla la descarga o no se puede usar en el equipo), se **ofrece al usuario el modelo Rápido bajo su responsabilidad**: se puede descargar y usar, avisando de que su licencia no está declarada (pregunta 0012).
- **Espacio requerido mínimo: 4 GB** (antes 3 GB en los perfiles solo CPU; NVIDIA sigue en 10 GB).
- Los requisitos mínimos y recomendados de hardware se publican en el README.

Queda para el arquitecto: los puntos 1 y 2 y cómo trasladar estas decisiones a los ADR, al manifiesto, a la UX y a las tareas.

### Respuesta del arquitecto (2026-11-05)
**1. `bytes_disco` → sí, con lo medido, pero `medido` sigue en `false` en Windows y Linux CPU.**
- `bytes_disco` es el **venv** (dependencias instaladas), sin Python ni modelo: es lo que midió el spike en macOS (1,28 GB frente a 1204,5 MB del venv ahora). Los "datos tras limpiar la caché" (1,29 / 1,78 / 2,19 GB) incluyen Python y el modelo, que el manifiesto ya suma aparte.
- Valores (run 41967889708): `win32-x64.cpu` **1 165 000 000**, `linux-x64.cpu` **1 619 000 000**, `darwin-arm64.mps` **1 205 000 000** (antes 1 280 000 000; torch 2.15 ocupa algo menos).
- `medido` es un único indicador por entrada y cubre también `bytes_descarga`. Pasa a `true` en Windows y Linux CPU cuando también esté medido `bytes_descarga` (punto 2). macOS sigue en `true`.
- No se sube `version` del manifiesto: no cambian requisitos ni modelos (ADR 0009 §2) y subirla obligaría a repetir la fase de componentes en las instalaciones existentes.
- Tarea [0055](../tareas/0055-manifiesto-espacio-requerido-y-bytes-medidos.md).

**2. `bytes_descarga` → sí, hay que medirlo de otra forma.** La caché de uv guarda las ruedas **descomprimidas** (1,2–1,6 GB), así que no sirve.
- **Valor de referencia (exacto)**: suma del tamaño de las ruedas que fija cada archivo de `worker/requisitos/`, leída de los índices sin instalar nada. Para cada línea se elige, entre sus `--hash`, la rueda compatible con la plataforma. Tamaño: campo `size` de la API JSON de PyPI, o `Content-Length` de una petición HEAD en `download.pytorch.org`. Las ruedas se sirven tal cual (sin compresión HTTP), así que esa suma es lo que se transfiere. Funciona para las 5 combinaciones desde un solo runner Linux, igual que `inspeccionar_av.py`.
- **Contraste**: `runtime-real` mide además el tráfico de red real de la instalación con los contadores de la interfaz (`/proc/net/dev`, `netstat -ib`, `Get-NetAdapterStatistics`). Es aproximado porque el runner tiene otro tráfico.
- `medido: true` cuando ambas cifras coinciden con un margen del 10 %. El campo `mb_descargados.cache_uv` del JSON se renombra a `cache_uv_descomprimida` para no confundirlo.
- **Efecto secundario detectado**: el progreso de "Instalando componentes" compara el crecimiento de la caché (descomprimida) con `bytes_descarga`. Por eso se queda en el 99 % durante la mayor parte de la fase (ADR 0009 §2, revisión 2026-11-05). Se añade `bytes_cache` por perfil, que se usa solo como denominador del progreso. `bytes_descarga` sigue siendo la cifra que se muestra al usuario.
- Tareas [0055](../tareas/0055-manifiesto-espacio-requerido-y-bytes-medidos.md) (campo y valores) y [0058](../tareas/0058-runtime-real-bytes-de-red-pico-de-disco-y-calidad-en-cpu.md) (medición).

**3. Pico de disco en Linux CPU con Calidad**: basta con **4 GB** (decisión del usuario). No hace falta cambiar el modo de enlace de uv, pero sí medir el pico real.
- **Orden de las fases** en el gestor: componentes → `uv cache clean` → modelo. La caché y el modelo no coinciden en disco.
- **Peor caso, sin bloques compartidos**:
  - Fase de componentes: Python 0,10 + venv 1,62 + caché 1,62 ≈ **3,35 GB**.
  - Fase de modelo: 1,72 + 0,91 (Calidad, `.descarga`) ≈ **2,64 GB**.
  - Pico ≈ 3,35 GB, por debajo de 4 GB con un margen de 0,65 GB.
- **Caso real**: uv usa por defecto enlaces duros en Linux y Windows y clonación en APFS. La caché y el venv están en el mismo sistema de archivos (`runtime/`), así que el pico real debería rondar 1,8–2,7 GB. La caché casi igual al venv (1624,5 frente a 1618,7 MB) apunta a que son los mismos archivos contados dos veces.
- **Descartado**:
  - Forzar `UV_LINK_MODE=copy`: duplicaría el disco.
  - Forzar `hardlink`: ya es el valor por defecto, y uv recurre a copiar si el enlace falla.
  - Instalar sin caché (`--no-cache`): uv necesita la caché para descomprimir.
- **Medir**: `runtime-real` muestrea cada segundo el espacio libre durante la instalación y publica `pico_mb` = libre al inicio − libre mínimo. Criterio: pico + 0,5 GB ≤ `espacio_requerido`. Si no se cumple, se abre una pregunta.
- **Comprobación previa de espacio** (`comprobarEspacio`): resta el tamaño aparente de `runtime/`, que cuenta dos veces los enlaces duros. Es conservadora y se mantiene así.

**4. Modelo según el perfil o el modo** → lo resolvió el usuario: **Calidad siempre**. Detalle técnico:
- **Revisiones**: ADR 0004 y 0009 (2026-11-05) y ADR 0006 (`config.separacion`).
- **Ajustes**: el modo **Automático** desaparece porque ya no elige nada. `separacion.modo` vale `calidad` (por defecto) o `rapido`; un `automatico` guardado se lee como `calidad`.
- **Consentimiento para Rápido**: se guarda en `separacion.rapido_aceptado` (fecha ISO). El proceso principal **se niega** a descargar o usar Rápido sin ese consentimiento.
- **Cuándo se ofrece Rápido**: solo tras un fallo definitivo con Calidad.
  - En el primer arranque: verificación fallida tras el reintento automático, servidores no disponibles, o espacio suficiente para Rápido pero no para Calidad. **No** con `SIN_CONEXION`, porque Rápido también fallaría.
  - Al separar: `MEMORIA_INSUFICIENTE` tras los reintentos automáticos con Calidad, o `MODELO_NO_DISPONIBLE` si no se puede volver a descargar Calidad.
  - **Nunca se cambia a Rápido de forma automática.**
- **Sin comprobación previa de RAM**: el pico de 3,2 GB solo está medido en un equipo, y un falso positivo empujaría al usuario hacia el modelo sin licencia.
- **UX**: pregunta [0019](0019-calidad-por-defecto-y-rapido-con-consentimiento.md) (`Para: disenador-ux`).
- **Tareas**: [0056](../tareas/0056-modelo-calidad-por-defecto-y-modo-de-separacion.md) (modelo y modo) y [0057](../tareas/0057-alternativa-al-modelo-rapido-con-consentimiento.md) (consentimiento y oferta).

### Decisión adicional del usuario (2026-11-05)
**El modelo Rápido se ofrece solo tras un fallo de Calidad; no es elegible desde Ajustes.**
- Ajustes informa del modelo en uso y, si es Rápido, permite **volver a Calidad**.
- `separacion.modo` pasa a ser estado interno: el renderer no lo fija. Solo lo cambian `aceptarYUsarRapido` tras una oferta vigente y `volverACalidad` (tarea 0057).
- Aplicado en ADR 0004 y 0009 (Revisiones), `arquitectura.md`, `plan.md`, `backlog.md`, tareas 0056 y 0057 y pregunta 0019.
