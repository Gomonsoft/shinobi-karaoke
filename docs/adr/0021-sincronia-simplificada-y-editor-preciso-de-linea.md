# 0021 — Sincronía simplificada y editor preciso de línea: palabras hechas a mano, descarte al editar, bucle con márgenes y velocidad con tono conservado

- Estado: Aceptado (los puntos «provisional» están en [0148](../preguntas/0148-decisiones-provisionales-del-arquitecto-de-0-2-1.md); responde a [0145](../preguntas/0145-contratos-de-las-fases-8-y-9-para-las-specs.md) del diseñador)
- Fecha: 2026-11-21
- Paso del pipeline: 3 (letra), 4 (editor) y, por el render compartido, 5 y 6 (reproductor y exportación)
- Versión: 0.2.1, fases 8 y 9 ([plan](../versiones/0.2.1/plan-3.md), [feedback de alpha.1](../versiones/0.2.0/feedback-alpha-1.md)). Specs: [06 · Fases 8 y 9](../ux/06-editor.md#fase-8-de-021--sincronía-y-editor-más-simples), [07 · Fase 8](../ux/07-reproductor.md#fase-8-de-021--sin-palabras-importadas-ni-desplazamiento-y-barra-de-carga), [02 · Fase 8](../ux/02-biblioteca.md#fase-8-de-021--estados-y-fecha-de-añadido)

## Contexto

Al probar 0.2.0-alpha.1, el usuario vio que el barrido de las líneas con tiempos por palabra importados (LRCLIB y LRC mejorado) deja de coincidir con la línea en cuanto se corrige. La causa está en datos y código (feedback §1.4):

- Al mover el **inicio**, las palabras se desplazan con la línea (`moverInicioLinea`, `app/src/shared/letra.ts:278`). Al fijar el **fin** no cambian. El barrido pinta cada palabra con sus tiempos (`render.ts:148`).
- En la biblioteca del usuario, Final Ruin (35 de 36 líneas con palabras), Valiente (69 de 71) y Sinmigo (28 de 28) terminan el barrido hasta 4 s antes o después del fin de la línea.

El plan 0.2.1 aprobado decide (decisiones D2 y D3 del feedback):

1. Los tiempos por palabra **importados** dejan de usarse (editor, reproductor, sesión y exportación) y dejan de importarse. **No se borran del archivo** hasta que el usuario edita la línea.
2. Cualquier edición de inicio o fin de una línea descarta sus tiempos por palabra.
3. Se retiran el atajo S y el desplazamiento de toda la letra (panel y teclas `,` `.`). `offset_ms` se conserva y se respeta.
4. Fase 9: un **editor preciso de línea** en una ventana flotante dentro del editor, donde nacen los tiempos por palabra **hechos a mano**, con bucle con márgenes, velocidad de escucha, forma de onda ampliada y edición rápida del texto. Estas palabras sí se pintan.

Restricciones heredadas:

- `cancion.esquema` sigue en 1 y una biblioteca de 0.2.0 se abre sin reescribirse ([ADR 0006](0006-persistencia-y-modelo-de-datos.md)).
- Un solo escritor de `letra` (`ServicioLetras`); el contrato de tiempos no cambia textos ([ADR 0010](0010-editor-motor-de-audio-reloj-y-guardado.md) §2); historial de instantáneas en el renderer (§3).
- Un solo reloj de audio por vista: `MotorAudio` sobre `AudioBufferSourceNode` con `getOutputTimestamp` (ADR 0010 §1) y bucle nativo `loopStart`/`loopEnd` ([ADR 0015](0015-linea-de-tiempo-y-picos-de-voz.md)). Error de marca ≤ 20 ms a cualquier velocidad.
- CSP del renderer `script-src 'self'` sin `'wasm-unsafe-eval'` ([ADR 0008](0008-seguridad-de-electron-y-protocolos-propios.md)).
- Render compartido `render.ts` + `PantallaLetra` para editor, reproductor, sesión y exportación ([ADR 0011](0011-reproductor-pantalla-completa-y-reutilizacion-del-motor.md), [ADR 0019](0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md) §2).

## Alternativas consideradas

### 1. Cómo distinguir las palabras hechas a mano de las importadas

| Opción | Pros | Contras |
|---|---|---|
| **A. Campo opcional por línea `origen_palabras: "manual"`; ausente = importadas** | Un solo campo, sin subir el esquema. Las canciones de 0.2.0 no cambian. 0.2.0 lo ignora al leer (Zod `z.object` descarta claves desconocidas). | Si 0.2.0 reescribe esa línea, pierde el campo y las palabras pasan a contar como importadas (se dejan de pintar en 0.2.1, no se pierden). |
| B. Campo por palabra | Mezclar orígenes en una línea. | Ningún caso de uso: una línea se aplica entera desde la ventana. |
| C. Borrar las importadas al abrir (migración) | Datos limpios. | Reescribe canciones no tocadas. Contradice D2. |
| D. Lista aparte `palabras_manuales` | Las importadas quedan intactas. | Dos listas con los mismos invariantes; render y guardado tienen que elegir siempre. |
| E. Subir `cancion.esquema` a 2 | Semántica explícita. | 0.2.0 valida `esquema: 1` como literal: vería la canción dañada. |

El diseñador proponía `palabras_origen`; se usa `origen_palabras` (mismo significado; nombre definitivo).

### 2. Fin efectivo de una línea con palabras importadas

| Opción | Pros | Contras |
|---|---|---|
| **A. `finEfectivo` solo cuenta las palabras visibles (manuales válidas)** | Descartar unas palabras importadas no cambia nada visible, así que se borran sin aviso (spec 06, 8.1). Lectura literal del plan («dejan de usarse»). Sin reglas extra al descartar. | Cambia, una vez, el fin de las líneas con fin automático y palabras importadas (la mayoría traen fin fijado). No cambia ningún archivo. |
| B. `finEfectivo` no cambia y, al descartar, se fija el fin que se veía | Conserva el fin de esas líneas. | Las palabras importadas seguirían decidiendo algo visible; hace falta «fijar al descartar» en cada operación. |

### 3. Velocidad lenta y tono

| Opción | Licencia | Pros | Contras |
|---|---|---|---|
| A. `playbackRate` del `AudioBufferSourceNode` (lo actual) | Chromium | Ya existe, reloj verificado a 0,5× y 0,75×. | **El tono cambia**: el nodo remuestrea ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/playbackRate)). A 0,5× la voz baja una octava. |
| B. `<audio>` con `preservesPitch` | Chromium | Conserva el tono; *Baseline* desde 2023. | Es otro reloj: `currentTime` avanza a saltos sin relación documentada con la salida. Ya descartada en ADR 0010 §1 B. |
| C. *Time-stretch* en tiempo real en un `AudioWorklet`: Signalsmith Stretch (MIT, WASM) o `@soundtouchjs/audio-worklet` (MPL-2.0) | MIT / MPL-2.0 | Tono conservado, calidad alta (Signalsmith). | Signalsmith compila WASM: exige `'wasm-unsafe-eval'` en la CSP (ADR 0008). La latencia del procesador desplaza el reloj audible y no se prueba en Vitest. |
| **D. Estiramiento previo del tramo de la ventana (WSOLA en TypeScript, sin dependencias) reproducido a 1× por el mismo `AudioBufferSourceNode`** | Propia (GPL-3.0) | Tono conservado. El reloj **no cambia**: el tramo estirado avanza `velocidad` ms de canción por ms real, la misma relación que da `playbackRate`. Función pura sobre `Float32Array`, probable en Vitest con clics sintéticos. Sin WASM ni CSP. | Solo dentro del tramo de la ventana (segundos). Calidad WSOLA: buena con voz, algo de eco con música. Preparación < 300 ms estimados para 10 s, en un *worker*. |
| E. `@soundtouchjs/core` (WSOLA de SoundTouch portado a TS) en lugar del propio | MPL-2.0 (antes LGPL-2.1; ambas compatibles con GPL-3.0) | Parámetros afinados. | La v2 quitó `tempo` del API público («la velocidad se gestiona en el nodo fuente») y el cambio de licencia de un derivado de LGPL no está explicado. Queda como respaldo. |

