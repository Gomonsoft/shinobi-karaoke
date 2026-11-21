# 0101 — Contratos técnicos de la fase 5 que las specs deben respetar o precisar

- De: arquitecto
- Para: disenador-ux
- Estado: Respondida
- Bloquea: no (el desglose de tareas usará los valores provisionales si la spec no dice otra cosa)

## Contexto

El [ADR 0018](../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md) define datos y comportamiento de degradados, comodines de espera, Letra lista y «Ajustar los silencios». Algunos valores son provisionales y la interfaz decide cómo exponerlos. Esta nota resume lo que las specs 06, 07, 02 y el sistema visual tienen que tener en cuenta.

## Pregunta

1. **Controles de degradado** (§1–§2):
   - El ángulo tiene efecto en el lineal (dirección) y en el cónico (inicio). En el radial no.
   - El centro (x, y entre 0 y 1) solo afecta al radial y al cónico.
   - El movimiento se guarda como `periodo_s` (entero de 10 a 120) y `sentido` (`horario` o `antihorario`). Lineal y cónico giran. El radial mueve el centro en una órbita de amplitud fija, 10 % del área (`AMPLITUD_ORBITA`, provisional).

   ¿Queréis exponer el periodo tal cual o como «Velocidad» con valores fijos (por ejemplo lenta 60 s, media 30 s, rápida 15 s)? ¿Hace falta el sentido? ¿Y la amplitud de la órbita?
2. **Cierre del cónico**: el último color funde hacia el primero de forma automática. Si la última parada está en 100 %, queda una costura nítida. ¿Se acepta este comportamiento o la spec prefiere otro?
3. **Aviso de contraste**: es uno solo, en el peor caso de toda la paleta (tramos y cierre). No se puede distinguir «solo durante el movimiento», así que ese texto no se usa. Ver §4 del ADR.
4. **Indicadores de espera** (§3):
   - La primera entrada siempre dura 4 s, desde que desaparece el título (inicio de la primera línea − 4 s) hasta ese inicio, y no usa el umbral.
   - ¿La barra se muestra también en la primera entrada?
   - El umbral se guarda en ms enteros de 1000 a 60 000. ¿Qué pasos ofrece el campo «Silencio mínimo»?
   - El fotograma da una `clave` que cambia al empezar la espera y en cada dígito, para anunciar hitos.
   - ¿Qué se anuncia exactamente y cómo se ve la barra con movimiento reducido?
5. **Reemplazo por canción**: la espera de la canción es un bloque completo («Personalizar indicadores» copia el del tema y «Volver a heredar indicadores» lo quita). Hay que mostrar la procedencia (`procedenciaEspera`). Al cambiar de tema o volver a heredar el tema, la personalización de la espera se conserva. «Personalizar» el estilo entero la integra. ¿Es correcto para la spec?
6. **Letra lista** (§5):
   - insignia y filtro en Biblioteca a partir de `modalidad`;
   - aviso de primera activación con `config.editor.omitir_aviso_letra_lista`;
   - motivo «Ir a la primera línea sin tiempo» con la lista de líneas de `LINEAS_SIN_INICIO`.

   Falta definir en la spec 06 cómo se pasa de Lista a Letra lista y al revés: el ADR permite el cambio directo (pregunta 0100 §2).
7. **«Ajustar los silencios»** (§6):
   - **Motivos de botón deshabilitado**: líneas sin inicio, picos generando, no disponibles o con error (con reintento), sincronización al ritmo activa y borrador de tema abierto.
   - **El aviso recibe**: líneas que cambian, fines fijados a mano que cambian, número de silencios largos y si se activará la cuenta 3·2·1.
   - Con cero cambios, el aviso informa sin crear un paso de deshacer.
   - ¿Se quiere un desglose por línea en el aviso? Los datos existen (`cambios`).

## Opción provisional tomada (si no bloquea)

Los valores del ADR 0018: periodo y sentido expuestos, amplitud fija, cierre suave, aviso único, barra también en la primera entrada y umbral con pasos de 500 ms. Sin desglose por línea en el aviso de silencios.

## Respuesta

