# 0036 — ¿Con qué número sale la primera versión y cómo se numeran las siguientes?
- De: arquitecto
- Para: usuario
- Estado: Abierta
- Bloquea: tarea 0142 (primera versión pública). **No bloquea** construir instaladores: los internos llevan 0.1.0 más el identificador del commit.

## Contexto
`app/package.json` y `worker/pyproject.toml` dicen **0.1.0** desde la Fase 1. El número se ve en Acerca de, en "Copiar información para soporte" y en la *Release*. No afecta al motor de audio: el que obliga a reinstalar componentes es el número del manifiesto, que es independiente.

## Pregunta
1. **¿Qué número lleva la primera versión pública?**
   - **A. 0.1.0**, sin cambiar nada (recomendada): el "0." ya indica que es una versión temprana.
   - **B. 0.9.0 o similar**, como versión de prueba antes del 1.0.
   - **C. 1.0.0**: se presenta como producto terminado.
2. **¿Cómo se numeran las siguientes?** Propuesta: `MAYOR.MENOR.CORRECCIÓN`, un solo número para app y worker, y una lista de cambios en cada *Release*.

## Opción provisional tomada (si no bloquea)
Se mantiene 0.1.0 y no se sube nada en esta fase.

## Respuesta
