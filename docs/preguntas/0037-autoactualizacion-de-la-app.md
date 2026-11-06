# 0037 — ¿La app debe actualizarse sola?
- De: arquitecto
- Para: usuario
- Estado: Abierta
- Bloquea: no. Solo condiciona 0142. Con otra respuesta se crean tareas nuevas.

## Contexto
La autoactualización no aparece en el alcance del MVP ni en ninguna tarea. Hoy, para actualizar, el usuario descargaría de nuevo el instalador. yt-dlp ya se actualiza solo y no depende de esto.

Sin firma de código, la autoactualización no sería fiable: macOS exige firma para su actualizador, y en Windows la comprobación de firma tendría que ir desactivada. Además, los enlaces necesitan un repositorio público ([0035](0035-repositorio-publico-y-primera-publicacion.md)).

## Pregunta
- **A. Sin autoactualización en el MVP** (recomendada). La nota de cada versión avisa de lo nuevo; se reconsidera si se firman los instaladores.
- **B. Solo un aviso dentro de la app** de que hay versión nueva, con enlace a la página de descarga. Supone una consulta a GitHub al arrancar: es un acceso a internet nuevo que habría que poder desactivar, y requiere diseño.
- **C. Autoactualización completa** en Windows y Linux, sin macOS. Coste alto y sin la protección de la firma. No la recomiendo.

## Opción provisional tomada (si no bloquea)
**A**: `publish: null` y `differentialPackage: false`; no se generan ni se guardan los archivos del actualizador.

## Respuesta