### 4. Forma de onda ampliada

| Opción | Pros | Contras |
|---|---|---|
| **A. Los picos existentes (ADR 0015), nivel 0 (10 ms), con `picos.leer`** | Sin canal, formato ni worker nuevos. Una línea de 40 s cabe en una lectura de 4096 bloques. Una palabra (150–500 ms) tiene 15–50 bloques: se ven el arranque de cada sílaba y los huecos. | Por debajo de ~10 ms por píxel la envolvente se ve en escalones. No muestra ciclos de onda, que no hacen falta. |
| B. Picos finos desde el `AudioBuffer` de la voz en el renderer | Resolución de muestra. | Obliga a decodificar la voz aunque se escuche «Original» (LRU de 2 buffers) y duplica el cálculo. |
| C. Un nivel más fino (1–5 ms) en la caché | Más detalle. | Formato v2, regenerar todas las cachés y más disco. |

### 5. Guardar el texto de una línea desde el editor preciso

| Opción | Pros | Contras |
|---|---|---|
| **A. Canal nuevo `letras.editarTextoLinea` (solo texto de una línea, conserva id, inicio y fin) seguido del `guardarTiempos` de siempre** | Contrato estrecho; la visita sigue viva; deshacer reenvía el texto anterior sin mecanismo nuevo. | Dos llamadas por guardado con texto cambiado. |
| B. `letras.guardarLinea` (texto, límites y palabras de una línea) | Una llamada. | Duplica la validación de tiempos de `guardarTiempos` y obliga al guardado a decidir qué línea va por cada canal. |
| C. `letras.editarTexto` (texto completo con LCS) | Existe. | La línea cambiada pierde sus tiempos y la visita se invalida: el historial se vacía. |
| D. Admitir `texto` en `guardarTiempos` | Sin canal. | Rompe la garantía de que el contrato de tiempos no cambia textos. |

