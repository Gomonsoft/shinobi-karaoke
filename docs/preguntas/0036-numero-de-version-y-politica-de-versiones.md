# 0036 — ¿Con qué número sale la primera versión y cómo se numeran las siguientes?
- De: arquitecto
- Para: usuario
- Estado: Abierta
- Bloquea: no. Hay opción provisional (ADR 0020 §2, 2026-11-20); la tarea 0142 sigue pidiendo tu confirmación antes de la primera versión estable.

## Contexto
`app/package.json` y `worker/pyproject.toml` dicen **0.1.0** desde la Fase 1. El número se ve en Acerca de, en "Copiar información para soporte" y en la *Release*. No afecta al motor de audio: el que obliga a reinstalar componentes es el número del manifiesto, que es independiente.

## Pregunta
1. **¿Qué número lleva la primera versión pública?**
   - **A. 0.1.0**, sin cambiar nada (recomendada): el "0." ya indica que es una versión temprana.
   - **B. 0.9.0 o similar**, como versión de prueba antes del 1.0.
   - **C. 1.0.0**: se presenta como producto terminado.
2. **¿Cómo se numeran las siguientes?** Propuesta: `MAYOR.MENOR.CORRECCIÓN`, un solo número para app y worker, y una lista de cambios en cada *Release*.

## Opción provisional tomada (si no bloquea)
~~Se mantiene 0.1.0 y no se sube nada en esta fase.~~ Sustituida el 2026-11-20, al pedir el usuario una *Release* por versión desde 0.2.0 y no detener el trabajo ([ADR 0020](../adr/0020-publicacion-en-github-releases-y-politica-de-versiones.md) §2):
- **Un solo número** para app y worker, en SemVer `MAYOR.MENOR.CORRECCIÓN`, con versiones previas numeradas `-alpha.N`, `-beta.N` y `-rc.N` (en el worker, su forma PEP 440: `aN`, `bN`, `rcN`).
- **0.1.0 no se publica.** La primera *Release* es `v0.2.0-alpha.1` (*pre-release*); cada corrección de la alfa sube `N`. La etiqueta `v0.2.0-alpha` del plan pasa a ser la última `v0.2.0-alpha.N`. `0.2.0` sin sufijo, solo si lo decides.
- Se sube con `npm run version:subir -- <versión>` (tarea 0191) y el workflow comprueba que la etiqueta coincide.
- Cada *Release* lleva su lista de cambios (`docs/versiones/<X.Y.Z>/notas/<versión>.md` o, si falta, la que genera GitHub).

Si respondes otra cosa (p. ej., 1.0.0 o numeración distinta), basta con otro `version:subir`; nada más depende del número.

## Respuesta
