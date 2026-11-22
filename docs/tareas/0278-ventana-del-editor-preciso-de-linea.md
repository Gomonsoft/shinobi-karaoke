# 0278 — Ventana del editor preciso de línea: borrador, marcar al vuelo, texto, bucle y teclado

- Estado: Hecha
- Paso del pipeline: 4 (editor)
- Fase: 9 de 0.2.1 · Lote F (ventana del editor preciso), última del lote
- Depende de: 0276, 0277 (mismo lote), 0272 (operaciones puras), 0269 (`shared/escucha.ts`), 0273 (preferencias), 0275 (`fijarTramoConTono`, `tonoConservado`; si aún no está, la ventana funciona con `playbackRate` y la nota)
- ADRs: [0021](../adr/0021-sincronia-simplificada-y-editor-preciso-de-linea.md) §9; [0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md) §1 (marca con `timeStamp`, sin repeticiones)
- Spec UX: [06 · Fase 9](../ux/06-editor.md#fase-9-de-021--editor-preciso-de-línea): «La ventana» (contenido de la barra de título), «Contenido» (detalle de la palabra, bucle, ▶ Palabra, margen, velocidad, MARCAR, repartir, quitar, cancelar y aplicar), «Marcar al vuelo», «Edición rápida del texto», «Aplicar, cancelar y cerrar» (lo que pasa dentro de la ventana), «Deshacer» (borrador), «Teclado de la ventana», «Estados (fase 9)», «Accesibilidad (fase 9)» y «Microcopy (fase 9, editor)»; criterios **P5**–**P9**, **P11**, **P14**, **P15**, **P21**, **P22** (dentro de la ventana)
- Tamaño: L

## Objetivo

El contenido completo de la ventana como un componente autónomo: recibe la línea, el motor y unos *callbacks* (`alAplicar(borrador)`, `alCancelar()`, `alCambiarLinea(sentido)`), y no conoce el *reducer* del editor (eso es 0279).

## Archivos (solo estos)

- `app/src/renderer/src/vistas/editor/preciso/`: `EditorPreciso.tsx`, `estadoPreciso.ts` (*reducer* del borrador con su historial), `atajosPreciso.ts`, `textosPreciso.ts` y sus tests (los componentes de 0277 solo se importan)

## Criterios de aceptación

- [ ] Carga con `cargarBorrador` (0272); sin palabras hechas a mano, todas sin marcar repartidas (P5); manuales no válidas → sin marcar con `edi.preciso.cargadasInvalidas` (P21). Foco inicial en la tira, en la primera sin marcar; anuncio `edi.preciso.anuncio.abrir`.
- [ ] Tiradores, campos Inicio/Fin (`mm:ss.cc`), [Fijar inicio (I)]/[Fijar fin (O)] en el cabezal y Alt/Ctrl + flechas: llaman a las operaciones de 0272, paran en el límite con `edi.preciso.limite.*` 2 s y marcan la palabra (P6). Límites de la línea sin cruzar palabras marcadas (P10) y sin descartarlas.
- [ ] **Marcar al vuelo** con Intro (foco en la tira) o `pointerdown`/`pointerup` en «MARCAR»: instante = `motor.tiempoDeEvento(evento.timeStamp) − offset_ms`; ignora `repeat`; mantener ≥ 300 ms fija el fin; `edi.preciso.fuera` / `edi.preciso.pronto` 2 s sin marcar; pasada y Retroceso como la spec (cabezal a 1 s antes de la marca deshecha, dentro del bucle) (P7, P8). La ventana de la app pierde el foco → pausa.
- [ ] **Bucle** (`aria-pressed`, Espacio): `fijarBucle([inicio − margen, fin + margen])` y `fijarTramoConTono` con la vista; reanuda donde estaba. **▶ Palabra** / Mayús + Espacio / doble clic en la palabra: `reproducir({ desdeMs: inicio − MARGEN_ESCUCHA_PALABRA_MS, hastaMs: fin + MARGEN_ESCUCHA_PALABRA_MS })`, pausa el bucle y lo reanuda al terminar, vuelve a la posición previa. **Margen** 0 / 0,5 / 1 s (por defecto 0,5) guardado con la preferencia de 0273. **Velocidad**: el mismo estado que el transporte; `edi.preciso.tono` solo si `tonoConservado` es `false` con velocidad < 1× (P9).
- [ ] **Texto**: campo de una línea; Intro o salir confirma en el borrador con `reaplicarTexto` (aviso `edi.preciso.texto.repartidas`), Esc restaura, vacío → `edi.preciso.texto.vacio`, pegar varios renglones los une con un espacio, máximo de longitud de la vista Letra; los atajos de una tecla no actúan dentro del campo (P11).
- [ ] **Borrador**: cada operación es un paso del historial local; Ctrl/Cmd + Z / Mayús + Z / Ctrl + Y con el foco en la ventana (fuera del campo) deshacen y rehacen solo el borrador (P15). «Repartir de nuevo» y «Quitar los tiempos por palabra» (tira atenuada + `edi.preciso.quitar.aviso`).
- [ ] **Cerrar**: Aplicar (botón secundario y Ctrl/Cmd + Intro), ✕ y Esc llaman a `alAplicar` (sin cambios: solo cierran); Cancelar sin cambios cierra, con cambios muestra `edi.preciso.descartar` con el foco en «Seguir editando» (P14). Anterior/Siguiente y ↑/↓ llaman a `alCambiarLinea`; en los extremos `disabled` con `edi.preciso.extremo`.
- [ ] Teclado de la tabla de la spec; con el foco en la ventana no actúan L, Mayús + L, P, Supr, F, Ctrl/Cmd + E ni Inicio como «ir al principio» (`preventDefault`) (P22, parte de la ventana). Anuncios solo en los hitos de la spec.

## Pruebas de feedback

- Unitarias: `estadoPreciso.test.ts` (historial del borrador), `atajosPreciso.test.ts`, pruebas de componente de `EditorPreciso` con un motor doble (marcar con `timeStamp` simulados a 0,5×, 0,75× y 1×: error ≤ 20 ms; mantener; fuera/pronto; Retroceso; bucle y ▶ Palabra; texto; cancelar con cambios).
- E2E: ninguna (la cubre 0280).
- Críticos: no.
- Manual: guía de la fase 9 — marcar a mano una línea rápida y una lenta de una canción real a 0,5× y a 1×.

## Notas de implementación

Hecho. En `app/src/renderer/src/vistas/editor/preciso/`: `EditorPreciso.tsx` (ventana completa: monta `VentanaFlotante` y los componentes de 0277), `estadoPreciso.ts` (reducer del borrador con historial y pasada), `atajosPreciso.ts` (tabla de teclas pura), `textosPreciso.ts` (ampliado), `editorPreciso.module.css` y tests (`estadoPreciso`, `atajosPreciso`, `EditorPreciso`, con un motor doble).

API para 0279 (`EditorPrecisoProps`):
- Datos: `letra`, `lineaId`, `duracionMs`, `cancionId`, `separada`, `numeroLinea`, `totalLineas`, `hayAnterior`, `haySiguiente`. El borrador se recarga cuando cambia la identidad de `letra` o `lineaId` (pasar una `letra` estable).
- Motor: `motor: PuertoMotorPreciso` = el `MotorAudio` del editor (mismo que el transporte; usa `estado`, `suscribir`, `posicionMs`, `reproducir`, `pausar`, `buscar`, `fijarBucle`, `fijarTramoConTono`, `fijarVelocidad`, `tiempoDeEvento`). La velocidad es la del motor (estado compartido). Al cerrar se llama a `fijarBucle(null)`, `fijarTramoConTono(null)` y se pausa si el bucle sonaba.
- Controlado: `margenMs` + `alCambiarMargen(0|500|1000)`, `preferencia` (geometría) + `alCambiarPreferencia`, `limites`, `referencia`.
- Interno: borrador con historial, selección, pasada, texto del campo, avisos, estado del bucle y la confirmación de descarte.
- Salidas: `alAplicar({borrador, textoNuevo})` (solo si hay cambios; luego `alCerrar` o `alCambiarLinea`), `alCerrar()`, `alCambiarLinea(-1|1)`, `alElegirPista(1|2|3)`, `alFijarInicioAqui()`, `alCambiarBorrador(borrador|null)` (vista previa en vivo), `alSalirDelFoco()` (F6), `anunciar(texto)`.
- `ref` (`EditorPrecisoApi`): `obtenerCambios()` (para aplicar el borrador desde fuera: F, Ctrl+E, ⟲, sincronizar…), `enfocarTira()`, `enfocarUltimo()` y `elemento()`.

Decisiones: la ventana trabaja en tiempo de letra (campos y tira; `offset_ms` solo al hablar con el motor y los picos). El tramo con tono es toda la vista (inicio − máx(margen, 250) a fin + máx(margen, 250)). Si una línea mide menos de 20 ms por palabra se muestra un aviso en lugar del editor. Ctrl/Cmd + Intro, ✕ y Esc aplican y cierran; sin cambios solo cierran.

Deuda: la detección de «volver a empezar el bucle» (reinicio de la pasada) usa un salto atrás del cabezal en un bucle de `requestAnimationFrame` y no tiene prueba automática (sí la tiene el reducer); la ayuda de límite de campos/tiradores se muestra en la línea del recuento y no como tooltip anclado; los anuncios de «cambiar de línea» los hace la apertura de la nueva línea. Manual: marcar a mano una línea rápida y otra lenta de una canción real a 0,5× y a 1×; comprobar el tono conservado dentro de la ventana y el reinicio de la pasada al volver el bucle.

