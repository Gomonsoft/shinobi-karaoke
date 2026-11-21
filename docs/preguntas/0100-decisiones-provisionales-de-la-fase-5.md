# 0100 — Decisiones provisionales de la fase 5: cuenta tras ajustar silencios, Letra lista y exportación con movimiento reducido

- De: arquitecto
- Para: usuario
- Estado: Abierta
- Bloquea: no (opciones provisionales aplicadas en el [ADR 0018](../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md))

## Contexto

El ADR 0018 fija la arquitectura de la fase 5. Quedan tres detalles de producto. Para no parar he tomado la opción que me parece más razonable en cada uno. Si prefieres otra, el cambio es pequeño y no toca los datos guardados.

## Pregunta

### 1. «Ajustar los silencios» activa la cuenta 3·2·1 en toda la canción

Los comodines de espera no se guardan hueco a hueco. Se calculan solos para **cada** silencio entre líneas que sea igual o mayor que el umbral, así que no se desajustan al mover tiempos. Por eso, «activar la cuenta en ese hueco» se traduce en activar la casilla «Cuenta 3·2·1» de la canción (personalizada solo para esa canción, sin tocar el tema). La cuenta aparece en los silencios largos detectados y también en cualquier otro hueco largo de la canción.

- **A (provisional).** Activar «Cuenta 3·2·1» para la canción si no lo estaba. Si ya había puntos o barra, se mantienen y se añade la cuenta.
- B. No activar nada si la canción ya tenía algún comodín (por ejemplo, los puntos de siempre).
- C. Control hueco a hueco (elegir en qué silencios sale la cuenta). Requiere guardar marcas por hueco y queda fuera de esta fase. Está anotada como [propuesta 015](../propuestas/015-comodin-de-espera-hueco-a-hueco.md).

### 2. «Letra lista»: prueba desde el editor y vuelta a borrador

- **«Probar a pantalla completa» desde el editor**, en una canción con Letra lista. **Provisional: sin barrido, como en el reproductor**, porque el botón sirve para ver el resultado final. El panel de vista previa del editor siempre muestra el barrido para revisar la sincronía. La alternativa es mantener también el barrido en la prueba.
- **Cambiar de modalidad.** **Provisional:** una canción Lista puede pasar directamente a Letra lista y al revés, sin volver a borrador. «Volver a borrador» olvida la modalidad, y al marcarla otra vez se elige de nuevo.

### 3. Exportar con «movimiento reducido» activado en el sistema

Con la preferencia de movimiento reducido del sistema operativo, el editor y el reproductor muestran el degradado quieto. **Provisional:** la **exportación de vídeo** (fase 6) usa el movimiento configurado en el estilo aunque esa preferencia esté activa, porque el vídeo se verá en otros equipos. La alternativa es que el vídeo respete la preferencia de quien exporta, u ofrecer una casilla en el diálogo de exportación.

## Opción provisional tomada (si no bloquea)

1A, Probar a pantalla completa sin barrido, cambio directo de modalidad y exportación con el movimiento del estilo. Todo está anotado en el ADR 0018 §2, §5 y §6.1.

## Respuesta