### 6. Barra de espera como barra de carga

| Opción | Pros | Contras |
|---|---|---|
| **A. Pista de ancho fijo con un relleno hijo escalado con `transform: scaleX(var(--k-fraccion))` desde la izquierda** | Sin *layout* por fotograma; la misma variable CSS que ya escriben el `requestAnimationFrame` y el modo fotograma. | Dos elementos. |
| B. Un elemento con `linear-gradient` y corte duro | Uno solo. | Repinta el fondo en cada fotograma; el relleno no puede tener extremos redondeados. |
| C. `<progress>` nativo | Semántica. | Estilo distinto por plataforma, difícil de igualar en la exportación. |

## Decisión

### 1. Datos: `origen_palabras`

- `elementoLetraSchema` añade `origen_palabras: z.enum(["importada", "manual"]).optional()`, con lectura tolerante (un valor fuera del catálogo se lee como ausente).
  - **Ausente con `palabras` ≠ `null`**: importadas (todas las de 0.2.0). Se conservan en el archivo y no se usan para nada.
  - **`"manual"`**: hechas en el editor preciso. Se pintan palabra a palabra.
  - `"importada"` no se escribe nunca: nombra el caso en código y pruebas.
  - Con `palabras: null` el campo no tiene efecto; main lo quita al escribir.
- `cancion.esquema` sigue en 1. **Ningún archivo se reescribe al abrir.**
- `tokenizarLinea(texto) = texto.trim().split(/\s+/)` sin vacíos (la puntuación va con su palabra). `PantallaLetra` ya separa las palabras con un espacio.
- **Reglas de validez de las palabras manuales** (spec 06, fase 9, «Conceptos»; respuesta a 0145 §3): una por token con su texto y en su orden; cada una dura al menos `DURACION_MINIMA_PALABRA_MS = 20`; sin solapes (`fin(k) ≤ inicio(k+1)`, pueden tocarse); la primera `≥` inicio de la línea y la última `≤` fin de la línea. Una sola función, `validarPalabrasManuales(linea, finLinea)` en `shared/letra.ts`.
  - En el **esquema** (`letraSchema`) se siguen exigiendo solo las reglas de palabras de hoy, para que unas palabras manuales dañadas a mano no dejen la canción como dañada.
  - Al **escribir**, main rechaza unas palabras manuales que no cumplan las reglas (`ARGUMENTOS_NO_VALIDOS`); el editor nunca las envía.
  - Al **pintar** y al calcular el fin, `palabrasVisibles(el)` devuelve las palabras solo si son manuales y válidas (contra el fin fijado o, si no lo hay, contra el inicio del siguiente elemento); si no, `null`. La ventana carga unas manuales no válidas como «sin marcar» (`edi.preciso.cargadasInvalidas`).
  - En el archivo nunca hay palabras sin tiempo: la ventana reparte las «sin marcar» antes de aplicar (§9).
