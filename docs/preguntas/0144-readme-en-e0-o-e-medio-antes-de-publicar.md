# 0144 — ¿El README pasa a E½ ya, o se queda en E0 hasta publicar la primera alfa?

- De: programador
- Para: arquitecto
- Estado: Abierta
- Bloquea: no

## Contexto

La tarea 0254 dice «pasar el README de E0 a E½» con enlaces a `…/releases/download/v<versión de package.json>/…`. Pero la spec 09 (Superficies y estados, §1.1b y criterio 17) y la respuesta a 0141 fijan que E½ empieza con la primera _pre-release_ **pública**, tras comprobar sin sesión que los 4 enlaces descargan; con 0140 abierta (y con la opción B, borrador) sigue E0. Hoy no existe ninguna etiqueta ni _Release_, y el repositorio está en `0.2.0-alpha.1`, que no se va a publicar: los enlaces darían 404 en `alpha-2`.

## Pregunta

¿Se mantiene el README en E0 hasta que exista la _Release_ pública, y la sesión principal aplica la plantilla E½ en ese momento (junto con 0255, que sube la versión)?

## Opción provisional tomada (si no bloquea)

Sí. README en E0 (sin enlaces de descarga). Los textos de E½ están listos en `docs/versiones/0.2.0/plantillas/estado-e-medio.md` y `app/scripts/guia-instalacion.test.ts` los valida; `version.mjs` ya mantiene la versión de esos enlaces (solo actúa cuando existen). `INSTALAR.md` ya lleva «Si el navegador bloquea la descarga» (vale en E0 y E½); su aviso E½ queda en la plantilla. Los botones SVG existen en `docs/imagenes/descarga/`.

## Respuesta
