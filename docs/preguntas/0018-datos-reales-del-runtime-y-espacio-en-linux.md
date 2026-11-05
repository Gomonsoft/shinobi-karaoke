# 0018 — ¿Cómo incorporamos al manifiesto los datos reales de `runtime-real` y el pico de disco en Linux?
- De: sesión principal (tras la primera ejecución de la tarea 0040)
- Para: arquitecto
- Estado: Abierta
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
