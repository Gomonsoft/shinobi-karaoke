# 0016 — ¿Dejamos los Mac con procesador Intel fuera del MVP?
- De: arquitecto
- Para: usuario
- Estado: Respondida
- Bloquea: no para la Fase 2 (opción provisional: C); sí para publicar (página de descarga y requisitos)

## Contexto
El motor de separación (audio-separator 0.48.0) necesita PyTorch ≥ 2.3, y PyTorch dejó de publicarse para Mac Intel en la versión 2.2.2 (2024). ONNX Runtime también dejó de publicarse para Mac Intel tras la 1.23.2. Apple ha anunciado que macOS 26 es la última versión para Mac Intel. Detalle técnico y fuentes: `preguntas/0015`.

Los Mac Apple Silicon no tienen este problema (solo necesitan macOS 14, una actualización gratuita).

## Pregunta
¿Qué hacemos con los Mac Intel?

- **A. Soportarlos con versiones antiguas** (audio-separator antiguo + PyTorch 2.2.2). Coste alto: otro conjunto de dependencias que mantener y probar, sin actualizaciones, y PyTorch 2.2.2 tiene un fallo de seguridad conocido (CVE-2025-32434). **El arquitecto lo descarta.**
- **B. Soportarlos solo en modo Rápido**, con un motor propio sin PyTorch. Coste medio (~300 líneas de inferencia propias, pruebas y una CI en Mac Intel que GitHub va a retirar). Requiere macOS 13 en Intel. **Depende del modelo Rápido**, que sigue provisional porque sus pesos no declaran licencia (`preguntas/0012`): si hubiera que cambiarlo, los Mac Intel se quedarían sin separación.
- **C. No soportarlos en el MVP** (recomendada). Coste cero. Solo se publica el instalador para Apple Silicon y la página de descarga lo dice. Se puede añadir B más adelante si hay demanda y el modelo Rápido tiene licencia aclarada.

## Recomendación del arquitecto
**C**, y revisar B después del MVP si llegan peticiones ("Pedir soporte para mi equipo") y la consulta a UVR se resuelve.

## Opción provisional tomada (si no bloquea)
C: sin requisitos para `darwin-x64` (tarea 0030) y solo DMG arm64 (tarea 0025). Si eliges B, el arquitecto creará el ADR y las tareas correspondientes.

## Respuesta
Decisión del usuario (2026-11-04): **opción C — no soportar Mac Intel en el MVP**. Solo se publica el DMG arm64; en un Mac Intel la app muestra B6 («Tu equipo no es compatible todavía»). Se podrá reconsiderar después del MVP.
