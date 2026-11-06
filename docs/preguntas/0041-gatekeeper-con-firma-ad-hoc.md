# 0041 — ¿Qué ve realmente en macOS quien descarga una app con firma *ad hoc*?
- De: disenador-ux
- Para: arquitecto
- Estado: Respondida en lo técnico; puntos 2 a 5 por medir con un Mac real en la tarea 0139
- Bloquea: no en la Fase 7; sí para dar por definitiva la guía de macOS de `ux/09`, antes de la primera versión pública

## Contexto
`ux/09` promete el camino "Aceptar → Privacidad y seguridad → Abrir igualmente". Apple lo documenta para apps de un desarrollador que no puede verificar, pero también dice que macOS avisa de que una app "podría estar dañada" si el software se ha modificado. Hay informes de terceros, de poca autoridad y no específicos de este caso, con apps descargadas en chip Apple que muestran "está dañada", una alerta que puede no ofrecer ese camino. Además, la tarea 0025 aplica los *fuses* en `afterPack`, lo que modifica el binario.

## Pregunta
1. ¿Queda garantizado que la firma *ad hoc* es válida tras aplicar los *fuses* (orden de `afterPack` y firma)? ¿Lo comprueba alguna prueba?
2. ¿Puede el programador probar en la tarea 0025 un DMG **descargado con un navegador** (con el atributo de cuarentena, no copiado desde el build), en macOS 14, en 15 y en la versión actual, y anotar el texto literal y los botones de cada alerta?
3. Si el resultado es "está dañada", ¿qué alternativa técnica hay? Quitar la cuarentena desde Terminal no es razonable para un usuario no técnico y debilita una protección: si fuera la única vía, se elevaría al usuario como decisión de producto, sin escribirlo antes en la guía.
4. ¿Qué pasa si se abre la app directamente desde la ventana del DMG, sin arrastrarla a Aplicaciones? ¿Funciona el primer arranque o hay que avisar?
5. Si hay un Mac Intel disponible: ¿qué mensaje muestra macOS al abrir la app solo arm64? Si no lo hay, ¿basta con el texto genérico de la guía?

## Opción provisional tomada (si no bloquea)
La guía mantiene el camino de "Abrir igualmente". La entrada "está dañada" solo sugiere volver a descargar y abrir una incidencia, sin comandos de Terminal.

## Respuesta
(arquitecto, 2026-11-06; ADR 0012 §3 y §4. **Nada de macOS se ha podido ejecutar todavía**: esto sale del código de electron-builder 26.18.0, y los puntos 2 a 5 quedan por medir.)

1. **Firma tras los *fuses***. Ya no se aplican en `afterPack`, sino con la opción `electronFuses` de electron-builder. El orden es el mismo: empaquetar → integridad en `Info.plist` → *fuses* → firma de todo el paquete con `mac.identity: "-"`, `hardenedRuntime: false`. **Lo comprueba una prueba** (0131, en el runner de macOS): `codesign --verify --deep --strict`, y `flags=0x2(adhoc)` en la app y en `bin/uv`. Además, el worker deja de escribir `__pycache__` dentro de la app (0128), que rompería el sello después de instalar.
2. **Prueba con un DMG descargado con navegador**: sí, en la tarea 0139, anotando texto y botones. Tiene que ser manual: un runner no reproduce la cuarentena de una descarga real ni muestra la alerta. **En GitHub ya no hay macOS 14** (retirado el 2026-11-02), el mínimo que soportamos: hace falta un Mac real. Quién y con qué equipos: [`0038`](0038-primera-ejecucion-del-workflow-y-prueba-manual.md).
3. **Si sale "está dañada"**. Los informes de terceros, de poca autoridad, apuntan a que esa alerta aparece con firma **inválida o ausente** y que una *ad hoc* válida permite "Abrir igualmente"; por eso se firma todo el paquete y no se usa `identity: null`. Si aun así aparece:
   1. se revisa que el sello sea válido en el Mac de destino;
   2. si es válido y la alerta no ofrece salida, **se detiene la publicación en macOS**, y se eleva al usuario. Las opciones reales serían Developer ID, que cambia `preguntas/0001`, o no publicar macOS. `xattr` en Terminal no se escribe en la guía.
4. **Abrir desde la ventana del DMG sin arrastrar**. Sin probar. Técnicamente debería funcionar: los datos y el runtime van fuera de la app, y el DMG de solo lectura ya no recibe escrituras gracias a 0128. Pero la app se cerraría al expulsar el DMG. Se mide en 0139. Mantén "arrastra a Aplicaciones" como único camino.
5. **Mac Intel**: no hay Mac Intel disponible en los runners que se usan. El binario es solo arm64 (0131 lo comprueba con `lipo`), así que macOS no lo abrirá. Basta el texto genérico, salvo que P9 dé otra cosa.

**Hallazgo nuevo**: `LSMinimumSystemVersion` de Electron 45.2.2 es **13.0** (leído del `Info.plist` del zip oficial). No lo subimos, como pide `preguntas/0015`, pero:
- **B6b solo se puede ver en macOS 13.** Un Mac con chip Apple y macOS 12 o anterior no llega a abrir la app: lo rechaza el sistema.
- La entrada de `ux/09` "macOS dice que la app no es compatible con este Mac → tu Mac tiene procesador Intel" **es falsa en ese caso**.

**Impacto en `ux/09`** (a tu cargo):
- Esa entrada debe contemplar los dos casos: si "Acerca de este Mac" dice Chip, hay que actualizar macOS (enlace de Apple); si dice Procesador Intel, no es compatible.
- ⟦R0041⟧ del paso 2 y de "está dañada" sigue provisional hasta 0139.
- Los criterios de `ux/01` de B6b (macOS 13.6) siguen siendo válidos.
