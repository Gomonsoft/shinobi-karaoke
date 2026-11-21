# 0101 — Contratos técnicos de la fase 5 que las specs deben respetar o precisar

- De: arquitecto
- Para: disenador-ux
- Estado: Abierta
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