- **Compatibilidad hacia atrás.**

  | Quién abre | Qué pasa |
  |---|---|
  | 0.2.1 con una biblioteca de 0.2.0 | Se lee igual. Las líneas con palabras importadas se pintan con barrido progresivo entre su inicio y su `finEfectivo`; si tenían el fin automático, ese fin ya no sale de la última palabra (§3). No se escribe nada. |
  | 0.2.0 con un archivo de 0.2.1 | Descarta `origen_palabras` al leer y pinta palabra a palabra todas las palabras, también las manuales, que se ven bien. Si 0.2.0 reescribe la canción, el campo desaparece y, al volver a 0.2.1, esas palabras cuentan como importadas: dejan de pintarse pero siguen en el archivo (pérdida aceptada, como en ADR 0006, revisión de la fase 5). |
  | 0.1.0 | Igual que 0.2.0. |

### 2. Render: solo se pintan las palabras manuales

- `render.ts` (`dibujar` y `fotogramaEstatico`) usa `palabrasVisibles(linea)` en lugar de `linea.palabras`. Con importadas, barrido progresivo `progreso(t, inicio, finEfectivo)`.
- El reproductor, la secundaria y la exportación pintan con el mismo `fotogramaEn`, así que el cambio llega a las cuatro superficies. La igualdad modelo-fotograma de la exportación (ADR 0019 §2, V17) se mantiene.
- «Letra lista» sigue sin barrido ni resaltado por palabra (ADR 0018 §5).
- Se retiran la etiqueta «por palabra» y su tooltip del editor; las líneas con palabras manuales llevan el indicador de la spec 06 (fase 9, «Indicador…»).

### 3. `finEfectivo` solo cuenta las palabras visibles

Orden: fin fijado → fin de la última palabra **visible** → reglas automáticas (ADR 0005). Respuesta a 0145 §1:

- Una línea de 0.2.0 con palabras importadas y fin automático pasa a terminar donde terminaría sin palabras. Afecta a su región, a la espera y a «Letra lista», igual en todas las superficies. No se escribe nada (provisional, [0148](../preguntas/0148-decisiones-provisionales-del-arquitecto-de-0-2-1.md) §3).
- Descartar unas palabras importadas no cambia nada visible: se borran sin aviso.
- Una línea con palabras manuales tiene en la práctica el fin fijado, porque «Aplicar» lo fija (§9). El paso «última palabra visible» cubre un archivo que llegue sin él.

### 4. Regla: editar el inicio o el fin de una línea descarta sus palabras

En las funciones puras de `shared/letra.ts` y `shared/letras/tiempos.ts`, de modo que vale para todas las vías de la spec 06 §8.2:

| Operación | Efecto |
|---|---|
| `moverInicioLinea` (`ajustarInicio`, `fijarInicio`, tirador de inicio, I, «Fijar inicio aquí», `marcarInicioLinea`) | Descarta las palabras de la línea movida, de cualquier origen. **Las palabras dejan de desplazarse** con la línea. La línea anterior pierde las suyas si su fin fijado pasa a automático por el nuevo inicio o si se solapan con él. |
| `ajustarFin`, `fijarFin`, tirador de fin, O, «Fijar fin aquí» | Descarta las de la línea. |
| `usarFinAutomatico` | Descarta las de la línea. |
| `borrarTiempos` / `borrarTiemposLinea` | Descarta (ya lo hacía). |
| «Sincronizar al ritmo»: elementos posteriores con inicio ≤ marca | Descarta (ya lo hacía). |
| «Ajustar los silencios» | Incluye ahora las líneas con palabras **importadas** (su fin cambia y sus palabras se descartan). Sigue sin tocar las de palabras **manuales**. |
| Editar el texto en la vista Letra (diff LCS) | Sin cambios: una línea emparejada conserva tiempos y palabras; una modificada queda sin tiempos. |
| `editarTextoLinea` (§7) | Deja la línea sin palabras en el archivo; desde el editor preciso las palabras nuevas llegan en el mismo guardado. |

Reglas comunes:

- **Un solo paso del historial**: el descarte va en la misma instantánea que la edición; Ctrl+Z restaura tiempos y palabras a la vez. El guardado lo envía con `guardarTiempos`, que ya restaura palabras de la referencia (ADR 0010 §2).
- **Aviso** (respuesta a 0145 §8): `palabrasDescartadas` del resultado lista solo las líneas que pierden palabras **manuales**. Textos de la spec 06 §8.2 (`edi.toast.palabras` por gesto, `edi.toast.palabras.ritmo` al salir del modo al ritmo).
- **Excepción, el editor preciso**: cambiar los límites dentro de la ventana no descarta sus palabras; la ventana aplica texto, límites y palabras con su propia operación (§9).

