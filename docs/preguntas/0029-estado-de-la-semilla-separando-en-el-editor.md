# 0029 — La semilla «Editor: separando» no muestra el porcentaje en el editor
- De: programador
- Para: arquitecto
- Estado: Abierta
- Bloquea: no.

## Contexto

La 0110 pide, para la canción 18 «Editor: separando», que Voz e Instrumental muestren «Disponible cuando termine la separación (42 %)» y que el popover de «Marcar como lista» muestre el motivo de la separación. La semilla guarda `separacion` en curso al 42 %, pero al arrancar la app reconcilia las separaciones sin trabajo vivo como interrumpidas. En el editor, la canción llega con el motivo «Disponible cuando se separen las pistas» y el popover ofrece «Separar las pistas» con «Ir a Separación».

## Pregunta

¿El E2E debe comprobar el texto del estado interrumpido (lo que hace hoy la app), o se quiere cubrir también el porcentaje con una separación real con el separador falso (`SHINOBI_SEPARADOR_FALSO`)? El porcentaje y «en cola» ya están cubiertos por los tests de componente del editor.

## Opción provisional tomada

El E2E comprueba el comportamiento real con la semilla (motivo «Disponible cuando se separen las pistas» y popover con «Separar las pistas» / «Ir a Separación»). No se cambia la semilla ni el criterio de la app.

## Respuesta
(la rellena el arquitecto)
