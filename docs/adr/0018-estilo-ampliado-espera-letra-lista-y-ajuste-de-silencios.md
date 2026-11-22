# 0018 — Estilo ampliado (degradados y movimiento), comodines de espera, modalidad «Letra lista» y «Ajustar los silencios»

- Estado: Aceptado
- Fecha: 2026-11-20
- Paso del pipeline: 4 (editor) y 5–6 (reproductor y exportación)
- Versión: 0.2.0-alfa, fase 5 (features 8, 9, 12 y 13 del [plan](../versiones/0.2.0/plan-2.md#fase-5--estilo-espera-y-letra-lista))

## Contexto

La fase 5 amplía lo que se pinta sobre el reloj de audio ya existente y lo que se guarda en la canción y en los temas:

- **8 · Degradados**: lineal, radial y cónico, con movimiento opcional (desactivado al inicio) ligado al tiempo de canción y fase estática con movimiento reducido. Avisos de contraste en el peor caso, incluido el cierre del cónico.
- **9 · Comodines de espera**: puntos, barra y cuenta 3·2·1 combinables, con umbral de silencio y preferencias del tema reemplazables por canción. Se derivan del intervalo entre el fin efectivo de una línea y el inicio de la siguiente. Los puntos del MVP se conservan.
- **12 · Letra lista**: una modalidad por canción que reproduce y exporta la letra sincronizada **sin barrido ni color de progreso**, conservando el estado `lista`.
- **13 · Ajustar los silencios**: en el editor, llevar el fin de cada línea al último instante con voz antes del primer silencio, a partir de los picos de voz (ADR 0015). Los fines manuales también se ajustan, con aviso. Es una sola operación deshacible. Un silencio igual o mayor que el umbral de los comodines activa la cuenta 3·2·1 (decisiones del usuario del 2026-11-20).

Restricciones heredadas:

- **Un solo reloj**: el render es una función pura del tiempo de canción (ADR 0010 §4 y 0011 §3). Nada de temporizadores propios que se desajusten al buscar, pausar o cambiar la velocidad. La exportación (fase 6, ADR 0019) dibuja por índice de fotograma con el mismo render.
- **Datos**: `cancion.json` y `temas.json` siguen en `esquema: 1` y se leen sin reescribir (ADR 0006, revisión de la fase 3). 0.1.0 debe poder abrir una canción de 0.2.0. Su `estiloSchema` exige `version: 1`, `fondo.tipo ∈ {solido, degradado}` y, en el degradado, `angulo_grados` y `paradas`. Con Zod descarta las claves que no conoce.
- **Apariencia**: main es la única autoridad que resuelve el estilo (ADR 0016 §3). Los reemplazos por canción estaban previstos como `apariencia.reemplazos`, aplicados después del tema (ADR 0016 §3 y §12).
- **Picos**: pirámide min/máx int16 por bloques de 10 ms en `pistas/.picos-voz-v1-*.bin`, que el renderer lee con `picos.leer` hasta 4096 bloques por llamada (ADR 0015).
- **Pruebas**: sirven de feedback ([`pruebas.md`](../pruebas.md)). Lo visual y el hardware real van a la guía manual.

Código de partida: `shared/estilo.ts` (esquema), `renderer/src/karaoke/estiloCss.ts` (CSS del fondo), `contraste.ts` (11 muestras del degradado), `render.ts` (`fotogramaEn`, con `puntos` para la primera entrada y los huecos ≥ 4000 ms) y `PantallaLetra.tsx`, `shared/letra.ts` (`finEfectivo`), `shared/letras/tiempos.ts` y el reducer `vistas/editor/estado.ts` (historial de instantáneas `{ letra, apariencia, borrador }`).

## Alternativas consideradas

### 1. Cómo guardar el estilo ampliado

| Opción | Pros | Contras |
|---|---|---|
| **A. Campos opcionales dentro de `estilo` v1** (`forma`, `centro`, `movimiento`, `espera`), con `angulo_grados` y `paradas` conservados | 0.1.0 lo lee como lineal estático y conserva los colores. Sin migración ni reescritura. Temas y canciones comparten el esquema. | Algunos campos no tienen efecto en ciertas formas (el ángulo en el radial). Las comparaciones de estilos deben normalizar los ausentes. |
| B. `estilo.version: 2` con una unión por forma | Esquema más limpio | 0.1.0 rechaza la canción entera (`z.literal(1)`) y la vería dañada. Obliga a subir `esquema` y a migrar al abrir. |
| C. Nuevo `fondo.tipo` (`radial`, `conico`) | Discriminante natural | Rompe la unión discriminada de 0.1.0, con el mismo efecto que B. |

### 2. Cómo mover el degradado

| Opción | Pros | Contras |
|---|---|---|
| **A. Geometría como función pura del tiempo de canción** (ángulo o centro), escrita en variables CSS en el mismo `requestAnimationFrame` que la letra | Determinista: mismo `t`, misma imagen en editor, reproductor y exportación. El estático coincide con el CSS actual. La paleta no cambia, así que el contraste no depende del movimiento. | Repinta el fondo en cada fotograma mientras haya movimiento, con un coste de GPU que hay que medir en un equipo modesto. |
| B. Animación CSS (`@keyframes`) o Web Animations | Sin JS por fotograma | Tiene su propio reloj y se desajusta al buscar, pausar o cambiar la velocidad. En una exportación por fotogramas no es reproducible. |
| C. Capa sobredimensionada movida con `transform` | Solo composición, sin repintado | El lineal estático deja de coincidir con el de 0.1.0 (las paradas se estiran sobre la diagonal de la capa). Más geometría que mantener. Queda como alternativa si la medición de A falla. |
| D. Interpolar la paleta en el tiempo | Efectos más ricos | Para el contraste habría que evaluar espacio × tiempo. Descartada en R1. |

### 3. Peor contraste

| Opción | Pros | Contras |
|---|---|---|
| **A. Peor caso sobre toda la paleta**: todos los tramos entre paradas y, en el cónico, el cierre | Barato, puro y válido para cualquier fase, porque el movimiento solo cambia la geometría. Sirve igual en editor, reproductor y exportación. | Es conservador: avisa aunque el color crítico nunca quede bajo el texto. No puede decir «solo durante el movimiento». |
| B. Rasterizar el área del texto a lo largo de un ciclo | Preciso | Depende de la fuente, del tamaño, de la ventana y de la fase. Es caro y no es determinista entre equipos. |

### 4. Dónde viven las preferencias de espera

| Opción | Pros | Contras |
|---|---|---|
| **A. `estilo.espera` (en tema y canción) y reemplazo por canción en `apariencia.reemplazos.espera`** | Es lo previsto en ADR 0016 §3. Los temas las guardan. La canción las personaliza sin copiar el tema. La resolución sigue en main. | Hay que fusionar después del tema y normalizar los ausentes. |
| B. Marcas por hueco persistidas en la letra (pausas generadas) | Control fino por hueco | Duplica datos derivables, cambia la edición (R1) y se desajusta al mover tiempos. |
| C. Preferencia global en `config.json` | Simple | No es por tema ni por canción, como pide el plan. |

### 5. Cómo registrar «Letra lista»

| Opción | Pros | Contras |
|---|---|---|
| **A. `estado: "lista"` + campo opcional `modalidad: "karaoke" \| "letra_lista"`** | Reutiliza la elegibilidad de Lista, la cola, la revalidación y la exportación. 0.1.0 la lee como Lista con barrido. | Hay que mantener la modalidad coherente al volver a borrador. |
| B. Nuevo valor `estado: "letra_lista"` | Explícito | 0.1.0 rechaza el enum. Habría que tocar todos los usos de `lista` (cola, filtros, reproducción). |
| C. Un tema con resaltado igual al color de letra | Sin datos nuevos | Confunde progreso con legibilidad (riesgo del plan) y una cascada de temas lo desactivaría. Descartada en R4. |

### 6. Dónde se calcula «Ajustar los silencios»

| Opción | Pros | Contras |
|---|---|---|
| **A. Renderer (editor)**: lee el nivel base de picos con `picos.leer` en trozos de 4096 bloques y ejecuta funciones puras de `shared/` sobre la letra en memoria | Usa la letra del editor, que puede ir por delante del disco (debounce). Sin canal IPC nuevo ni cambios en main. El resultado entra como un paso del historial y se guarda con el autoguardado. | Varias llamadas IPC: unas 8 para 5 min y 88 para 1 h, de 16 KB cada una. |
| B. Canal nuevo en main que lea la caché completa y devuelva los intervalos con voz | Una sola llamada. La caché no sale de main. | Superficie IPC nueva para un dato que ya se puede leer. Hay que reconciliar la letra del disco con la del editor. Queda como optimización si A resultara lenta. |
| C. Decodificar `voz.flac` en el renderer | Precisión de muestra | Otra decodificación completa, que ADR 0015 ya descartó. El plan pide usar los picos existentes. |
| D. VAD neuronal (Silero, WebRTC VAD) | Más robusto ante restos | Dependencias y modelos nuevos para una voz ya separada y limpia. Contradice la simplicidad. |

## Decisión

Opciones **1A, 2A, 3A, 4A, 5A y 6A**.

### 1. Esquema del estilo (sin subir versiones)

`estilo.version` sigue en `1`, `cancion.esquema` en `1` y `temas.esquema` en `1`. Los campos nuevos son opcionales y su ausencia equivale al comportamiento de 0.1.0. No se reescribe nada al abrir.

```jsonc
"estilo": {
  "version": 1,
  "fondo": {
    "tipo": "degradado",
    "forma": "conico",                 // opcional: "lineal" (ausente) | "radial" | "conico"
    "angulo_grados": 135,              // obligatorio como en 0.1.0. Lineal: dirección. Cónico: ángulo de inicio («from»). Radial: sin efecto, se conserva.
    "centro": { "x": 0.5, "y": 0.5 },  // opcional, 0–1 sobre el área pintada; radial y cónico; ausente = centro. En el lineal se conserva sin efecto.
    "paradas": [ { "color": "#1B1033", "posicion": 0 }, { "color": "#5A1E6E", "posicion": 1 } ],  // 2–4, como en 0.1.0
    "movimiento": { "periodo_s": 30, "sentido": "horario" }  // opcional; ausente o null = estático
  },
  "letra": { /* sin cambios */ },
  "espera": {                          // opcional; ausente = ESPERA_LEGADA (§3)
    "puntos": true,
    "barra": false,
    "cuenta": false,
    "primera_entrada": true,
    "umbral_ms": 4000
  }
}
```

- **Validación** (`shared/estilo.ts`, Zod):
  - `forma` es un enum;
  - `centro.x` y `centro.y` están en [0, 1];
  - `movimiento.periodo_s` es un entero de 10 a 120 y `sentido` vale `horario` o `antihorario` (valores provisionales, §2);
  - `espera.umbral_ms` es un entero de 1000 a 60000 y las casillas son booleanas.

  `movimiento` en un fondo sólido no es válido.
- **Normalización en memoria**: `normalizarEstilo(estilo)` rellena los ausentes (`forma: "lineal"`, `centro: {0.5, 0.5}`, `movimiento: null`, `espera: ESPERA_LEGADA`). No se usa para escribir.
  - **Todas las comparaciones de estilos usan la forma normalizada**: `estilosIguales` de `shared/temas.ts`, que alimenta `esAparienciaNeutra` y el nombre «Shinobi» o «Mi estilo», y `mismoJson` del editor. Si no, un estilo de 0.1.0 sin `espera` dejaría de ser igual a uno con la espera legada explícita y cambiaría la portada de la Biblioteca.
- **`ESTILO_PREDETERMINADO` no cambia**: sigue siendo lineal y estático, sin `espera`, lo que equivale a la espera legada. Las canciones y temas nuevos reciben lo que resuelva su tema.
- **Compatibilidad con 0.1.0**: descarta `forma`, `centro`, `movimiento` y `espera`, y pinta un lineal estático con el mismo ángulo y las mismas paradas, con los puntos del MVP. Si reescribe la canción, esos campos se pierden y al volver a 0.2.0 quedan con su valor por defecto, sin error. Es la misma regla de pérdida aceptada para `apariencia` (ADR 0016 §2).
- **Temas**: `temas.json` guarda el estilo con este mismo esquema. No hay migración de catálogo.

### 2. Degradados y movimiento

- **CSS** (`renderer/src/karaoke/estiloCss.ts`, `fondoCss(fondo, geometria)`):
  - lineal: `linear-gradient(<ángulo>deg, <paradas>)`, idéntico al actual si no hay movimiento;
  - radial: `radial-gradient(circle farthest-corner at <x>% <y>%, <paradas>)`;
  - cónico: `conic-gradient(from <ángulo>deg at <x>% <y>%, <paradas>, <color de la primera parada> 100%)`.

  **Cierre del cónico**: se añade al final el color de la primera parada en el 100 %, así que el tramo entre la última parada y el 100 % funde hacia el primer color (cierre suave). Si la última parada está en 1, el cierre es una costura nítida entre los dos colores. El editor reparte las paradas del cónico en i/n (0, 1/n, …, (n−1)/n) para que el tramo de cierre mida lo mismo que los demás (spec 06 · G). Es una regla de la interfaz: el esquema solo exige posiciones no decrecientes en [0, 1] y no cambia. La interpolación es en sRGB, la de CSS por defecto para colores hexadecimales, la misma que usa `contraste.ts`.
- **Geometría en función del tiempo**: es una función pura, `geometriaFondoEn(fondo, tAudioMs, { estatico })`, que devuelve `{ anguloGrados, centro }`, en `renderer/src/karaoke/fondo.ts`. Al exportar se ejecuta en la misma página.
  - `fase = ((t mod P) + P) mod P / P`, con `P = periodo_s × 1000` y `t` el **tiempo de audio** de la posición de reproducción, sin el `offset_ms` de la letra e incluido el silencio previo negativo del reproductor. Así el mismo instante da la misma fase en editor, reproductor y exportación, sin depender del desplazamiento de la letra.
  - `θ = 2π × fase × s`, con `s = +1` en sentido horario y `−1` en antihorario.
  - Lineal y cónico **rotan**: `ángulo(t) = angulo_grados + 360 × fase × s`.
  - El radial **orbita**: `centro(t) = centro + A × (sen θ, 1 − cos θ)`, con `A = AMPLITUD_ORBITA = 0,10` (provisional). La órbita pasa por el centro configurado en la fase 0.
  - Se redondea a 0,01° y a 0,01 % para que el texto CSS sea idéntico en todas las ventanas.
- **Fase estática = fase 0** = la geometría configurada. Se usa cuando:
  - no hay `movimiento`;
  - el sistema pide movimiento reducido (`prefers-reduced-motion: reduce`), en editor, reproductor local y secundaria;
  - el usuario detiene el movimiento en la vista previa del editor (estado de la visita, no se guarda).
- **Pintado**: `PantallaLetra` escribe la geometría en variables CSS (`--k-fondo-angulo`, `--k-fondo-x`, `--k-fondo-y`) en el mismo `requestAnimationFrame` en que escribe el barrido. Solo lo hace si hay movimiento activo. React no se vuelve a renderizar por fotograma. No hay animaciones CSS ni temporizadores propios.
  - Coste: se mide en la guía manual (equipo modesto, 1080p y la secundaria). Si se pierden fotogramas, la alternativa es la 2C, sin tocar los datos.
- **Exportación** (fase 6, ADR 0019): llama a `geometriaFondoEn` con el tiempo del fotograma. **Provisional** ([0100](../preguntas/0100-decisiones-provisionales-de-la-fase-5.md) §3): el vídeo se exporta con el movimiento configurado aunque el sistema pida movimiento reducido, porque el archivo se verá en otros equipos.

### 3. Comodines de espera

- **Constantes** (`shared/espera.ts`):
  - `ESPERA_LEGADA = { puntos: true, barra: false, cuenta: false, primera_entrada: true, umbral_ms: 4000 }`. Reproduce exactamente el MVP: los puntos `●●●` en los 3 últimos segundos antes de la primera línea y de cada hueco ≥ 4000 ms (`render.ts` de hoy).
  - `CUENTA_MS = 3000`.
- **Esperas que se derivan** (función pura en `render.ts`). No se guarda nada, no hay temporizadores y no se generan pausas:
  - **Primera entrada**: el intervalo es `[inicio₁ − 4000, inicio₁)`, es decir, desde que deja de verse el título, igual que en el MVP. Se muestra si `primera_entrada` está activo, **sin umbral**.
  - **Entre versos**: el intervalo es `[finEfectivo(anterior), inicio(siguiente))` sobre las líneas con inicio. Las pausas con tiempo ya limitan `finEfectivo`. Se muestra si `hueco ≥ umbral_ms`.
  - **Sin línea siguiente** no hay espera.
- **Qué se muestra en el intervalo**, con `restante = destino − t`:
  - `puntos`: `ceil(restante / 1000)` puntos cuando `restante ≤ 3000`;
  - `cuenta`: el dígito `3`, `2` o `1` con la misma regla. Ocupa los últimos tres segundos **disponibles**: si el hueco es menor, empieza en el fin anterior con el dígito que corresponda;
  - `barra`: `fraccion = (t − origen) / (destino − origen)`, que termina exactamente en el inicio siguiente.

  Las tres casillas se combinan.
- **Fotograma**: `FotogramaLetra` sustituye `puntos` por `espera: { origenMs, destinoMs, restanteMs, fraccion, primera, puntos: 0|1|2|3, cuenta: 1|2|3|null, barra: boolean, clave } | null`. `clave` identifica el hueco (`origen:destino`) y **solo cambia al empezar una espera** (o al saltar a otro hueco al buscar). La vista la usa para el único anuncio por hueco; los cambios de dígito se leen en `cuenta` y `puntos` (revisión del 2026-11-20). La configuración llega en el contexto del render desde el **estilo resuelto** (`normalizarEstilo(estilo).espera`).
- **Posición del texto**: los indicadores se pintan en huecos reservados con posicionamiento absoluto, fuera del flujo de la letra. Mostrarlos u ocultarlos no mueve el texto ni invalida la geometría de renglones de la fase 1.
- **Colores**: se usan solo el color de letra y el de resaltado, así que el aviso de contraste (§4) los cubre.
- **Movimiento reducido**: sin transiciones de entrada ni salida. La presentación concreta (por ejemplo, la barra por pasos) la decide la spec.
- **Ejemplo en el panel Estilo** («mostrar la combinación sin reproducir la canción»): puede usar una letra sintética en memoria y un reloj local **solo** para esa muestra. No es el reloj de la reproducción.
- **Herencia y reemplazo por canción** (ADR 0016 §3):
  - `apariencia.reemplazos` es opcional y tiene **lista blanca** de campos. Por ahora solo admite `espera`, y siempre el bloque **completo**.
  - Solo es válido con los modos `tema` y `heredar`. Con `propio`, la espera vive en `estilo.espera`.
  - `resolverApariencia` fusiona `estilo.espera = reemplazos.espera ?? estiloDelTema.espera` después de los pasos 2 y 3. La resolución añade `procedenciaEspera`, que es `"cancion"` si hay reemplazo y, si no, la procedencia del estilo.
  - La instantánea de respaldo guarda el resultado fusionado.
  - Congelar al borrar un tema (ADR 0016 §8) escribe el resultado fusionado como `propio` y retira `reemplazos`.
  - **Cambios de modo** (provisional, [0101](../preguntas/0101-contratos-de-la-fase-5-para-las-specs.md)):
    - entre `tema` y `heredar`, los `reemplazos` se conservan;
    - «Personalizar» (pasar a `propio`) los fusiona en `estilo`;
    - salir de `propio` no traslada la espera propia.
- **IPC**: `SeleccionApariencia` de `biblioteca.guardarApariencia` admite `reemplazos` en los modos `tema` y `heredar`: ausente conserva los existentes, `null` los quita y un objeto los sustituye. Las operaciones en lote de `temas.ejecutar` conservan los reemplazos. El resumen y `resuelta` añaden `procedenciaEspera`.

### 4. Peor contraste

- `muestrasFondo(fondo)` deja las 11 muestras globales y pasa a **9 muestras por tramo**, extremos incluidos: entre cada par de paradas consecutivas, desde 0 hasta la primera parada (color sólido), desde la última parada hasta 1 y, en el **cónico**, el tramo de cierre de la última parada al primer color. Así no se pierde un tramo corto entre dos paradas cercanas, donde la luminancia puede tener su mínimo.
- `evaluarContraste` conserva la forma del resultado: ratios de letra y resaltado frente a la peor muestra, ΔE entre letra y resaltado, niveles y acciones sugeridas. Cubre las tres formas.
- **Invariancia ante el movimiento**: con paleta fija y centro dentro del área, cada fase muestra un subconjunto de la misma paleta. El peor caso de la paleta vale para cualquier fase y el aviso es único. El texto «El contraste puede ser bajo durante el movimiento» **no se usa**, porque la evaluación no puede distinguirlo (R2). Si la spec quiere avisar de la posición del área de texto, sería la opción 3B (propuesta futura).
- El contraste se calcula sobre el **estilo resuelto** (con el borrador del tema si se está editando), igual en editor y reproductor (ADR 0016 §12).

### 5. Modalidad «Letra lista»

- **Datos**: en `cancion.json` se añade el campo opcional `modalidad: "karaoke" | "letra_lista"`. Si falta, vale `karaoke`. Solo tiene sentido con `estado: "lista"`. Con `borrador` se ignora al leer y main lo retira al volver a borrador (provisional, [0100](../preguntas/0100-decisiones-provisionales-de-la-fase-5.md) §2). Es independiente de la apariencia: ningún tema la activa ni la desactiva.
- **Elegibilidad** (`shared/derivados.ts`): `motivosParaNoEstarLetraLista(cancion)` devuelve los motivos de Lista (fuente, pistas, letra, `LINEAS_SIN_INICIO` con la lista de líneas) más `FIN_NO_VALIDO` para cada línea cuyo `finEfectivo` no cumpla `inicio < fin ≤ inicio del siguiente elemento con inicio`.
  - Con los invariantes del ADR 0006, `finEfectivo` siempre es válido si hay inicio, porque cubre los fines automáticos y los de la API. El motivo es defensivo y en la práctica la condición es la de Lista.
  - «Ir a la primera línea sin tiempo» usa la lista de líneas del motivo.
- **IPC**:
  - `biblioteca.marcarLista(id, opciones?)` admite `{ modalidad: "karaoke" | "letra_lista" }`. Sin opciones mantiene el comportamiento actual: `karaoke`.
  - Main revalida las precondiciones y, si no se cumplen, responde `ARGUMENTOS_NO_VALIDOS` con los motivos, como hoy.
  - Sobre una canción ya `lista`, la llamada **cambia la modalidad** sin pasar por borrador.
  - `edicion` pasa a `completado` igual que con Lista.
  - Sigue bloqueada durante la sesión (`EDICION_BLOQUEADA`, ADR 0017 §9).
  - El resumen añade `modalidad`, con la que la Biblioteca muestra la insignia y filtra.
- **Aviso de la primera activación**: en `config.editor` se añade `omitir_aviso_letra_lista: boolean`, que por defecto es `false`, con lectura tolerante (`.catch(false)`). Se escribe con `config.actualizar` solo al confirmar con la casilla marcada. Cancelar no escribe nada.
- **Pintado**: `PantallaLetra` recibe `barrido: boolean`.
  - Con `false` no se monta la capa de resaltado. La línea activa se pinta entera con el color de letra durante `[inicio, fin)` y la siguiente queda en espera.
  - Tampoco se resalta por palabra, ni la mitad de la línea en la pantalla de pausa (`fotogramaEstatico`).
  - Los comodines de espera y el fondo se pintan igual.
- **Quién pinta con barrido**:

  | Superficie | Barrido |
  |---|---|
  | Panel de vista previa del editor | Siempre |
  | Reproductor local | Según `modalidad` |
  | Sesión en vivo | Según `modalidad`. La entrada activa lleva `modalidad` en su instantánea (ADR 0017 §10), tomada al consumirla. |
  | Exportación (fase 6) | Según `modalidad`, tomada al iniciar |
  | «Probar a pantalla completa» desde el editor | **Provisional: según `modalidad`**, porque prueba la salida ([0100](../preguntas/0100-decisiones-provisionales-de-la-fase-5.md) §2) |

- **Edición posterior**: igual que con Lista. Si se borran tiempos, la canción sigue `lista` con su modalidad y el indicador derivado `incompleta`, y el reproductor omite las líneas sin inicio. Nunca vuelve sola a borrador ni pierde la modalidad.
- **0.1.0** descarta `modalidad` y reproduce con barrido.

### 6. «Ajustar los silencios»

#### 6.1 Funciones puras (`shared/silencios.ts`)

```ts
export const PARAMETROS_SILENCIOS = {          // provisionales, ver §6.4
  percentilReferencia: 0.95,                   // nivel de la canción: percentil del pico de bloque
  pisoReferenciaDbfs: -60,                     // solo cuentan para el percentil los bloques por encima
  umbralRelativoDb: -30,                       // hay voz si pico ≥ referencia − 30 dB …
  umbralMinimoDbfs: -60,                       // … y nunca por debajo de −60 dBFS
  silencioMinimoMs: 400,                       // un silencio dura al menos esto
  vozMinimaMs: 50,                             // ráfagas más cortas dentro de un silencio no cuentan (clics, restos)
  margenColaMs: 100                            // fin = último bloque con voz + margen (cola, reverberación)
} as const

detectarVoz(picos: { pasoMs: 10; pares: Int16Array }, p = PARAMETROS_SILENCIOS)
  → { intervalos: [inicioMs, finMs][] /* tiempo de audio, semiabiertos */, referenciaDbfs, umbralDbfs }

proponerAjusteSilencios(letra, voz, { duracionMs, espera /* efectiva de la canción */, comodin = 'cuenta', p })
  → { letra, cambios: { id, finAntes: number | null, finDespues: number, eraFijado: boolean, huecoMs: number | null }[],
      lineasCambiadas, finesFijadosCambiados, huecosLargos, sinVoz: string[],
      espera: Espera | null  /* espera nueva si hay que activar el comodín; null si no cambia */ }
```

- **`detectarVoz`**:
  - Amplitud de cada bloque: `max(|min|, |max|)` en unidades int16.
  - **Referencia**: el percentil 95 de los bloques por encima del piso, calculado con un histograma de 32768 cubetas (O(n), sin ordenar ni usar coma flotante en el recorrido).
  - **Umbral**: `max(referencia − 30 dB, −60 dBFS)`, convertido una vez a entero int16.
  - Un bloque tiene voz si alcanza el umbral. Las rachas de voz de menos de `vozMinimaMs` se tratan como silencio y quedan los intervalos con voz.
  - Si no hay bloques por encima del piso, la lista sale vacía.
  - Todo es aritmética entera sobre bloques: la misma entrada da la misma salida en cualquier equipo.
- **`proponerAjusteSilencios`**, para cada elemento `tipo: "linea"` con inicio y **sin palabras**:
  1. **Ventana**: de su inicio al inicio del siguiente elemento con inicio (línea o pausa con tiempo). En la última línea, hasta la duración. Todo se pasa a tiempo de audio con `+ offset_ms`.
  2. Se busca el **primer bloque con voz** a partir del inicio. Si no lo hay en la ventana, no cambia y se añade a `sinVoz`. Así se ignora un silencio al principio de la ventana, por ejemplo una marca adelantada.
  3. Desde ahí se busca el **primer silencio** (hueco entre intervalos de voz de al menos `silencioMinimoMs`) que empiece antes del final de la ventana. Un silencio que llega hasta el final de la ventana cuenta si dura al menos el mínimo dentro de ella.
  4. Si lo hay: `fin = min(finVoz + margenColaMs, inicioSiguiente)`, pasado a tiempo de letra (`− offset_ms`), redondeado a entero y con `fin ≥ inicio + 1`. Si no lo hay, la línea **no cambia**.
  5. Solo es un cambio si `fin ≠ finEfectivo` actual. Se escribe como **fin fijado** (`fin_ms` numérico). Los fines que ya estaban fijados también se sustituyen y cuentan en `finesFijadosCambiados`.
  6. `huecoMs = inicioSiguiente − fin` (en la última línea, `null`). Si `huecoMs ≥ espera.umbral_ms`, cuenta en `huecosLargos`.

  - **Líneas con palabras**: no se tocan. Su `finEfectivo` ya es el fin de la última palabra importada (ADR 0005). Tampoco las pausas.
  - **Invariantes**: se respeta `inicio < fin ≤ inicio del siguiente elemento con inicio` (ADR 0006). Los inicios y textos no cambian.
  - **Activación del comodín** (decisión del usuario, provisional en su forma; [0100](../preguntas/0100-decisiones-provisionales-de-la-fase-5.md) §1): si `huecosLargos > 0` y la espera efectiva no tiene activa la casilla `comodin` (`cuenta` por defecto), `espera` devuelve la espera efectiva con esa casilla activa. Las demás casillas y el umbral no cambian.
    - Como los comodines se derivan de **cada** hueco ≥ umbral (§3), activar la cuenta a nivel de canción la muestra justo en esos silencios largos, sin guardar marcas por hueco.
    - La consecuencia es que también aparece en otros huecos de la canción que ya superaban el umbral.

#### 6.2 Dónde se ejecuta

- **En el editor (renderer)**, con la letra en memoria.
- Si `picos.solicitar` da `lista`, el editor lee el **nivel base** con `picos.leer` en ventanas alineadas de 40 960 ms: 4096 bloques de 10 ms, el presupuesto máximo, con el que `leerVentana` elige siempre el nivel 0. Comprueba que todas las respuestas traen la misma `generacion` y, si cambia, reintenta una vez.
- El `Int16Array` resultante se conserva mientras dure la visita, asociado a esa generación.
- No hay canal nuevo ni cambios en main ni en el worker.
- **Precondiciones** (con el motivo accesible de la spec si no se cumplen):
  - todas las líneas tienen inicio (`LINEAS_SIN_INICIO`, como Letra lista);
  - los picos están `lista` (si no, el motivo es «generando», «no disponible» o «error», con reintento);
  - no se está sincronizando al ritmo;
  - no hay un borrador de tema abierto (provisional, porque el reducer no admite cambios de apariencia en ese estado).
- **Flujo**:
  1. Se calcula la propuesta.
  2. El aviso muestra `lineasCambiadas`, `finesFijadosCambiados` y si se activará el comodín.
  3. Al confirmar, si la `version` del editor cambió desde el cálculo, se vuelve a calcular, que es barato y puro.
  4. Se despacha la acción `ajustar_silencios`.
  - Con `lineasCambiadas = 0` el aviso informa y no crea ningún paso.

#### 6.3 Una sola operación deshacible

- La acción `ajustar_silencios` del reducer crea **una** entrada del historial con la instantánea completa `{ letra, apariencia }`. Si hay `espera` nueva, la apariencia cambia así:
  - con `propio`, cambia `estilo.espera`;
  - con `tema` o `heredar`, cambia `reemplazos.espera`.
- Deshacer o rehacer restaura las dos en un paso.
- El autoguardado envía el lote con los canales actuales: `letras.guardarTiempos`, que solo cambia `fin_ms`, y `biblioteca.guardarApariencia` si cambió la apariencia.
  - Son dos escrituras atómicas independientes de `cancion.json`. Si falla la segunda, el estado de guardado del editor muestra el error y reintenta como hoy (ADR 0010). El historial sigue siendo uno.

#### 6.4 Valores provisionales y calibración

- Los parámetros son **constantes con nombre** en `PARAMETROS_SILENCIOS`, sin preferencia de usuario. Una sensibilidad ajustable es la [propuesta 003](../propuestas/003-calibrar-el-ajuste-de-silencios-por-cancion.md).
- Se parte de que el modelo «Calidad» deja silencios muy limpios, con restos muy por debajo de −30 dB respecto a la voz. Por eso el umbral es relativo, con un piso absoluto de −60 dBFS como el ruido por defecto de `silencedetect` de FFmpeg. El silencio mínimo es corto (400 ms) porque las pausas entre enunciados son breves.
- **Calibración en el equipo del usuario**: con sus 6 canciones sincronizadas a mano, una herramienta de desarrollo (`app/scripts/calibrar-silencios.ts`, fuera del paquete) lee `cancion.json` y la caché de picos de una carpeta indicada por argumento. Aplica `proponerAjusteSilencios` con una rejilla de parámetros y compara con los fines manuales: error medio y máximo, líneas no detectadas y cortes falsos. **No se guardan audio, letras ni resultados en el repositorio**. Solo se actualizan las constantes, con una nota en este ADR.

### 7. Contratos y archivos que cambian

| Dónde | Cambio |
|---|---|
| `shared/estilo.ts` | `forma`, `centro`, `movimiento` y `espera` opcionales; `normalizarEstilo`; `ESTILO_PREDETERMINADO` igual |
| `shared/espera.ts` (nuevo) | `esperaSchema`, `ESPERA_LEGADA` y `CUENTA_MS` |
| `shared/temas.ts` | `aparienciaSchema.reemplazos` (lista blanca `espera`, solo `tema`/`heredar`); fusión en `resolverApariencia`; `procedenciaEspera`; `estilosIguales` normalizado |
| `shared/cancion.ts` | `modalidad` opcional |
| `shared/derivados.ts` | `motivosParaNoEstarLetraLista` |
| `shared/silencios.ts` (nuevo) | `PARAMETROS_SILENCIOS`, `detectarVoz` y `proponerAjusteSilencios` |
| `shared/config.ts` | `editor.omitir_aviso_letra_lista` (tolerante) y admisión en `configParcialRendererSchema` |
| `shared/ipc.ts` | `marcarLista(id, { modalidad }?)`; `SeleccionApariencia.reemplazos`; `modalidad` y `procedenciaEspera` en el resumen y en `resuelta`; `modalidad` en la entrada activa de la sesión. **Sin canales nuevos.** |
| `renderer/src/karaoke/` | `fondo.ts` (geometría), `estiloCss.ts` (tres formas y cierre cónico), `contraste.ts` (muestras por tramo y cierre), `render.ts` (`espera`), `PantallaLetra.tsx` (`barrido`, indicadores y variables de fondo) |
| `renderer/src/vistas/editor/` | acción `ajustar_silencios`; `reemplazos` en `AparienciaEditor`; lectura del nivel base de picos |
| `main/biblioteca/` | `marcarLista` con modalidad; retirar `modalidad` al volver a borrador; `guardarApariencia` con `reemplazos` |
| `main/sesion/` | copiar `modalidad` en la instantánea de la entrada activa |

Roles (ADR 0017 §11): sin cambios. Todo lo nuevo pertenece a canales de la principal, salvo la lectura de `modalidad` en la secundaria, que llega en la instantánea.

### 8. Estrategia de pruebas mínima

Según [`pruebas.md`](../pruebas.md): Vitest primero y E2E solo para integración real.

- **Vitest, `shared/`**:
  - `silencios.test.ts` con **picos generados** (`Int16Array` sintéticos):
    - voz a −6 dBFS con silencios conocidos de 300, 500 y 5000 ms;
    - ruido residual a −70 dBFS;
    - una cola que decae y una ráfaga de 30 ms dentro de un silencio.

    Comprueba:
    - el fin al final de la voz, ± 1 bloque + margen;
    - que no cambian las líneas sin silencio, las que tienen palabras ni las pausas;
    - el recuento de fines fijados;
    - el `offset_ms` distinto de cero;
    - la última línea;
    - la ventana con silencio inicial;
    - que un hueco ≥ umbral activa `cuenta` y uno < umbral no;
    - el determinismo (dos ejecuciones dan resultados iguales);
    - los invariantes de la letra resultante con `validarInvariantesLetra`.
  - `estilo.test.ts`:
    - un estilo con los campos nuevos pasa la validación con una **copia congelada del `estiloSchema` de 0.1.0** (fixture) y sale como lineal estático;
    - `normalizarEstilo`;
    - `estilosIguales` con y sin `espera` legada.
  - `temas.test.ts`: fusión de `reemplazos`, `procedenciaEspera` y congelación con la espera fusionada.
  - `derivados.test.ts`: motivos de Letra lista con letra completa de API (fines automáticos y de palabras) e incompleta.
- **Vitest, renderer**:
  - `fondo.test.ts`: fase en `t` y `t + P`, `t` negativo, sentido, fase 0 con `estatico` y redondeo;
  - `estiloCss.test.ts`: tres formas y cierre cónico;
  - `contraste.test.ts`: un tramo corto entre paradas y el cierre cónico que bajan el peor ratio;
  - `render.test.ts`:
    - la espera legada da los mismos `puntos` que hoy;
    - barra y cuenta en un hueco largo;
    - la cuenta con un hueco de menos de 3 s;
    - la primera entrada sin umbral;
    - sin siguiente no hay espera;
    - el mismo `t` antes y después de buscar da el mismo fotograma;
  - `PantallaLetra.test.tsx`: `barrido={false}` no monta la capa de resaltado y los indicadores no cambian la caja del texto;
  - `estado.test.ts`: `ajustar_silencios` es un paso, y deshacer y rehacer restauran letra y apariencia.
- **E2E**: **una** prueba en `editor.spec.ts` (secundaria) para la integración real entre procesos de «Ajustar los silencios»: picos de una voz generada con silencios conocidos, lectura por trozos, aviso, aplicar, guardar y deshacer.
  - «Letra lista» se cubre con un escenario en `biblioteca-acciones.spec.ts` o `reproductor.spec.ts`: marcar, ver la insignia y reproducir sin capa de resaltado, solo si el programador no lo cubre con Vitest y dobles.
  - Los críticos se ejecutan porque se toca `shared/`.
- **Manual** (guía de la fase en `Test-manuales/`):
  - aspecto y suavidad de los tres degradados en movimiento en un equipo modesto y en la secundaria;
  - movimiento reducido del sistema operativo;
  - legibilidad de los comodines a distancia;
  - calibración con las 6 canciones del usuario.

## Consecuencias

- **Positivas**:
  - Sin subir esquemas, sin migraciones y sin canales IPC nuevos.
  - 0.1.0 sigue abriendo las canciones con una degradación visual aceptable.
  - Todo lo que se pinta es una función pura del tiempo de canción, lista para la exportación por fotogramas.
  - El ajuste de silencios es determinista, se prueba con datos sintéticos y se deshace en un paso.
- **Negativas / riesgos**:
  - Repintar el fondo en movimiento cuesta GPU y hay que medirlo.
  - El aviso de contraste es conservador.
  - Los umbrales de silencio no están calibrados hasta tener las canciones del usuario. Los restos de instrumental, la reverberación, las respiraciones y los coros pueden dar cortes falsos o fines tardíos, y un silencio intencionado dentro de una línea la corta, aunque se deshace en un paso.
  - Activar la cuenta a nivel de canción la muestra también en huecos largos anteriores.
  - Volver a 0.1.0 y guardar pierde los campos nuevos.
  - **Legales**: ninguno nuevo. No se descarga ni se distribuye contenido, y la calibración usa audio del usuario solo en su equipo.
- **Impacto en UX**:
  - Controles por forma: ángulo en lineal y cónico, centro en radial y cónico, movimiento con periodo y sentido.
  - Sección de espera con herencia y personalización.
  - Insignia y aviso de primera activación de «Letra lista».
  - Botón con aviso y recuentos para «Ajustar los silencios».
  - Restricciones y textos pendientes en [0101](../preguntas/0101-contratos-de-la-fase-5-para-las-specs.md).

## Revisiones

- 2026-11-20 (specs de la fase 5 y respuesta a [0101](../preguntas/0101-contratos-de-la-fase-5-para-las-specs.md)):
  - **`espera.clave`**: identifica el hueco y solo cambia al empezar una espera, no en cada dígito. La spec 07 (R11) anuncia una vez por hueco. Afecta a la tarea 0206, que aún no ha empezado.
  - **Cónico**: el editor reparte las paradas en i/n (G4). No cambia ni el esquema ni `fondoCss`; el cierre suave añadido en el 100 % ya da un tramo de cierre igual a los demás.
  - **Velocidad**: la interfaz ofrece Lenta, Media y Rápida (`periodo_s` 60, 30 y 15) y siempre guarda `sentido: "horario"`. Un antihorario guardado se respeta. Ninguno de los dos cambia el esquema (10–120 s).
  - **Barra**: la spec la pinta encogiéndose, con un ancho de `40 % × (1 − fraccion)`. Se usa la misma `fraccion`.
  - **Activación de la cuenta** al ajustar los silencios: la spec confirma la opción A de [0100](../preguntas/0100-decisiones-provisionales-de-la-fase-5.md) §1.

## Fuentes

- MDN, [`conic-gradient()`](https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/conic-gradient), [`radial-gradient()`](https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/radial-gradient) y [`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion).
- W3C, [WCAG 2.2: contraste mínimo 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) y [animación por interacción 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html).
- FFmpeg, filtro [`silencedetect`](https://ayosec.github.io/ffmpeg-filters-docs/7.1/Filters/Audio/silencedetect.html): ruido por defecto −60 dB y duración mínima por defecto de 2 s.
- pydub, [`silence.py`](https://git.hackliberty.org/Git-Mirrors/Sideband/src/branch/main/sbapp/pydub/silence.py) (`detect_silence`, `min_silence_len` y `silence_thresh` en dBFS) y [un ejemplo de umbral relativo al nivel del audio](https://kiwix.lema.org/stackoverflow.com_en_all_2023-11/questions/55805350/when-why-does-split-on-silence-return-an-empty-list).
- Discusiones de la alfa: [R1 arquitectura](../versiones/0.2.0/discusion/r1-arquitecto.md), [R2 arquitectura](../versiones/0.2.0/discusion/r2-arquitecto.md), [R2 UX](../versiones/0.2.0/discusion/r2-disenador-ux.md) y [R4 UX](../versiones/0.2.0/discusion/r4-disenador-ux.md); preguntas [0047](../preguntas/0047-temas-asignados-edicion-y-borrado.md), [0048](../preguntas/0048-escucha-editor-durante-evento.md) y [0049](../preguntas/0049-politica-cola-de-reproduccion.md).

## Revisión para 0.2.1 — fase 8

Fecha: 2026-11-21. Detalle en el [ADR 0021](0021-sincronia-simplificada-y-editor-preciso-de-linea.md) §4 y §Alternativas 6.

- **Barra de espera como barra de carga** (§3): sustituye a la barra centrada al 40 % que se encogía. Es una **pista de ancho fijo** con el **color de letra** y un **relleno** con el **color de resaltado** que crece de izquierda a derecha con `transform: scaleX(var(--k-fraccion))` y `transform-origin` a la izquierda, hasta llenarse en el inicio del verso. `fraccion` no cambia (`(t − origen) / (destino − origen)`). Ancho 40 % del área, grosor `máx(6 px, 1 % del alto)` y la misma posición reservada ([07 · Fase 8](../ux/07-reproductor.md#barra-de-espera-como-barra-de-carga)). Con movimiento reducido el relleno sigue avanzando de forma continua. Con `barrido={false}` («Letra lista») la pista usa el color de letra al 35 % y el relleno el color de letra; la vista previa del editor siempre pinta con barrido, así que usa los colores de karaoke. Siguen siendo solo los dos colores del tema, así que el aviso de contraste (§4) los cubre.
- **Idéntica en las cuatro superficies**: vive en `PantallaLetra` y su CSS, y en la exportación la fracción llega por el modo fotograma (`tiempoFijoMs`), sin animaciones CSS. Se comprueba con una prueba del componente en modo fotograma, sin píxeles.
- **«Ajustar los silencios»** (§6): incluye las líneas con palabras **importadas** (su fin cambia y sus palabras se descartan, ADR 0021 §4) y sigue excluyendo las líneas con palabras **manuales**. Los recuentos del diálogo cuentan las primeras como líneas normales.
- **Letra lista** (§5) no cambia: sigue sin barrido ni resaltado por palabra, también con palabras manuales.