### 5. Importación: ya no se importan palabras

- `lyricsfile.ts` (LRCLIB) y `lrc.ts` (LRC mejorado) dejan `palabras: null`. El texto de la línea sale igual.
- **Fin al importar**: se fija el `end_ms` de la línea si cumple la regla vigente (ADR 0005, revisión de la fase 4); si no, el fin de su última palabra con `end_ms` explícito, con la misma condición. Así una letra recién importada termina sus líneas donde terminaban sus palabras.
- La búsqueda sigue prefiriendo los registros con `hasWordSync` (traen fines de línea). Lo que muestra la vista Letra lo decide la spec 05 ([0149](../preguntas/0149-indicador-por-palabra-en-la-vista-letra.md), provisional: «sincronizada por línea»).
- El exportador LRC (sin interfaz) solo escribe palabras visibles.

### 6. Contrato de `letras.guardarTiempos`

- `tiempoElementoSchema` (estricto) añade `origen_palabras: z.literal("manual").optional()`.
- Para una línea con `palabras` ≠ `null`, main valida: sin `origen_palabras`, la regla de hoy (las de la referencia desplazadas por el delta; solo sirve para restaurar con deshacer); con `"manual"`, `validarPalabrasManuales` contra el texto **guardado** de la línea y su fin.
- Main escribe `origen_palabras` solo si es `"manual"` y hay palabras.
- `offset_ms` sigue en el contrato; el editor envía el valor cargado.

### 7. Canal nuevo `letras.editarTextoLinea` (respuesta a 0145 §4)

- `letras.editarTextoLinea({ cancionId, id, texto }, sesionId)` en `ServicioLetras`:
  - `texto`: sin `\n` ni `\r`, sin espacios sobrantes en los extremos, de 1 al máximo por línea de la vista Letra;
  - el `id` existe y es una `linea`; la visita es la vigente (si no, `LETRA_DESACTUALIZADA`);
  - conserva `id`, `inicio_ms` y `fin_ms` y deja la línea sin palabras;
  - **actualiza la referencia de la visita** (texto y palabras de esa línea) en lugar de invalidarla;
  - se escribe sin *debounce* en la misma cola que `guardarTiempos`, así que el orden texto → tiempos se respeta; responde con el resumen;
  - durante una sesión en vivo responde `EDICION_BLOQUEADA` (ADR 0017 §9).
- **En el editor**: el texto solo cambia al aplicar el editor preciso, en el mismo paso que sus límites y palabras. `useGuardadoEditor` compara los textos de la última instantánea enviada con la actual y, por cada línea con texto distinto, llama a `editarTextoLinea` **antes** de `guardarTiempos`; este lleva los límites y las palabras manuales de la línea, validadas contra el texto nuevo. Deshacer restaura la instantánea: el guardado reenvía el texto anterior y las palabras de antes (las importadas se restauran con la referencia ya actualizada). La atomicidad que ve el usuario es la del historial; main escribe los dos cambios en orden.

### 8. Fase 8 en el editor

- **Atajo S**: `atajos.ts` deja de devolver `entrar_sync` para la S. El botón sigue igual.
- **Desplazamiento de toda la letra**: se retiran el bloque del panel, las teclas `,` y `.` en el editor y en «Probar a pantalla completa» (`reproductor/atajos.ts`, origen `editor`), el indicador `rep.offset`, las acciones `desplazar` y `fijar_desplazamiento` y sus avisos. `offset_ms` se sigue leyendo, validando y aplicando al pintar y al marcar (ADR 0010 §1).
- **Doble clic en el cuerpo de una región y Mayús + L** (spec 06 §8.4; respuesta a 0145 §6): `motor.reproducir({ desdeMs, hastaMs })` con `[máx(0, inicio − MARGEN_ESCUCHA_LINEA_MS), mín(duración, finEfectivo + MARGEN_ESCUCHA_LINEA_MS)]` en tiempo de audio; el `hastaMs` ya para el motor al final con el cabezal ahí. Con «Bloquear enunciado» en la misma línea se busca a `inicio − margen` y el bucle sigue. `MARGEN_ESCUCHA_LINEA_MS = 500` vive en `app/src/shared/escucha.ts` (nuevo) y es el margen por defecto del bucle del editor preciso.
- **Pestaña «Funciones»**: tercer valor de la pestaña (`'sincronia' | 'estilo' | 'funciones'`) en `Editor.tsx`, `distribucion.ts` y `useDistribucion.ts`; la línea de tiempo se ve también con «Funciones». Las acciones ya existen y se llaman igual que desde el menú «…»: sin contrato nuevo.

