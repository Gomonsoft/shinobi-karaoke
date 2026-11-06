# 0038 — ¿Cómo lanzamos el workflow la primera vez y quién hace la prueba manual?
- De: arquitecto
- Para: usuario
- Estado: Abierta
- Bloquea: el cierre de 0136 y 0137 (su ejecución en GitHub) y la tarea 0139 (prueba manual y capturas). **No bloquea** escribir el código de ninguna tarea.

## Contexto
**Workflow.** GitHub solo deja lanzar a mano un workflow si su archivo ya está en la rama principal (`main`), y hoy no está. Una vez allí, se puede lanzar sobre cualquier rama con el archivo de esa rama. Por eso, sin hacer nada, los instaladores no se podrían construir en GitHub hasta fusionar toda la fase.

Cada ejecución completa consume minutos de macOS, que en un repositorio privado cuentan 10 veces, y la organización está en el plan gratuito. Uso aproximado por ejecución: varias decenas de minutos reales por SO; se medirá en la primera.

**Prueba manual.** Hay cosas que ningún servidor de GitHub puede probar: los avisos de SmartScreen y Gatekeeper, la instalación real con doble clic, el primer arranque con el modelo real y las capturas. **macOS 14, nuestro mínimo, ya no existe en GitHub** (retirado el 2026-11-02), y tampoco hay Windows 10 u 11 de escritorio.

## Pregunta
1. **¿Cómo se lanza por primera vez?**
   - **A. Fusionar en `main` solo un workflow mínimo**, que no hace nada más que existir, antes de cerrar la fase (recomendada). Permite probar en la rama y corregir antes de fusionar el resto. Es la excepción a "fusionar a `main` al cerrar cada fase".
   - **B. Esperar a fusionar la fase entera**, y corregir después con otra rama. Mantiene la regla, pero la fase se cerraría sin haber probado los instaladores.
   - **C. Una etiqueta de prueba, sin tocar `main`** (añadida por la sesión principal). GitHub ejecuta un workflow con disparador de etiqueta usando el archivo del commit etiquetado, así que bastaría con añadir `push: tags: ["empaquetado-prueba-*"]` y crear esa etiqueta sobre `fase-7-empaquetado`. No se ejecuta en cada push de una rama. Hay que retocar el ADR 0013 y confirmar que aceptas subir esa etiqueta, porque de momento solo se publica la rama.
2. **¿Quién hace la prueba manual y con qué equipos?** Necesitamos, idealmente:
   - un Mac con chip Apple con macOS 14, y otro (o el mismo, actualizado) con macOS 15 o la versión actual. Consta un MacBook Air M1 usado en las mediciones: ¿qué macOS tiene?, ¿se puede usar sin actualizarlo?;
   - Windows 10 y Windows 11, en español;
   - Ubuntu LTS de escritorio, y si es posible Debian y Linux Mint.
3. Si falta algún equipo, **¿se publica sin probar en él?** Propuesta: como mínimo, macOS en la versión que haya disponible, Windows 11 y Ubuntu LTS, y lo no probado se declara en las notas de la versión.

## Opción provisional tomada (si no bloquea)
El código se escribe y se prueba en local. 0136 y 0137 quedan `En curso` hasta poder ejecutarse. 0139 queda `Bloqueada`.

## Respuesta
