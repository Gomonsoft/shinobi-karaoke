# Informe de fase 5 · Estilo, espera, Letra lista y Ajustar los silencios

Las tareas 0200–0219 del [backlog](backlog.md) entregan cuatro features: degradados radial y cónico con movimiento opcional (feature 8), indicadores de espera configurables (puntos, barra y cuenta 3·2·1; feature 9), la modalidad «Letra lista», que se reproduce sin barrido (feature 12), y «Ajustar los silencios», que fija el fin de cada línea al final de la voz (feature 13). Las specs son [Editor · Fase 5](../../ux/06-editor.md#fase-5-de-020--estilo-espera-y-letra-lista) (G1–G12, IE1–IE7, LL1–LL8, AS1–AS9 y F5-1), [Reproductor · Fase 5](../../ux/07-reproductor.md#fase-5-de-020--estilo-espera-y-letra-lista) (R1–R14) y [Biblioteca · Fase 5](../../ux/02-biblioteca.md#fase-5-de-020--estilo-espera-y-letra-lista) (LB1–LB7). Decisión: [ADR 0018](../../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md), con la revisión del 2026-11-20 que lo alinea con las specs, y revisiones de 0005, 0006, 0010, 0011, 0015 y 0016.

**Estado: Implementada; CI sin confirmar en verde sobre el HEAD; pendiente de la guía manual y de la calibración de «Ajustar los silencios».** Las dos guías ([estilo, espera y Letra lista](../../Test-manuales/0.2.0/fase-5-estilo-espera-y-letra-lista.md), 18 casos, y [calibración de silencios](../../Test-manuales/0.2.0/fase-5-calibracion-de-silencios.md)) **no se han ejecutado todavía**. Todo lo que depende de ellas (fluidez en un equipo modesto, legibilidad a 5 m, velocidades que no marean, movimiento reducido real del sistema, comparación píxel a píxel con 0.1.0, la calibración con las 6 canciones del usuario) consta aquí como «pendiente de la guía manual», no como verificado. El cierre formal de la fase espera a esa ejecución.

**«Ajustar los silencios» no está calibrado.** El algoritmo ([`shared/silencios.ts`](../../../app/src/shared/silencios.ts)) y su interfaz están implementados y probados, pero solo con picos de voz sintéticos. Los parámetros (`PARAMETROS_SILENCIOS`: percentil 0,95, piso −60 dBFS, umbral relativo −30 dB, silencio mínimo 400 ms, voz mínima 50 ms, margen de cola 100 ms) son los **provisionales del ADR 0018 §6.4**. Ninguna prueba los ha contrastado con voz real, y el criterio AS9 (comparar los fines propuestos con los que el usuario fijó a mano en sus 6 canciones y anotar cuántos difieren más de 200 ms) **no se ha ejecutado**. La herramienta de calibración existe (`npm run calibrar:silencios`, tarea 0210) pero nadie la ha corrido con canciones reales. Hasta entonces, no se sabe cuántos «cortes falsos» (un fin propuesto antes del final real de la voz) produce; el diseño lo mitiga porque la acción es de un solo paso de deshacer y siempre pide confirmación con recuentos.

La fase vive en `alpha-2` (PR borrador [#9](https://github.com/Gomonsoft/shinobi-karaoke/pull/9)), junto con las fases 4 y 6.

## Qué se entregó

| Tarea | Entrega | Estado |
|---|---|---|
| [0200](../../tareas/0200-esquema-del-estilo-ampliado-y-normalizacion.md) | Esquema ampliado del estilo (`forma`, `centro`, `movimiento`, `espera`), `shared/espera.ts`, `normalizarEstilo`, `estilosIguales` normalizado, copia congelada del esquema de 0.1.0 | Hecha |
| [0201](../../tareas/0201-contratos-de-cancion-apariencia-config-e-ipc-de-la-fase-5.md) | Contratos: `cancion.modalidad`, `apariencia.reemplazos`, motivos de Letra lista (`FIN_NO_VALIDO`), `config.editor.omitir_aviso_letra_lista`, IPC, entrada de sesión, preload y dobles | Hecha |
| [0202](../../tareas/0202-resolucion-de-apariencia-con-reemplazos-de-espera.md) | `resolverApariencia` con reemplazos de espera, `procedenciaEspera`, instantánea de respaldo y congelado al borrar un tema | Hecha |
| [0203](../../tareas/0203-main-marcar-letra-lista-guardar-reemplazos-y-modalidad-en-la-sesion.md) | Main: `marcarLista` con modalidad, volver a borrador, `guardarApariencia` con reemplazos, `modalidad` en la entrada de la sesión | Hecha |
| [0204](../../tareas/0204-geometria-del-fondo-y-css-de-los-tres-degradados.md) | `geometriaFondoEn`, `fondoCss` y `fondoCssEn` (lineal, radial, cónico con cierre) | Hecha |
| [0205](../../tareas/0205-peor-contraste-por-tramos-y-cierre-conico.md) | Peor contraste por tramos (9 muestras por tramo) y cierre del cónico | Hecha |
| [0206](../../tareas/0206-derivacion-de-los-comodines-de-espera-en-el-fotograma.md) | `espera` en `FotogramaLetra` (puntos, barra, cuenta, primera entrada, `clave` por hueco) | Hecha |
| [0207](../../tareas/0207-deteccion-de-voz-y-propuesta-de-ajuste-de-silencios.md) | `detectarVoz` y `proponerAjusteSilencios` (puras), `generarPicos` | Hecha |
| [0208](../../tareas/0208-lectura-del-nivel-base-de-picos-en-el-editor.md) | `leerPicosBase` (nivel base de picos en ventanas, con memo) | Hecha |
| [0209](../../tareas/0209-historial-del-editor-reemplazos-y-ajustar-silencios.md) | Historial del editor: `reemplazos`, acciones `espera` y `ajustar_silencios` (un paso) | Hecha |
| [0210](../../tareas/0210-herramienta-de-calibracion-del-ajuste-de-silencios.md) | `calibrar:silencios` (solo lectura; 144 combinaciones) y su guía | Hecha; **sin ejecutar con canciones reales** |
| [0211](../../tareas/0211-editor-controles-de-degradado-y-movimiento.md) | Forma, cuadrícula de centro, ángulo de inicio, reparto i/n, movimiento, velocidad y botón «Detener el movimiento del fondo» | Hecha |
| [0212](../../tareas/0212-editor-indicadores-de-espera.md) | Sección «Indicadores de espera», umbral, propios o del tema, D3 y «Ver un ejemplo» | Hecha |
| [0213](../../tareas/0213-pantalla-de-letra-fondo-en-movimiento-indicadores-y-sin-barrido.md) | `PantallaLetra`: fondo en movimiento, barra, cuenta, modo sin barrido y anuncio de espera | Hecha |
| [0214](../../tareas/0214-editor-letra-lista.md) | Botón y diálogo de Letra lista, cambio de modalidad desde el ⋯, contraste informativo | Hecha |
| [0215](../../tareas/0215-editor-ajustar-los-silencios.md) | Botón y menú «Ajustar los silencios», motivos, diálogo con recuentos y lista, toast con [Deshacer], resalte | Hecha |
| [0216](../../tareas/0216-reproductor-sesion-y-probar-modalidad-y-movimiento.md) | `barrido` según la modalidad en reproductor local, secundaria y «Probar»; fondo quieto en S1–S4 | Hecha |
| [0217](../../tareas/0217-biblioteca-insignia-letra-lista.md) | Insignia «Letra lista», nombre accesible, ayuda, toast de vuelta | Hecha |
| [0218](../../tareas/0218-capturas-de-revision-de-la-fase-5.md) | `fase5-capturas.spec.ts` (opt-in) y 35 capturas | Hecha |
| [0219](../../tareas/0219-integracion-guia-manual-e-informe-de-la-fase-5.md) | `fase5.spec.ts` (4 pruebas), guías manuales, este informe | Hecha; el cierre formal espera a la guía manual y a la calibración |

## Verificación

### Estrategia

Con la [estrategia de pruebas](../../pruebas.md), la lógica va a Vitest y los E2E cubren solo lo que exige Electron real. Para esta fase:

- **Vitest** (cada tarea): esquemas y contratos (`shared/{espera,estilo,fase5}.test.ts`), resolución y escritura en main (`shared/temas.test.ts`, `main/biblioteca/escritura.test.ts`, `main/temas/*.test.ts`, `main/sesion/servicio.test.ts`), render (`karaoke/{fondo,estiloCss,contraste,render,PantallaLetra}.test.*`), silencios (`shared/silencios.test.ts`, `vistas/editor/picosBase.test.ts`, `vistas/editor/silencios/*.test.*`, `scripts/calibrar-silencios.test.ts`), editor (`vistas/editor/estilo/*.test.*`, `BotonLetraLista.test.tsx`, `Editor.test.tsx`, `PanelEstilo.test.tsx`, `estado.apariencia.test.ts`), reproductor (`Reproductor.modalidad.test.tsx`, `AppSecundaria.test.tsx`) y Biblioteca (`tarjeta.test.tsx`, `Biblioteca.test.tsx`).
- **E2E** (`app/e2e/fase5.spec.ts`, 4 pruebas, unos 18 s, estable en 2 pasadas locales; sin red, audio generado, letras inventadas): **F1** «Letra lista de punta a punta…», **F2** «Letra lista en la sesión…», **F3** «la misma fase del fondo a 12,3 s…», **F4** «movimiento reducido…». A ellas se suma, en `e2e/editor.spec.ts`, **AS** «ajustar los silencios: propone, aplica con la cuenta y se deshace en un paso» (voz generada con pulsos de 1,5 s). Todas son secundarias. La suite crítica (`@critico`) pasa a comprobar también «sin scroll de página» en la Biblioteca y en el Editor (regla 9 de `pruebas.md`).
- **Capturas**: `e2e/fase5-capturas.spec.ts`, opt-in (`SHINOBI_CAPTURAS_5=1`), fuera de la regresión.

### CI

| Ejecución | Commit | Resultado |
|---|---|---|
| [44858445678](https://github.com/Gomonsoft/shinobi-karaoke/actions/runs/44858445678) (`alpha-2`, PR #9) | `750727b` | **Correcto en los 6 trabajos.** En Ubuntu: Vitest 3134 correctas y 12 omitidas (235 archivos), E2E con xvfb **193 correctos, 25 omitidos, 0 fallos**; worker 346 correctas. Es el último verde completo. |
| [44860307263](https://github.com/Gomonsoft/shinobi-karaoke/actions/runs/44860307263) | `8d2c700` | **Fallo.** Ubuntu y macOS en rojo; Windows en verde. Ubuntu: Vitest 3184 correctas, E2E 193 correctos y **1 fallo** (`exportacion-captura` 640×480, prueba desfasada tras la 0243: ver el [informe de la fase 6](informe-fase-6.md#defectos-encontrados-por-el-ci-o-el-ensayo-y-su-corrección)); corregida en `fd5a9eb`. macOS: **1 fallo unitario** en `Progreso.test.tsx` («con el motor reparado reintenta separar incluso si Rápido quedó pendiente»), intermitente y **en investigación** (ya falló una vez en Windows en otro caso). |
| [44861652267](https://github.com/Gomonsoft/shinobi-karaoke/actions/runs/44861652267) | `fd5a9eb` | **Completado: fallo, sin regresión de la fase.** Windows en verde. Ubuntu: Vitest 3184 correctas; E2E **195 correctos, 27 omitidos y 1 fallo**: `temas-editor.spec.ts:434` («los botones de los diálogos de tres acciones caben en el diálogo… a 100 %», de la fase 3) por **tiempo agotado de 90 s** con «Worker teardown timeout» (la app no cerró): **inestable**, no relacionado con las specs de esta fase (`fase5.spec.ts` y `exportacion*.spec.ts` pasan; `exportacion-captura` 640 × 480 ya pasa tras `fd5a9eb`). macOS: **1 fallo unitario** distinto del anterior, `Editor.test.tsx` («recarga una visita desactualizada en pausa»): **inestable**. Con este run ya van dos pruebas unitarias de macOS que fallan de forma intermitente (`Progreso.test.tsx` y `Editor.test.tsx`) y una de Windows. |

Ninguno de los fallos de estas ejecuciones es de código de esta fase (las 4 pruebas de `fase5.spec.ts` y «ajustar los silencios» pasan en los dos últimos runs). Los E2E solo corren en Ubuntu; Windows y macOS ejecutan Vitest. Los dos commits locales posteriores a `fd5a9eb` (`03d81e8` y `6339db2`, el arreglo del diálogo de exportación) no están empujados todavía, así que ningún run cubre el HEAD local. Antes de fusionar a `main` hay que reconfirmar el verde sobre el HEAD final.

### Defectos encontrados y su corrección

| Defecto | Clasificación | Corrección |
|---|---|---|
| 14 pruebas de `editor-layout.spec.ts` fallaron en el run [44856768872](https://github.com/Gomonsoft/shinobi-karaoke/actions/runs/44856768872) (`acc0e0b`): 1 px de scroll de página en el Editor | **Regresión** de la fase 6 (región `aria-live` del proveedor de exportación, `ProveedorExportacion`), no de esta fase; ya había ocurrido en la fase 4 con otro aviso oculto | Clase única `soloLector` (`componentes.module.css`; `90b2d78`, `774ec8d`); los críticos comprueban `scrollHeight ≤ innerHeight`; regla 9 de `pruebas.md` |
| La tarea 0215 informó de «9 fallos de `editor-layout.spec.ts` que ya existían sin el botón» (p. ej. 721 px de scroll vertical a 1280 × 720) | **De entorno o el mismo 1 px**, sin confirmar | No se reprodujo en el CI tras la clase única. AS1 en los seis viewports sigue sin medirse (ver criterios) |
| Dos tareas no pudieron completar el E2E crítico en su entorno local («Leyendo el audio…» no termina; 0206, 0209) | **De entorno** (sandbox y red), el CI lo da en verde | Sin cambios |
| Pruebas unitarias intermitentes en macOS (`Progreso.test.tsx`, `Editor.test.tsx`), una vez en Windows, y un E2E de la fase 3 (`temas-editor.spec.ts:434`) con tiempo agotado | **Inestable**, causa sin determinar | En investigación; ver CI |

No se encontró ningún defecto de la lógica de la fase en el CI.

### Medidas

| Medida | Valor | Origen |
|---|---|---|
| `fase5.spec.ts` completa | unos 18 s (4 pruebas, 2 pasadas) | Tarea 0219, un equipo macOS |
| `fase5-capturas.spec.ts` | unos 4 min | Tarea 0218 |
| Fluidez del fondo en movimiento a 1920 × 1080 (G12) | Pendiente de la guía manual (casos 4.1 y 9.1) | — |
| Velocidad más cómoda y mareo (TV a 5 m) | Pendiente de la guía manual (5.3–5.5) | — |
| Cuenta y barra legibles a 5 m (TV 55" y proyector) | Pendiente de la guía manual (6.1–6.5) | — |
| Fines que difieren más de 200 ms de los del usuario (AS9) | **Pendiente de la calibración**: ejecutar `calibrar:silencios` con las 6 canciones y la guía (casos 14 y 15, y guía de calibración) | — |

No hay medidas de rendimiento automáticas del render con fondo en movimiento.

### Capturas

35 PNG en [`docs/ux/revision-0.2.0-fase-5/`](../../ux/revision-0.2.0-fase-5/README.md), tomadas el 2026-11-20 en un Mac con una sola pantalla Retina: editor 11 estados × 2 (1280 × 720 al 100 % y al 125 %), reproductor 6 estados × 2 (1920 × 1080 y 1280 × 720) y Biblioteca 1. **Limitación:** las de 1920 × 1080 del reproductor salen recortadas en alto (macOS limita `setContentSize` a la pantalla real); para R14 exacto hace falta un monitor de al menos 1080 px de alto. La revisión del diseñador sigue por hacer. Comando: `SHINOBI_CAPTURAS_5=1 npx playwright test e2e/fase5-capturas.spec.ts --workers=1` desde `app/`.

## Resultado por criterio

Leyenda: «V» = Vitest (archivo bajo `app/src/`; `renderer/src/` se abrevia como `R/`); «F1–F4» y «AS» = E2E de arriba; «Guía n» = caso de la guía manual, **no ejecutada**. Un criterio cuya parte dependiente de la guía no está verificada se marca «Parcial»; «Sin evidencia» significa que no hay prueba automática ni la guía lo cubre del todo.

### Editor · Degradados y movimiento (G)

| Criterio | Verificación | Resultado |
|---|---|---|
| G1 · Forma Lineal/Radial/Cónico y sus controles; conservar datos; < 100 ms; un paso de deshacer | V `R/vistas/editor/estilo/ControlesFondo.test.tsx` («cambia de forma conservando datos y repartiendo las paradas»: conserva colores, ángulo y movimiento; el centro solo aparece en radial). Sin prueba del tiempo de respuesta ni del paso de deshacer. Guía 1.1–1.5 | Parcial |
| G2 · Estilo de 0.1.0 o de la fase 3 idéntico píxel a píxel | V `shared/estilo.test.ts` («un estilo de 0.1.0 valida igual y se normaliza como lineal estático…»), `renderer/karaoke/estiloCss.test.ts` (la misma cadena `linear-gradient`), `shared/temas.test.ts` (`estilosIguales`), `PantallaLetra.test.tsx` («R2, R3 y G2…»: sin movimiento el CSS es el de siempre). **No hay comparación de capturas**: 0219 la pasa a la guía. Guía 17.1 | Parcial |
| G3 · Cuadrícula Centro: flechas sin dar la vuelta, anuncio de cada celda, vista previa | V `ControlesFondo.test.tsx` («mueve el centro con el teclado sin dar la vuelta», «no marca ninguna celda con un centro fuera de la cuadrícula»). El reflejo en la vista previa no se prueba. Guía 1.2–1.3 | Parcial |
| G4 · Paradas i/n en el cónico; sin costura | V `vistas/editor/estilo/paradas.test.ts` («reparte el cónico en i/n», «reparte el lineal y el radial de 0 a 1»), `contraste.test.ts` («el cierre del cónico…»). Sin costura visible: Guía 2 | Parcial (la costura es solo manual) |
| G5 · Movimiento: desmarcado al inicio, Media 30 s horario, Lenta 60 y Rápida 15, «45 s», cálculo de ángulo y órbita | V `ControlesFondo.test.tsx` («activa el movimiento, cambia la velocidad y conserva el sentido», «muestra un periodo guardado distinto como cuarta opción»: un antihorario de 45 s se conserva), `karaoke/fondo.test.ts` («radial: fase 0 en el centro y a mitad de periodo (0, 2A)», «antihorario invierte el ángulo»), `PantallaLetra.test.tsx` («R2, R3 y G2…»: lineal 135° a 7,5 s da 225°), `estiloCss.test.ts` (el cónico gira) | Correcto (V) |
| G6 · En pausa quieto; al buscar, misma fase en editor y reproductor (12,3 s) | E2E F3 (`--k-fondo` idéntico en la vista previa y en «Probar a pantalla completa» y distinto de la fase 0); V `fondo.test.ts` («es periódica y admite t negativo»), `PantallaLetra.test.tsx` | Correcto (V y E2E) |
| G7 · «Detener el movimiento del fondo»: solo con movimiento, `aria-pressed`, no cambia el archivo ni el historial, «Probar» sigue con movimiento | V solo del soporte: `PantallaLetra.test.tsx` (prop `fondoEstatico` fija la fase 0); E2E F4 (el botón no aparece con movimiento reducido). **No hay prueba del botón** (0211: «sin prueba automática del repintado en pausa»). Guía 1.8–1.10 y 18.4 | Parcial |
| G8 · Movimiento reducido: fase 0, nota `edi.fondo.mov.reducido`, sin «Detener», la casilla guarda | E2E F4 (emulación de `prefers-reduced-motion`); V `ControlesFondo.test.tsx` («avisa del movimiento reducido y deja la casilla editable»). Con el ajuste real del sistema: Guía 7 | Correcto (V y E2E) |
| G9 · Forma, centro, ángulo, movimiento y velocidad en un tema; reaplicar; sobrevivir a eliminar el tema | El esquema acepta los campos (`estilo.test.ts`) y «Guardar como tema nuevo…» se prueba (`Editor.temas.test.tsx`, T14–T15), pero **ninguna prueba comprueba estos campos** al guardar, aplicar ni eliminar. Guía 1.11 (guardar y aplicar) y 18.1 (eliminar) | **Sin evidencia automática** |
| G10 · Peor contraste de todos los tramos y del cierre cónico; sin texto «durante el movimiento» | V `karaoke/contraste.test.ts` («considera el peor caso del degradado…», «un tramo estrecho entre paradas próximas aporta sus grises», «el cierre del cónico avisa y el lineal no») | Correcto (V) |
| G11 · D1 y D4 muestran el resumen con forma y movimiento; controles no editables | V `ControlesFondo.test.tsx` («resume el fondo en D1 y D4»): solo la función pura `resumenFondo`, no el panel montado en D1/D4. Guía 1.12 | Parcial |
| G12 · Fluidez a 1920 × 1080 en un equipo modesto | Guía 4.1 y 9.1 | Pendiente de la guía manual |

### Editor · Indicadores de espera (IE)

| Criterio | Verificación | Resultado |
|---|---|---|
| IE1 · Sin `espera` se muestra solo Puntos, primera línea y 4,0 s; el render sigue igual; abrirlos no escribe | V `karaoke/render.test.ts` («tabla legada: puntos por instante», «muestra el indicador con un hueco de 4 s…»), `SeccionEspera.test.tsx` («D2: las casillas y el valor por defecto de 0.1.0»), `useEspera.test.ts`, `shared/estilo.test.ts`. **«Abrirlos no escribe nada»: sin prueba.** Guía 8.1, 17.2 y 18.2 | Parcial |
| IE2 · Las siete combinaciones se guardan y se ven; sin casillas no sale nada; primera entrada sin marcar | V `render.test.ts` («sin siguiente, sin primera entrada o sin casillas no hay espera»), `SeccionEspera.test.tsx` («“Antes de la primera línea” queda inactiva…»). No se recorren las siete combinaciones. Guía 8.2–8.3 y 18.3 | Parcial |
| IE3 · Silencio mínimo 1,0–60,0 s, pasos, coma o punto; hueco de 5,9 s no y de 6,0 s sí | V `SeccionEspera.test.tsx` («acepta coma, punto y sufijo…», «el campo admite flechas, Re Pág, coma y limita el rango con aviso»), `render.test.ts` («hueco de 2 s con umbral 1000…»). Sin prueba de los botones [−]/[+] ni del límite exacto 5,9/6,0 s. Guía 8.4–8.6 | Parcial |
| IE4 · D1: «Cambiar solo en esta canción» y «Usar los del tema»; el tema no cambia; un paso de deshacer; otro tema conserva los propios | V `useEspera.test.ts` («D1 sin reemplazo es un resumen…», «D1 con reemplazo edita el reemplazo y “Usar los del tema” lo retira»), `SeccionEspera.test.tsx` (D1), `shared/temas.test.ts` y `main/biblioteca/escritura.test.ts` (reemplazos). Sin prueba de «`tema.usos` igual», del paso de deshacer ni de elegir otro tema. Guía 8.10–8.13 | Parcial |
| IE5 · Editar en D3 cambia las canciones del tema salvo las de propios | V `useEspera.test.ts` («D3 edita el borrador del tema y avisa si la canción tiene propios»), `SeccionEspera.test.tsx` («D3 con propios…»), `shared/temas.test.ts` (fusión). Con main real: Guía 8.14 | Parcial |
| IE6 · «Ver un ejemplo»: hueco de 6 s, píldora, sin audio, cabezal ni historial; Esc; anuncios | V `vistas/editor/estilo/ejemploEspera.test.ts` (modelo del ejemplo), `SeccionEspera.test.tsx` («el botón del ejemplo alterna su nombre»). El comportamiento (Esc, pausa antes, sin historial) y los anuncios no tienen prueba. Guía 8.7–8.9 y 18.5 | Parcial |
| IE7 · A 300, 360 y 480 px, sin scroll de página, sin cortes, fila «Silencio mínimo» entera | `e2e/temas-editor.spec.ts` («con el panel a 300, 360 y 480 px…») mide los botones de tema, **no** la sección de espera. Capturas `editor-1280x720-{100,125}-espera-d2.png`. Guía 8.15 | **Sin evidencia automática** |

### Editor · Letra lista (LL)

| Criterio | Verificación | Resultado |
|---|---|---|
| LL1 · «Marcar como letra lista» (secundario) junto a «Marcar como lista»; la fila no se parte | E2E F1 (el botón existe y se pulsa). **Ninguna prueba mide la fila a 1024 × 576 ni 1280 × 720.** Capturas `*-dock-letra-lista.png`. Guía 10.1 y 18.6 | Parcial |
| LL2 · Disponibilidad y popover de motivos | V `BotonLetraLista.test.tsx` («con faltas muestra el popover con su título y “Ir a ella”»), `shared/fase5.test.ts` (`motivosParaNoEstarLetraLista`, `FIN_NO_VALIDO`). El motivo de «separación en curso» no se prueba. Guía 10.2 | Parcial |
| LL3 · Diálogo de la primera vez, foco, cancelar, casilla persistente | V `BotonLetraLista.test.tsx` («cancelar el aviso no escribe nada y devuelve el foco», «confirmar con la casilla guarda la preferencia y marca con la modalidad», «con el aviso omitido marca directamente…»), E2E F1 (casilla y confirmar), `shared/fase5.test.ts` (lectura tolerante de la preferencia). El texto exacto, el foco inicial en confirmar y la persistencia tras reiniciar no tienen prueba. Guía 10.3–10.5 y 10.12–10.13 | Parcial |
| LL4 · Biblioteca enfoca y resalta, toast, cabecera «✓ Letra lista», vista previa con barrido | E2E F1 (`[data-resaltada]`, insignia, vista previa con `[data-barrido]`), V `vistas/biblioteca/tarjeta.test.tsx` («el toast de vuelta distingue la modalidad»). La cabecera «✓ Letra lista» y el [▶ Reproducir] del toast no tienen prueba. Guía 10.6 y 10.11 | Parcial |
| LL5 · Cambio de modalidad desde el ⋯, sin historial, persistente | V `R/vistas/editor/Editor.test.tsx` («cambia entre Lista y Letra lista desde el menú ⋯ sin salir ni tocar el historial»), `main/biblioteca/escritura.test.ts` (persistencia) | Correcto (V) |
| LL6 · Línea sin tiempos en una Letra lista: insignia incompleta, `edi.hecho.incompleta`, volver a borrador | V `CabeceraCancion.test.tsx` («Falta 1 línea», genérico), `BotonLista.test.tsx` («Hecho y volver a borrador», de una Lista). No se prueba con una Letra lista. Guía 10.15–10.16 | Parcial |
| LL7 · Contraste informativo en Letra lista | V `vistas/editor/PanelEstilo.test.tsx` («en Letra lista presenta resaltado y diferencia como informativos (LL7), la letra no») | Correcto (V) |
| LL8 · «Probar» sin barrido en Letra lista, con barrido en borrador o Lista | V `vistas/reproductor/Reproductor.modalidad.test.tsx` («Letra lista sin barrido y Lista con barrido» para el origen `editor`). Guía 12 | Correcto (V) |

### Editor · Ajustar los silencios (AS)

| Criterio | Verificación | Resultado |
|---|---|---|
| AS1 · Botón en la línea de tiempo (solo icono bajo 1280 px) y en el ⋯; la fila no se parte en 6 viewports | AS (el botón existe y se pulsa por su nombre). **Ninguna prueba mide la fila en los viewports** (0215: «queda pendiente de las capturas de 0218», que no cubren el botón solo icono). Guía 14.1–14.3 y 18.6 | Parcial |
| AS2 · Motivos de no disponibilidad y popover | V `silencios/useAjustarSilencios.test.ts` (`motivosSilencios`: «lista los motivos en orden», «sin separación solo se cita la separación»; «con los picos sin preparar avisa y no abre nada»). El botón `aria-disabled`, el popover, [Ir a la primera] y [Reintentar] no se montan en ninguna prueba. Guía 14.4–14.7 | Parcial |
| AS3 · Recuentos y lista revelada con datos conocidos | AS (cuántas líneas cambian, cuántos fijados, 2 silencios largos, «Ver las líneas»); V `DialogoAjustarSilencios.test.tsx` («muestra los recuentos…», «omite lo que no aplica y cita la cuenta que ya estaba activa», «la lista revelada muestra exactamente las líneas de cambios») | Correcto (V y E2E) |
| AS4 · Fin al final de la voz; sin tocar palabras ni pausas; invariantes | V `shared/silencios.test.ts` (14 casos: «fija los fines al final de la voz más el margen…», «no toca líneas con palabras ni pausas…», «sustituye un fin fijado…», «la última línea llega hasta la duración»); AS (fines a 3,6 s, 11,6 s, 19,6 s y 27,6 s ± 30 ms; la línea sin silencio no cambia) | Correcto (V y E2E), con voz sintética |
| AS5 · Cuenta activada solo para la canción, con el resto intacto; vista previa | AS (`estilo.espera.cuenta` pasa a `true` y vuelve a `false` al deshacer), V `silencios.test.ts` («activa la cuenta con un hueco largo; con la cuenta activa devuelve null»). La rama con tema o heredar (`reemplazos.espera`) del reductor no tiene prueba. Guía 14.19–14.20 y 14.34–14.35 | Parcial |
| AS6 · Un solo Ctrl/Cmd + Z (o [Deshacer]) devuelve todo; Ctrl/Cmd + Mayús + Z rehace | AS (Ctrl/Cmd + Z devuelve fines e indicadores en un paso). El toast [Deshacer] y el rehacer no tienen prueba. Guía 14.22–14.23 | Parcial |
| AS7 · Sin cambios no hay diálogo ni paso; cancelar devuelve el foco | V `useAjustarSilencios.test.ts` («sin cambios no abre el diálogo y lo anuncia»: no despacha), `DialogoAjustarSilencios.test.tsx` («…enfoca confirmar y Esc cancela»). El foco al botón tras cancelar no se prueba. Guía 14.15 y 14.28–14.29 | Parcial |
| AS8 · Recuentos distintos al confirmar: no se aplica y `edi.silencios.obsoleto` | V `useAjustarSilencios.test.ts` («si los recuentos cambian al confirmar no aplica y avisa de obsoleto»), `DialogoAjustarSilencios.test.tsx` («el aviso de obsoleto es un alert») | Correcto (V) |
| AS9 · 6 canciones de referencia: cuántos fines difieren más de 200 ms | **Pendiente de la calibración** (guía de calibración y caso 15 de la guía principal) | **Pendiente de la guía manual; umbral sin calibrar** |

### Editor · Capturas (F5-1)

| Criterio | Verificación | Resultado |
|---|---|---|
| F5-1 · 11 estados a 1280 × 720 al 100 % y al 125 % | 22 PNG en `docs/ux/revision-0.2.0-fase-5/` (`fondo-radial`, `fondo-conico-movimiento`, `fondo-reducido`, `espera-d2`, `espera-d1-propios`, `espera-ejemplo`, `dock-letra-lista`, `dialogo-letra-lista`, `silencios-no-disponible`, `dialogo-silencios`, `silencios-aplicado`) | Correcto (revisión del diseñador pendiente) |

### Reproductor (R)

| Criterio | Verificación | Resultado |
|---|---|---|
| R1 · Radial y cónico iguales que en la vista previa en el mismo instante | E2E F3 (cónico: misma geometría calculada); V `fondo.test.ts`, `estiloCss.test.ts`. El radial no se compara entre las dos vistas y no hay comparación de captura | Parcial |
| R2 · Misma fase, quieto en pausa, salto al buscar, fase 0 en 0:00 | V `PantallaLetra.test.tsx` («R2, R3 y G2…»), `fondo.test.ts` (t negativo y fase 0); E2E F3 y F4 (quieto en pausa 0,5 s y fase tras buscar) | Correcto (V y E2E) |
| R3 · Movimiento reducido: fase 0 en el local y en la secundaria | E2E F4 (local, vista previa y «Probar»); V `PantallaLetra.test.tsx` (reducido). En la secundaria solo por V (`AppSecundaria.test.tsx`); con el ajuste real: Guía 7 | Parcial |
| R4 · Secundaria: cuenta y espera con el fondo de la candidata quieto | V `R/secundaria/AppSecundaria.test.tsx` («R4: la cuenta y la espera muestran el fondo de la candidata en fase 0») | Correcto (V) |
| R5 · Cajas de línea actual y siguiente iguales con 0–3 indicadores | V `PantallaLetra.test.tsx` («R5: los indicadores no son hijos de ninguna línea»): solo estructura; en jsdom no hay layout. Guía 6.6 | Parcial |
| R6 · Barra: 40 % al empezar, 20 % a los 4 s, 0 al entrar; primera entrada | V `PantallaLetra.test.tsx` («R6, R7, R10 y R11…»: `--k-fraccion` 0, 0,5 y fin), `render.test.ts` («primera entrada con barra y clave estable por hueco») | Correcto (V) |
| R7 · Cuenta 3·2·1 en los últimos 3 s; hueco de 2,5 s | V `PantallaLetra.test.tsx` (3, 2 y 1 en un hueco de 8 s), `render.test.ts` («barra y cuenta en un hueco de 10 s», «hueco de 2 s con umbral 1000 empieza la cuenta en 2»). El caso concreto de 2,5 s se cubre con el de 2 s | Correcto (V) |
| R8 · Sin indicadores tras la última línea, bajo el umbral o sin primera entrada; buscar y pausar | V `render.test.ts` («sin siguiente, sin primera entrada o sin casillas no hay espera»; el estado sale del tiempo, no de lo anterior). «En pausa se congela» no se prueba. Guía 17.3–17.4 y 18.7 | Parcial |
| R9 · Una canción de 0.1.0 se ve exactamente igual | V `render.test.ts` («tabla legada…», «muestra el indicador con un hueco de 4 s…»), `shared/estilo.test.ts` (normalización) | Correcto (V) |
| R10 · Movimiento reducido: números sin fundido ni escala | V `PantallaLetra.test.tsx` («R10: con movimiento reducido el número no lleva animación») | Correcto (V) |
| R11 · Un solo anuncio por hueco | V `PantallaLetra.test.tsx` («R6, R7, R10 y R11…»: un solo anuncio, no se repite por dígito), `Reproductor.modalidad.test.tsx` («anuncia la espera con rep.espera.aria…»). Lector real: Guía 8.16 | Correcto (V) |
| R12 · Letra lista: ningún píxel del color de lo ya cantado; indicadores en el color de la letra; la vista previa sí barre | V `PantallaLetra.test.tsx` («R12: sin barrido no hay capa de resaltado…»); E2E F1 (sin `[data-barrido]` en el reproductor, con él en la vista previa). **No hay captura a mitad de línea ni conteo de píxeles en el reproductor** (sí en la exportación, fase 6). Guía 10.9–10.11 y 11 | Parcial |
| R13 · Letra lista local, en cola y en la secundaria; la modalidad se fija al empezar; con la sesión abierta no se puede cambiar | E2E F2 (secundaria real: sin `[data-barrido]`; el cambio se rechaza con `EDICION_BLOQUEADA` y `cancion.json` conserva `letra_lista`); V `Reproductor.modalidad.test.tsx` («R13: cambiar la modalidad a mitad no cambia la reproducción en curso»), `main/sesion/servicio.test.ts` (la entrada activa lleva la modalidad) | Correcto (V y E2E) |
| R14 · Capturas del reproductor a 1920 × 1080 y 1280 × 720 | 12 PNG (6 estados × 2). Las de 1920 × 1080 salen recortadas en alto | Correcto con limitación (rehacer en un monitor de 1080 px o más; Guía 18.10) |

### Biblioteca (LB)

| Criterio | Verificación | Resultado |
|---|---|---|
| LB1 · Insignia con icono y texto, filtro Listas, nombre accesible | V `tarjeta.test.tsx` («LB1/LB5: insignia, aria y línea de incompleta»), `Biblioteca.test.tsx` («Letra lista (fase 5)»), E2E F1 | Correcto (V y E2E) |
| LB2 · Acción principal, portada, Intro y ⋯ como una Lista; reproduce sin barrido; con sesión se encola | E2E F1 (Reproducir sin barrido) y F2 (suena en la secundaria). No hay prueba de que el ⋯, Intro y «A la cola» sean los de una Lista. Guía 13.1–13.3 | Parcial |
| LB3 · Tras marcar: tarjeta enfocada y resaltada (filtro a Todas), toast con [▶ Reproducir] | E2E F1 (resalte), V `tarjeta.test.tsx` (mensaje del toast). Sin prueba de [▶ Reproducir] del toast ni del cambio de filtro. Guía 10.6 | Parcial |
| LB4 · Persiste al reiniciar; «Volver a borrador» y «Aplicar tema…» no la cambian | V `main/biblioteca/escritura.test.ts` (volver a borrador retira la modalidad), `tarjeta.test.tsx` («un borrador no es Letra lista aunque conserve la modalidad»). Sin prueba de reinicio ni de «Aplicar tema…». Guía 10.14–10.15 y 18.8 | Parcial |
| LB5 · Letra lista incompleta: `bib.lista.incompleta` y sigue en Listas | V `tarjeta.test.tsx` («LB1/LB5…») | Correcto (V) |
| LB6 · Portadas con fondo en movimiento, quietas | 0217: las portadas ya usaban `fondoCss` sin geometría (fase 0); **ninguna prueba lo afirma** («sin test de la portada con degradado animado»). Guía 3.7 y 18.9 | **Sin evidencia automática** |
| LB7 · Captura de la Biblioteca | `biblioteca-1280x800-100-letra-lista.png` | Correcto |

### Resumen de los criterios

- **Sin evidencia automática (3):** G9 (forma, centro y movimiento en un tema), IE7 (sección de espera a 300, 360 y 480 px) y LB6 (portadas quietas). Los tres tienen caso en la guía; G9 y IE7 se refuerzan con el caso 18.
- **Parcial por falta de prueba automática (comprobable a mano; casos en la guía):** G1, G2, G3, G4, G7, G11, IE1–IE6, LL1–LL4, LL6, AS1, AS2, AS5–AS7, R1, R3, R5, R8, R12, LB2–LB4.
- **Pendiente de la guía manual o de la calibración:** G12 y **AS9**.
- **Correcto con Vitest o E2E en verde:** G5, G6, G8, G10, LL5, LL7, LL8, AS3, AS4, AS8, R2, R4, R6, R7, R9–R11, R13, LB1, LB5, y las capturas F5-1, R14 (con limitación) y LB7.

## Desviaciones

Respecto de las specs y del ADR 0018, según las notas de las tareas:

- **Opciones provisionales de las preguntas 0100 y 0110** aplicadas sin respuesta del usuario (ver abajo).
- **G2 sin comparación de captura (0219).** La spec pide una comparación píxel a píxel con 0.1.0; 0219 la pasa a la guía (17.1).
- **Copia del esquema de 0.1.0 (0200).** La etiqueta `v0.1.0` no existe en el clon: se copió `estilo.ts` tal como estaba (sin cambios desde la tarea 0006).
- **`fondoSolido` pasa a `z.strictObject` (0200).** Un fondo sólido con claves desconocidas deja de validar (antes se descartaban).
- **Valores por defecto en `geometriaFondoEn` (0204)**, no con `normalizarEstilo`, para no clonar el estilo en cada fotograma.
- **9 muestras por tramo (0205).** Un degradado de dos paradas pasa de 11 a 9 muestras.
- **`editor.paneles` pasa a opcional en el parcial del renderer (0201)** para poder escribir solo el aviso de Letra lista.
- **`espera.clave` (revisión del ADR 0018)** identifica el hueco y no cambia por dígito (R11).
- **Velocidad (0101).** Lenta, Media y Rápida (60, 30, 15 s) con sentido horario; el antihorario guardado se respeta.
- **`reemplazos` no se retiran al elegir otro tema (0209, 0212)**, como pide IE4.
- **«Detener el movimiento del fondo» (0211)** usa el mismo texto de nombre y tooltip, sin el sufijo «· solo en esta vista previa»; la ayuda del movimiento se muestra siempre.
- **«Ver un ejemplo» (0212):** el umbral se acota a 6 s en el ejemplo, y «Antes de la primera línea» no se simula.
- **Anuncio de espera por callback (0213)**, porque la raíz de la pantalla es `aria-hidden`; el contenedor lo cablea (0216).
- **R13 (0219 y commit `f28bd9a`).** Con el reproductor en otra pantalla, cambiar de modalidad se **rechaza** (`EDICION_BLOQUEADA`); la modalidad se toma al empezar la canción.
- **Menú ⋯ de «Ajustar los silencios» con la pestaña Estilo (0215):** no conoce el estado de los picos; al pulsar lee la caché y, si no está lista, muestra un toast.
- **E2E de AS (0215):** la casilla de cuenta se comprueba leyendo `cancion.json`, no la interfaz.
- **Capturas (0218):** carpeta `revision-0.2.0-fase-5/`; las de 1920 × 1080 salen recortadas.

## Deuda y seguimiento

- **0207/0210:** `PARAMETROS_SILENCIOS` provisionales. La herramienta de calibración no varía percentil, piso, voz mínima ni umbral mínimo, y no comprueba que la caché de picos corresponda a la pista de voz actual.
- **0208:** abortar la lectura devuelve `{ estado: 'error' }` (elección provisional del contrato).
- **0209/0215:** si el historial cambia entre el recálculo y el despacho, el reductor descarta la acción con `propuesta_obsoleta` y el hook no lo recoge (caso teórico).
- **0213:** con `reproduciendo=false` el fondo no seguía las búsquedas; 0211 lo resolvió con un repintado barato (sin prueba automática).
- **0215:** con la línea de tiempo minimizada, el foco tras aplicar desde el ⋯ no vuelve a ningún botón.
- **0216:** la fase final de la pantalla final local se lee de `motor.posicionMs()` durante el render.
- **0217:** sin prueba de la portada con degradado animado.
- **Capturas** de R14 a 1920 × 1080 recortadas.

## Decisiones provisionales pendientes del usuario

Las preguntas **0100** y **0110** siguen con **estado «Abierta» y `Para: usuario`**; no bloquean y sus opciones provisionales están aplicadas.

| Pregunta | Opción provisional aplicada | Dónde se nota |
|---|---|---|
| [0100](../../preguntas/0100-decisiones-provisionales-de-la-fase-5.md) §1 | «Ajustar los silencios» activa la «Cuenta 3·2·1» de toda la canción (aparece también en otros huecos largos) | AS5, ADR 0018 §6.1, propuesta [015](../../propuestas/015-comodin-de-espera-hueco-a-hueco.md) |
| 0100 §2 | «Probar a pantalla completa» sin barrido en una Letra lista; cambio directo entre Lista y Letra lista | LL5, LL8 |
| 0100 §3 | La exportación (fase 6) usa el movimiento del estilo aunque el sistema pida movimiento reducido | ADR 0019 §2; ver informe de la fase 6 |
| [0110](../../preguntas/0110-decisiones-provisionales-de-ux-de-la-fase-5.md) §1 | Tres velocidades (Lenta, Media, Rápida), solo horario | G5 (ya respondida en la práctica por la 0101) |
| 0110 §2 | Avisos del color de lo ya cantado como nota informativa en Letra lista | LL7 |
| 0110 §3 | La modalidad solo se cambia en el editor | LL5, Biblioteca |

[0101](../../preguntas/0101-contratos-de-la-fase-5-para-las-specs.md) está **Respondida**. Las propuestas [003](../../propuestas/003-calibrar-el-ajuste-de-silencios-por-cancion.md) (sensibilidad por canción), [015](../../propuestas/015-comodin-de-espera-hueco-a-hueco.md) y [016](../../propuestas/016-ajustar-el-fin-de-una-linea-con-la-voz.md) no entran en 0.2.0.

## Riesgos abiertos

- **«Ajustar los silencios» sin calibrar (el principal).** Los parámetros son los provisionales del ADR y solo se han probado con voz sintética. Con voz real hay riesgo de cortes falsos (coros, reverberación, susurros) o de no detectar silencios. Hasta que el usuario ejecute la calibración y el arquitecto actualice `PARAMETROS_SILENCIOS` y el ADR, la feature no debe darse por verificada.
- **Las guías manuales no se han ejecutado.** Sin ellas no hay evidencia sobre fluidez en un equipo modesto, legibilidad a 5 m, velocidades, movimiento reducido real, comparación con 0.1.0 y los criterios que la fase marca como «solo manual» (G4, G12, AS9).
- **Criterios de diseño sin prueba automática** (G7, G9, IE7, LL1, AS1, LB6): conviene decidir si se añade Vitest en 0211/0212/0214/0215/0217 o si pasan definitivamente a la guía.
- **CI sobre el HEAD final.** Hay dos pruebas unitarias intermitentes en macOS (`Progreso.test.tsx`, `Editor.test.tsx`) en investigación, un E2E de la fase 3 con tiempo agotado en el último run, y los dos commits locales no se han empujado.
- **Rendimiento del fondo en movimiento** en equipos modestos y con la secundaria: solo lo mide la guía (casos 4 y 9).

## Incoherencias encontradas al escribir el informe

- La tarea 0219 figuraba «En curso» y el backlog «Pendiente»; pasan a «Hecha» (el cierre formal espera a la guía).
- La nota de 0219 dice que el origen `sesión` del barrido es «solo cableado, sin test», pero F2 lo comprueba con la secundaria real; lo que falta es una prueba unitaria propia.
- La guía de la fase decía en el paso 10.7 «sincronizada por línea»; el texto implementado y la spec 02 dicen «por líneas». Corregido en la guía.
- Spec 07 · R7 pide el caso de 2,5 s; las pruebas usan 2 s (equivalente, no idéntico).
- Spec 06 · LL8 y la nota de 0100 §2 están alineadas, pero 0100 y 0110 siguen «Abierta»: las specs las tratan como provisionales.
- La tarea 0215 informó de «9 fallos preexistentes» de `editor-layout.spec.ts` que el CI no reproduce; casi seguro es el mismo 1 px de scroll que luego se corrigió con la clase única `soloLector`, pero no se confirmó.
- `docs/pruebas.md` no listaba las specs de las fases 4 y 6 ni la suite crítica con «sin scroll de página»; se completa con este cierre.
- Spec 06 · IE6 pide que el ejemplo «se anuncie al empezar y al terminar»; ninguna prueba lo comprueba y la tarea 0212 solo lo menciona.

## Preguntas abiertas

Abiertas, ninguna bloquea: **0100** y **0110** (para el usuario, con la opción provisional aplicada). Respondida: 0101.

## Estado del CI al cerrar

**Último run completado: `44861652267` sobre `fd5a9eb` (el último commit empujado). Resultado: fallo** (ver la fila de la tabla): Windows y los 3 trabajos del worker en verde; Ubuntu con 1 E2E inestable de la fase 3 (`temas-editor.spec.ts`, tiempo agotado) y macOS con 1 prueba unitaria inestable (`Editor.test.tsx`). El último run **totalmente en verde** sigue siendo `44858445678` sobre `750727b`. **Ningún run cubre el HEAD local `6339db2`** (dos commits sin empujar). Antes de fusionar a `main` hay que repetir el CI, investigar las pruebas unitarias intermitentes de macOS (`Progreso.test.tsx`, `Editor.test.tsx`) y comprobar si el timeout de `temas-editor.spec.ts` se repite (si se repite, sospechar de un proceso que no cierra tras las specs nuevas).