### 9. Editor preciso de línea (fase 9)

- **Ventana flotante no modal** dentro de la ventana del editor (no una `BrowserWindow`): componente React con `role="dialog"` y `aria-modal="false"`, arrastre, cambio de tamaño, F6 y teclado propio. Mientras tiene el foco, sus atajos se resuelven antes que los del editor: el editor ya captura en fase de captura (ADR 0010 §1); la ventana marca su contenedor y `atajos.ts` no trata eventos cuyo destino está dentro de él. Posición, tamaño y margen se recuerdan en `config.editor.paneles.preciso` (`{ x, y, ancho, alto, margen_ms: 0 | 500 | 1000 }`, opcional, lectura tolerante, valores por defecto en `shared/paneles.ts`), así que «Restablecer distribución de paneles» los devuelve a los iniciales. Nada va a `cancion.json`.
- **Borrador y deshacer**: la ventana tiene su propio *reducer* de borrador (marcas, tiradores, campos, límites, texto, repartir, quitar) con su historial. **Aplicar** (y Esc, ✕, cambiar de línea y las acciones que lo exigen según la spec) es **un solo paso** del historial del editor: acción `aplicar_preciso` con la letra de `aplicarEdicionPrecisa(letra, id, { texto, inicio, fin, palabras | null })`, que fija el fin si era automático y quedan palabras (0145 §3).
- **Operaciones puras** en `shared/letras/palabras.ts`: reparto de las «sin marcar» proporcional a los caracteres sin espacios (mínimo 1), marcar al vuelo (inicio, fin al soltar, recorte de la anterior, las posteriores que quedan antes pasan a sin marcar), tiradores y campos con límites y mínimo de 20 ms, repartir, quitar, reaplicar el texto con LCS por palabras (spec P11) y `aplicarEdicionPrecisa`.
- **Marcar al vuelo**: instante = `motor.tiempoDeEvento(evento.timeStamp)` − `offset_ms`, como «Sincronizar al ritmo»; se ignora `repeat`; mantener ≥ 300 ms fija el fin con el `timeStamp` del `keyup`/`pointerup`.
- **Bucle con márgenes**: `MotorAudio.fijarBucle` (ADR 0015) con `[inicio − margen, fin + margen]` en tiempo de audio, acotado a `[0, duración]`. «▶ Palabra»: `reproducir({ desdeMs: inicio − 250, hastaMs: fin + 250 })` (`MARGEN_ESCUCHA_PALABRA_MS = 250`) y vuelta a la posición previa. **No hay otro reloj.**
- **Velocidad** (respuesta a 0145 §5): el mismo control y estado que el transporte, con las velocidades de hoy (`0.5 | 0.75 | 1`; `Velocidad` no cambia).
  - **Fuera de la ventana** (transporte, «Sincronizar al ritmo», doble clic): `playbackRate`. **El tono baja**; el tooltip del transporte no cambia.
  - **En la ventana, por debajo de 1×: tono conservado (opción D).** Con la ventana abierta, `MotorAudio.fijarTramoConTono(intervalo | null)` recibe la vista de la ventana. Las reproducciones que empiezan y terminan dentro del tramo (el bucle de la línea, «▶ Palabra», cualquier `hastaMs` dentro) usan un `AudioBuffer` del tramo de la pista que suena estirado con `estirarTramo(canales, sampleRate, velocidad)` (WSOLA, `renderer/src/karaoke/estiramiento.ts`, función pura) en un *Web Worker* de módulo (`estiramiento.worker.ts`; la CSP lo admite con `'self'`). Se reproduce a `playbackRate = 1`, con `loopStart`/`loopEnd` o el `stop` convertidos al buffer estirado (`(t − inicioTramo) / velocidad`), y el anclaje registra la `velocidad` elegida: **la fórmula del reloj no cambia**. Lo que sale del tramo (Espacio del transporte sin bucle) usa `playbackRate`.
  - Caché: un buffer estirado por `(pista, tramo, velocidad)`; se descarta al cambiar cualquiera o al cerrar la ventana. Mientras se prepara suena con `playbackRate` y cambia en el siguiente paso por el inicio del bucle. Si falla, se queda con `playbackRate`, lo anota en el registro del renderer y la ventana muestra `edi.preciso.tono` (la nota **no** aparece mientras el tono se conserva).
  - **Precisión exigida**: con una pista de clics sintética estirada a 0,5× y 0,75×, la posición de cada clic según el reloj difiere ≤ 10 ms de canción de la real. Si no se alcanza, la tarea lo documenta, la ventana usa `playbackRate` con la nota y queda la opción E como respaldo (provisional, [0148](../preguntas/0148-decisiones-provisionales-del-arquitecto-de-0-2-1.md) §1).
  - Parámetros iniciales de WSOLA (los de SoundTouch para voz): secuencia 40 ms, búsqueda 15 ms, solapamiento 8 ms; correlación sobre la mezcla a mono, aplicada a todos los canales.
