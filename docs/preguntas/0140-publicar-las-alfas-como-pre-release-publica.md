# 0140 — ¿Las alfas de 0.2.0 se publican ya como *pre-release* pública, aunque falten comprobaciones de la tarea 0142?
- De: arquitecto
- Para: usuario
- Estado: Abierta
- Bloquea: no bloquea ninguna tarea (0191–0195 se implementan y ensayan sin publicar). Solo condiciona **la primera etiqueta real** `v0.2.0-alpha.1`.

## Contexto
Pediste que, desde 0.2.0, cada versión tenga su *Release*. El [ADR 0020](../adr/0020-publicacion-en-github-releases-y-politica-de-versiones.md) lo resuelve así: al subir una etiqueta `v…`, el workflow construye y prueba los instaladores de los 3 sistemas y crea la *Release* con los instaladores, `SHA256SUMS.txt` y las notas. Si la versión lleva sufijo (`-alpha.N`, `-beta.N`, `-rc.N`), la marca como **versión preliminar** (*pre-release*); GitHub no la muestra como "Latest".

La [tarea 0142](../tareas/0142-primera-version-publica.md) ponía una "puerta" antes de la primera publicación que aún no está cerrada:
- [0044](0044-control-inteligente-de-aplicaciones-en-windows.md): qué decir a quien tiene el Control inteligente de aplicaciones de Windows (sin firma no podrá instalar).
- [0045](0045-appimage-sin-sandbox-en-ubuntu.md): el AppImage arranca sin el sandbox del sistema en Ubuntu 24.04 o posterior.
- 0139 y las guías manuales: SmartScreen, Gatekeeper y el primer arranque real solo se han probado en parte (Windows prioritario; macOS y Linux sin equipo confirmado, [0038](0038-primera-ejecucion-del-workflow-y-prueba-manual.md)).

## Pregunta
1. **¿Se publican las alfas aunque la puerta no esté cerrada?**
   - **A. Sí, como *pre-release* pública**, con una sección "Sin probar en esta versión" en sus notas y los textos provisionales de 0044 (A) y 0045 (A) (recomendada). Es lo que entiendo de tu petición; quien llega a la página ve que es una alfa y qué no está probado.
   - **B. Sí, pero en borrador**: el workflow deja la *Release* preparada y solo la ves tú hasta que la publiques a mano con un clic. Se activa con la variable del repositorio `PUBLICACION_BORRADOR = true`, sin cambiar código.
   - **C. No hasta cerrar la puerta de 0142**: no se sube ninguna etiqueta hasta entonces.
2. **¿Activas las *immutable releases* del repositorio?** (Settings → General → Releases). Recomendado: una *Release* publicada no puede cambiar sus archivos ni mover su etiqueta, y GitHub añade una atestación que cualquiera puede verificar (`gh release verify`). A cambio, un error se corrige publicando la siguiente alfa, no reemplazando archivos.
3. **¿Proteges las etiquetas `v*`?** Recomendado: una regla del repositorio (Settings → Rules → Rulesets, objetivo "Tags", patrón `v*`) que solo permita a administradores crearlas, moverlas o borrarlas.

## Opción provisional tomada (si no bloquea)
Se implementa todo y se ensaya sin publicar (tarea 0195). No se sube ninguna etiqueta `v*` hasta tu respuesta. Si eliges B, basta con crear la variable antes de la primera etiqueta.

## Respuesta
