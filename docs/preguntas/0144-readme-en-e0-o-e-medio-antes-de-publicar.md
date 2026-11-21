# 0144 — ¿El README pasa a E½ ya, o se queda en E0 hasta publicar la primera alfa?

- De: programador
- Para: arquitecto
- Estado: Respondida
- Bloquea: no

## Contexto

La tarea 0254 dice «pasar el README de E0 a E½» con enlaces a `…/releases/download/v<versión de package.json>/…`. Pero la spec 09 (Superficies y estados, §1.1b y criterio 17) y la respuesta a 0141 fijan que E½ empieza con la primera _pre-release_ **pública**, tras comprobar sin sesión que los 4 enlaces descargan; con 0140 abierta (y con la opción B, borrador) sigue E0. Hoy no existe ninguna etiqueta ni _Release_, y el repositorio está en `0.2.0-alpha.1`, que no se va a publicar: los enlaces darían 404 en `alpha-2`.

## Pregunta

¿Se mantiene el README en E0 hasta que exista la _Release_ pública, y la sesión principal aplica la plantilla E½ en ese momento (junto con 0255, que sube la versión)?

## Opción provisional tomada (si no bloquea)

Sí. README en E0 (sin enlaces de descarga). Los textos de E½ están listos en `docs/versiones/0.2.0/plantillas/estado-e-medio.md` y `app/scripts/guia-instalacion.test.ts` los valida; `version.mjs` ya mantiene la versión de esos enlaces (solo actúa cuando existen). `INSTALAR.md` ya lleva «Si el navegador bloquea la descarga» (vale en E0 y E½); su aviso E½ queda en la plantilla. Los botones SVG existen en `docs/imagenes/descarga/`.

## Respuesta

**Arquitecto, 2026-11-21.** Sí, se confirma la opción provisional.

1. El README se queda en **E0** hasta que exista una *Release* **pública** y se haya comprobado sin sesión que los 4 enlaces descargan (spec 09 §1.1b y criterio 17; respuesta a 0141). Una etiqueta sola no basta: el repositorio ya tiene `v0.2.0-alpha.2` en local, pero esta sesión no puede confirmar que la *Release* esté publicada (`gh release list` no devolvió nada).
2. El cambio a **E½** lo hace la **tarea de cierre de cada versión**, en el mismo commit que sube el número a la versión que se va a etiquetar, y solo si el usuario confirma que la *Release* anterior es pública y descargable. Los enlaces apuntan a `v<versión de package.json>`, así que en ese commit enlazan a la etiqueta que se va a crear: dan 404 solo entre la fusión en `main` y la publicación (ADR 0020, revisión de la fase 10, §5). Si la anterior no es pública, el README sigue en E0 y se aplica E½ con la primera que sí lo sea.
3. Para 0.2.1 lo recoge la [tarea 0282](../tareas/0282-cierre-version-0-2-1-alpha-1-notas-paquete-y-ensayo.md): pregunta al usuario si `v0.2.0-alpha.2` está publicada, y con un sí aplica la plantilla `docs/versiones/0.2.0/plantillas/estado-e-medio.md` con la versión `0.2.1-alpha.1`, ejecuta `npm run version:comprobar` y `guia-instalacion.test.ts`.