- **Forma de onda ampliada**: componente nuevo que lee los picos de la voz con `picos.leer` sobre la vista de la ventana con presupuesto = ancho del canvas en píxeles (≤ 4096); con líneas de hasta 40 s sale el nivel 0. Estados como `PistaOndaVoz`. Sin canal nuevo.

## Consecuencias

- **Positivas**: las canciones de 0.2.0 se abren sin reescribirse y dejan de mostrar el barrido desfasado; la regla de descarte vive en las funciones puras y se deshace en un paso; el editor preciso reutiliza motor, bucle, historial, autoguardado y picos; tono conservado en la ventana sin WASM, sin cambiar la CSP ni el reloj y sin dependencias nuevas.
- **Negativas / riesgos**:
  - el fin automático de las líneas con palabras importadas cambia una vez al abrir en 0.2.1;
  - una canción con `offset_ms` ≠ 0 ya no se corrige desde la interfaz (ninguna del usuario);
  - 0.2.0 puede borrar `origen_palabras` al reescribir (las palabras dejan de pintarse en 0.2.1, no se pierden);
  - el WSOLA propio es DSP que mantener; su calidad con música es peor que con voz. Precisión en Vitest, calidad en la guía manual;
  - fuera de la ventana la velocidad sigue bajando el tono;
  - memoria: a 0,5× un tramo de 20 s estéreo a 48 kHz son ~15 MB más.
- **Legales**: sin cambios; sin dependencias ni datos nuevos.
- **Impacto en UX**: lo fija la spec 06 (fases 8 y 9). La nota `edi.preciso.tono` solo aparece si falla el estiramiento.

## Fuentes

Consultadas el 2026-11-21.

- MDN, `AudioBufferSourceNode.playbackRate` («remuestrea el audio»): https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/playbackRate
- MDN, `HTMLMediaElement.preservesPitch` (*Baseline* desde diciembre de 2023): https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/preservesPitch
- W3C, Web Audio API, bucles: https://www.w3.org/TR/webaudio-1.0/#looping
- Signalsmith Stretch Web (MIT, WASM + AudioWorklet, 1.3.2): https://unpkg.com/signalsmith-stretch@1.3.2/README.md ; https://registry.npmjs.org/signalsmith-stretch/latest
- SoundTouchJS (MPL-2.0 tras pasar de LGPL): https://github.com/cutterbl/SoundTouchJS ; `@soundtouchjs/core` 2.1.1: https://cdn.jsdelivr.net/npm/@soundtouchjs/core@2.1.1/README.md ; 1.0.10 (LGPL-2.1): https://cdn.jsdelivr.net/npm/@soundtouchjs/core@1.0.10/README.md ; `soundtouchjs` (LGPL-2.1): https://npmjs.com/package/soundtouchjs
- SoundTouch (WSOLA y parámetros por defecto): https://www.surina.net/soundtouch/
- FSF, compatibilidad de MPL-2.0 y LGPL-2.1 con GPL-3.0: https://www.gnu.org/licenses/license-list.html
- Feedback de alpha.1 y datos de la biblioteca del usuario: [feedback-alpha-1.md](../versiones/0.2.0/feedback-alpha-1.md) §1.4 y §1.5.
