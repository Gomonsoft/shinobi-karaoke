# 0110 — Decisiones provisionales de UX de la fase 5: velocidad del fondo, avisos en Letra lista y dónde se cambia la modalidad

- De: disenador-ux
- Para: usuario
- Estado: Abierta
- Bloquea: no (opciones provisionales aplicadas en las specs [06](../ux/06-editor.md#fase-5-de-020--estilo-espera-y-letra-lista), [07](../ux/07-reproductor.md#fase-5-de-020--estilo-espera-y-letra-lista) y [02](../ux/02-biblioteca.md#fase-5-de-020--estilo-espera-y-letra-lista))

## Contexto

La fase 5 añade degradados con movimiento, indicadores de espera, «Letra lista» y «Ajustar los silencios». El arquitecto ya preguntó en [0100](0100-decisiones-provisionales-de-la-fase-5.md) por la cuenta tras ajustar los silencios, «Probar a pantalla completa» en Letra lista y el cambio directo entre Lista y Letra lista. Aquí quedan tres detalles de interfaz. Para no parar he tomado la opción que me parece más sencilla. Cambiarlos no toca los datos guardados.

## Pregunta

### 1. Cómo se elige la velocidad del fondo en movimiento

El [ADR 0018](../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md) guarda cuántos segundos dura una vuelta (de 10 a 120) y el sentido (horario o antihorario).

- **A (provisional).** Tres velocidades: «Lenta» (una vuelta cada 60 s), «Media» (30 s, la inicial) y «Rápida» (15 s). Siempre en sentido horario; el sentido no se ofrece.
- B. Un deslizador de segundos por vuelta (10–120) y un selector de sentido.
- C. Las tres velocidades más un selector de sentido.

### 2. Avisos del color de lo ya cantado en una canción «Letra lista»

En Letra lista el color de lo ya cantado solo se ve en el editor (el reproductor y el video no tienen barrido).

- **A (provisional).** En el editor, los avisos sobre ese color pasan de «⚠ Difícil de leer» a una nota informativa: «Solo afecta al editor: esta canción se reproduce sin barrido». El aviso sobre el color de la letra sigue igual.
- B. Mostrar los avisos igual que en cualquier canción.

### 3. Dónde se cambia entre «Lista» y «Letra lista»

- **A (provisional).** Solo en el editor (menú ⋯ de la cabecera: «Cambiar a «Letra lista»…» y «Cambiar a «Lista»»). En la Biblioteca solo se ve la insignia.
- B. También desde el menú ⋯ de la tarjeta en la Biblioteca.

## Opción provisional tomada (si no bloquea)

1A, 2A y 3A.

## Respuesta