Respuesta del diseñador UX (2026-11-20). Las specs de la fase 5 ([06](../ux/06-editor.md#fase-5-de-020--estilo-espera-y-letra-lista), [07](../ux/07-reproductor.md#fase-5-de-020--estilo-espera-y-letra-lista), [02](../ux/02-biblioteca.md#fase-5-de-020--estilo-espera-y-letra-lista) y [sistema visual](../ux/sistema-visual.md#020--estilo-espera-y-letra-lista-fase-5)) siguen el ADR 0018. Puntos concretos:

1. **Controles de degradado.** «Velocidad» con tres valores fijos: Lenta 60 s, Media 30 s (inicial) y Rápida 15 s. El **sentido no se expone**: se guarda `horario`; uno `antihorario` guardado a mano se respeta y se conserva. Un `periodo_s` distinto de 60/30/15 se muestra como cuarta opción «{n} s» seleccionada. La **amplitud** de la órbita radial no se expone (fija). El centro se elige en una cuadrícula 3 × 3 (0 / 0,5 / 1 por eje); un centro guardado fuera de esas posiciones se respeta sin celda elegida. El ángulo se muestra como «Ángulo» en el lineal, «Ángulo de inicio» en el cónico y se oculta (conservado) en el radial. Decisión de producto pendiente en [0110](0110-decisiones-provisionales-de-ux-de-la-fase-5.md) §1.
2. **Cierre del cónico.** Se acepta el cierre suave del ADR, con una petición: **en el cónico el editor reparte las paradas en i/n** (2 colores: 0 y ½; 3: 0, ⅓, ⅔; 4: 0, ¼, ½, ¾) para que el tramo de cierre mida lo mismo que los demás y no haya costura. Al volver a lineal o radial se reparten otra vez de 0 a 1. Una costura nítida solo aparece si la última parada está en 1 por un archivo editado a mano, sin aviso. Si esto obliga a cambiar la regla de «paradas repartidas por igual» en `shared/estilo.ts`, va en la tarea de controles de degradado.
3. **Aviso de contraste.** De acuerdo: aviso único sobre el peor caso de todos los tramos (y el cierre); no se usa ningún texto «durante el movimiento». Solo cambia la **presentación** en Letra lista: los avisos del color de lo ya cantado se muestran como informativos (`edi.contraste.soloEditor`), provisional en 0110 §2; la evaluación es la misma.
4. **Indicadores de espera.**
   - La **barra sí se muestra en la primera entrada** (los 4 s desde que desaparece el título).
   - `primera_entrada` se expone como casilla «Antes de la primera línea», marcada por defecto.
   - **Silencio mínimo**: 1,0–60,0 s, paso 0,5 s con [−]/[+] y ↑/↓, Re Pág/Av Pág ±5 s; se admite escribir cualquier décima.
   - **Anuncio**: uno solo al cambiar la `clave` por el **inicio** de una espera entre versos de ≥ 2 s («La letra sigue en {n} segundos.»), y una vez si una búsqueda cae dentro; los cambios de `clave` por dígito no se anuncian; tampoco la primera entrada (ya está el anuncio de inicio) ni la pausa.
   - **Barra con movimiento reducido**: sigue encogiéndose de forma continua (es contenido, como el barrido); solo se quitan las transiciones de entrada y salida de números y puntos.
   - Posiciones fijas: barra a `45 % − 0,9 × S`, cuenta centrada al 45 % con tamaño `S`, puntos donde están hoy.
5. **Reemplazo por canción.** Correcto tal como lo describe el ADR. En la interfaz: «Cambiar solo en esta canción» (copia el bloque completo) y «Usar los del tema» (lo quita), con la procedencia de `procedenciaEspera` («Del tema «…»» o «Propios de esta canción»). Se conserva al cambiar de tema o volver a heredar; «Personalizar» lo integra; salir de «Tema personalizado» no lo traslada.
6. **Letra lista.** Insignia «Letra lista» (icono `captions`, colores de Lista) en Biblioteca, que cuenta en el filtro *Listas*. Aviso con `config.editor.omitir_aviso_letra_lista`. Cambio de modalidad: desde el menú ⋯ de la cabecera del editor, «Cambiar a «Letra lista»…» (con el aviso si no está omitido) y «Cambiar a «Lista»» (sin diálogo), ambos con `biblioteca.marcarLista` y la modalidad nueva, sin salir del editor y sin entrar en el historial. No se ofrece en la Biblioteca (0110 §3). «Ir a la primera» usa la lista de `LINEAS_SIN_INICIO`.
7. **«Ajustar los silencios».**
   - Motivos de deshabilitado: los cinco del ADR, cada uno con su texto en el popover (`edi.silencios.falta.*`), con [Ir a la primera] y [Reintentar] donde aplica.
   - **Sí se quiere el desglose por línea**, plegado tras «Ver las líneas» (número, texto, fin anterior → nuevo, «fijado» si `eraFijado`, «silencio largo» si `huecoMs ≥ umbral`), con los datos de `cambios`.
   - Con `lineasCambiadas = 0` no se abre el aviso: toast informativo, sin paso de deshacer.
   - Si al confirmar el recálculo da recuentos distintos, no se aplica: el aviso muestra los nuevos con un mensaje y se confirma otra vez.
   - La elección hueco a hueco que había propuesto en la spec queda fuera (propuesta 015); se sigue 0100 §1 A.
