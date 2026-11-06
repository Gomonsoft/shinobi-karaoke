# 0026 — Dos detalles de texto y color del editor que no fija `ux/06`
- De: arquitecto
- Para: disenador-ux
- Estado: Respondida
- Bloquea: no. Las tareas 0097 y 0105 llevan una opción provisional.

## Contexto
Al desglosar la Fase 5 (tareas 0090–0111, ADR 0010) quedan dos puntos de presentación que la spec no concreta.

## Pregunta
1. **Letra cambiada mientras el editor estaba abierto.** Si el main rechaza el guardado de tiempos con `LETRA_DESACTUALIZADA` (la letra guardada ya no tiene los mismos elementos que el editor; no debería pasar con una sola ventana, pero es la red de seguridad), el editor recarga la canción y pierde el historial de deshacer. ¿Qué texto se muestra?
2. **"El mismo color con 30 % más de luminosidad"** (pasar a degradado y "+ Añadir color"). Lo interpretamos como **+30 puntos de L en HSL, con tope en 100** (`#1B1033` → un violeta medio). ¿Es eso, o se prefiere multiplicar L por 1,3 o usar otra regla (p. ej. en OKLCH)? Con colores muy oscuros, multiplicar casi no cambia nada.

## Opción provisional tomada (si no bloquea)
1. Toast `info`: "La letra ha cambiado: hemos vuelto a cargarla." (tarea 0105).
2. +30 puntos de L en HSL, con tope en 100 (`aclarar30`, tarea 0097).

## Respuesta
**Respondida por el diseñador UX (2026-11-05).** Recogido en [`ux/06-editor.md`](../ux/06-editor.md) (tabla "Guardado, borrador y lista", "Variante de luminosidad" en Estilo, microcopy y criterios 46–47).

1. **Letra cambiada: toast `aviso` (no `info`), persistente, clave `edi.toast.recargada`:**
   > La letra ha cambiado fuera del editor y la hemos vuelto a cargar. Puede que tus últimos ajustes de tiempos no se hayan guardado: revísalos.

   Es `aviso` y no se cierra solo porque el usuario puede haber perdido trabajo y hay que verlo. Comportamiento que acompaña al texto:
   - recarga desde disco y descarta los tiempos pendientes y el historial (⟲ ⟳ `disabled`);
   - conserva la pista, la velocidad y la posición, en pausa; sale del modo sincronizar si estaba en él;
   - conserva la selección si la línea (por `id`) sigue existiendo; si no, selecciona la primera sin inicio (o la primera línea);
   - no cuenta como fallo de guardado: ni "⚠ No se pudo guardar" ni reintentos; el indicador queda en "✓ Guardado";
   - el estilo (`biblioteca.guardarEstilo`) va aparte y no se ve afectado.
2. **Ni +30 con tope en 100 ni ×1,3: L ± 30 en HSL ("variante de luminosidad").** Se conservan H y S. Si L ≤ 70, L + 30; si L > 70, **L − 30**. Con tope en 100, un color claro (L > 70) daría blanco, y en un fondo ya blanco la parada nueva sería idéntica y el degradado no se vería. Multiplicar falla con los oscuros, como decís. OKLCH sería más uniforme a la vista, pero aquí no hace falta: solo es un punto de partida que el usuario cambia, y el aviso de contraste se reevalúa igualmente. L se calcula sin redondear y luego se redondea cada canal.
   Ejemplos para el test (±1 por canal):
   - `#1B1033` → `#5935A7`;
   - `#000000` → `#4D4D4D`;
   - `#FFFFFF` → `#B3B3B3`.

**Impacto en las tareas (no editadas):**
- **0097**: `aclarar30` cambia de regla (oscurece si L > 70) y conviene renombrarla, p. ej. `variarLuminosidad30`. Afecta a la definición (línea 19), a `aDegradado` (línea 21) y al test (línea 49), que debe comprobar los tres ejemplos.
- **0108** (líneas 12 y 20): solo cambia el nombre de la función si se renombra.
- **0105**, punto `LETRA_DESACTUALIZADA` (línea 79):
  - el toast deja de ser de información y pasa a `aviso` persistente, con la clave `edi.toast.recargada` y el texto de arriba;
  - hay que añadir pausa en la misma posición, salir del modo sincronizar y conservar la selección por `id`;
  - se verifica con el criterio 46 de `ux/06`.
- **0104** (`alDesactualizada`, sin reintentos) y **0093** (`cargar` sin historial) ya encajan. Hay que comprobar que en ese caso el indicador queda en "✓ Guardado" y no en error.
- El mensaje interno de 0091 ("La letra ha cambiado desde que se abrió el editor.") no se muestra al usuario.
- **0105** ya usa la variante única de `edi.velocidad.tooltip`: no cambia.
