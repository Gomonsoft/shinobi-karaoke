# 0047 — Edición y borrado de temas asignados

- De: arquitecto y disenador-ux
- Para: usuario
- Estado: Respondida
- Bloquea: no.

## Contexto

El catálogo permite que artista, álbum o canción apunten a un tema. La canción conserva una instantánea si ya está reproduciéndose o exportándose. La confirmación puede mostrar cuántas canciones cambiarían según su herencia real. Ver [ronda cruzada UX](../versiones/0.2.0/discusion/r2-disenador-ux.md).

## Pregunta

¿Al editar el tema actualizamos todos sus usos efectivos en las sesiones futuras, o quieres que las canciones ya vinculadas conserven el estilo previo? Al eliminar un tema, ¿sus usos deben volver a heredar el estilo siguiente o quedarse con una copia de la apariencia previa?

## Propuesta para decidir

Propagar ediciones futuras con confirmación y opción «Guardar como tema nuevo». Al borrar, mostrar el reemplazo que heredaría cada grupo de canciones y pedir confirmación. La alternativa de congelar apariencia evita cambios visuales y requiere guardar copias propias.

## Respuesta
Es una gran pregunta, lo cierto es que a veces conforme saquemos features sobre temas seria genial la opcion de que ciertos temas puedan estar ligados a un estilo de ese tema en particular, entonces  vamos a dar la opcion de "Tema personalizado" o "Temas definidos" y si usa temas definidos en cazcada se heredara ese estilo si se edita, pero claro, la opcion  opción «Guardar como tema nuevo». es excelente para dejar el tema anterior y tener uno nuevo. Tambien es bueno poder seleccionar varias canciones desde la biblioteca y aplicar un tema a esas canciones tras una confiramcion con la lista. Al querer guardar en el tema ya guardado tambien hay que dar una aletar, no vaya a ser un error guardar directo en ese tema y en gaurdar como que esta notificacion/alerta pida el nombre del nuevo tema.

Qué aspecto conservan las canciones que usan un tema eliminado? Se aplicara ese tema esatico a la cancion y borrara el tema despues de alertar al usuario cuantas cancioenes se verfan afectadas y que pasara este comportamiento de desvinculacion del tema pero heredaran su estilo

### Respuesta ampliada

> El tema predeterminado se tiene que habilitar en ajustes, si se borra el comportamiento debe ser el mismo que hoy, asignar un tema aletorio a cada nueva cancion

## Decisión para el plan

Temas definidos con vínculo vivo y Tema personalizado como estilo propio. Confirmar al guardar sobre un tema existente y pedir nombre al guardar como tema nuevo. Permitir asignar a varias canciones tras confirmar la lista. Al borrar, informar el número efectivo y congelar su estilo en las canciones afectadas antes de eliminar el tema. El predeterminado se elige en Ajustes. Si se borra, asignar un tema aleatorio al crear cada canción nueva. El código del MVP usa un estilo fijo o configurado, así que la asignación aleatoria se incorpora en esta fase. La elección se conserva y el catálogo vacío usa el estilo incluido. Ver [ronda 4](../versiones/0.2.0/discusion/r4-arquitecto.md) y [plan de la alfa](../versiones/0.2.0/plan-2.md).
