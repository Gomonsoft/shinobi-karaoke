# Informe de fase 4 · Ventana secundaria y cola

Las tareas 0177–0190 del [backlog](backlog.md) entregan la sesión en vivo: el reproductor en una ventana secundaria (otra pantalla) con un solo motor de audio, la cola de reproducción con su panel en la Biblioteca, la cuenta entre canciones, el bloqueo de edición durante la sesión, la recuperación ante incidencias y la salida de la app con sesión o cola. Las specs son [Biblioteca · Fase 4](../../ux/02-biblioteca.md#fase-4-de-020--ventana-secundaria-y-cola) (S1–S18), [Reproductor · Fase 4](../../ux/07-reproductor.md#fase-4-de-020--ventana-secundaria-y-cola) (P1–P16), [Editor · Fase 4](../../ux/06-editor.md#fase-4-de-020--ventana-secundaria-y-cola) (E1–E8) y [Ajustes · Fase 4](../../ux/08-ajustes-y-acerca.md#fase-4-de-020--ventana-secundaria-y-cola) (AR1–AR4). Decisión: [ADR 0017](../../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md), con revisiones de [0008](../../adr/0008-seguridad-de-electron-y-protocolos-propios.md) y [0011](../../adr/0011-reproductor-pantalla-completa-y-reutilizacion-del-motor.md).

**Estado: Implementada; CI en verde; pendiente de la guía manual.** La [guía manual](../../Test-manuales/0.2.0/fase-4-ventana-secundaria-y-cola.md) (11 casos) **no se ha ejecutado todavía**. Todo lo que depende de ella (pantallas reales, HDMI, Wayland, Spaces de macOS, escalas, reposo real, sesión de 30 minutos, medidas) consta aquí como «pendiente de la guía manual», no como verificado. El cierre formal de la fase espera a esa ejecución.

La rama de la fase se fusionó en `develop` (`01b8a8c`) y sigue en `alpha-2` (PR borrador [#9](https://github.com/Gomonsoft/shinobi-karaoke/pull/9)), junto con las fases 5 y 6.

## Qué se entregó

| Tarea | Entrega | Estado |
|---|---|---|
| [0177](../../tareas/0177-contratos-compartidos-de-sesion-cola-y-roles.md) | Contratos compartidos: `shared/sesion.ts`, canales y `ROLES_POR_CANAL`, IPC, códigos de error, `config.reproductor.transicion_s` y `secundaria`, `preload/secundaria.ts`, dobles | Hecha |
| [0178](../../tareas/0178-modelo-puro-de-cola-y-maquina-de-sesion.md) | Cola y máquina de sesión puras (`main/sesion/{cola,maquina,proyeccion}.ts`): avance, cuenta, eventos tardíos, cierre, reanudación | Hecha |
| [0179](../../tareas/0179-roles-de-ventana-remitente-por-rol-y-documento-secundario.md) | Roles de ventana, remitente por rol y documento, `reproductor.html`, preloads autocontenidos | Hecha |
| [0180](../../tareas/0180-pantallas-ventana-secundaria-pantalla-completa-y-reposo.md) | Pantallas, ventana secundaria, pantalla completa por ventana, reposo y recuperación, dobles de pantallas | Hecha |
| [0181](../../tareas/0181-servicio-de-sesion-e-ipc-en-main.md) | `ServicioSesion`, revalidación, defensas de edición, silencio y reposo, canales nuevos, cierre de la app | Hecha |
| [0182](../../tareas/0182-reproductor-en-la-ventana-secundaria.md) | Reproductor en la secundaria: modo `sesion`, S1–S4, cuenta, reanudación, atajos, cierre | Hecha (integrada con 0181) |
| [0183](../../tareas/0183-estado-de-sesion-en-la-principal-bloqueo-de-edicion-e-indicador.md) | Estado de sesión en la principal, bloqueo `edi.bloqueo`, indicador de sesión | Hecha |
| [0184](../../tareas/0184-dialogo-abrir-el-reproductor-en-otra-pantalla.md) | Diálogo «Abrir el reproductor en otra pantalla», Wayland, errores | Hecha |
| [0185](../../tareas/0185-panel-de-cola-sesion-controles-recuperacion-y-cierre.md) | Panel de cola: sesión, controles, recuperación y cierre | Hecha |
| [0186](../../tareas/0186-panel-de-cola-lista-de-pendientes.md) | Lista de pendientes: reordenar (ratón, teclado, menú), quitar y deshacer, vaciar | Hecha |
| [0187](../../tareas/0187-tarjetas-y-menus-de-la-biblioteca-durante-la-sesion.md) | Tarjetas y menús durante la sesión: «A la cola», bloqueos, toasts | Hecha |
| [0188](../../tareas/0188-ajustes-cuenta-entre-canciones.md) | Ajustes › Reproductor: «Cuenta entre canciones» | Hecha |
| [0189](../../tareas/0189-salir-de-la-app-con-sesion-o-cola.md) | Salir de la app con sesión o cola (`ses.salir`, variante con trabajos y variante de macOS) | Hecha |
| [0190](../../tareas/0190-verificacion-e2e-capturas-e-informe-de-la-fase-4.md) | `sesion-flujo.spec.ts` (4 pruebas), 40 capturas, este informe | Hecha; el cierre formal espera a la guía manual |

Las preguntas de la fase están respondidas: [0058](../../preguntas/0058-interfaz-de-la-sesion-en-vivo-y-la-cola.md), [0059](../../preguntas/0059-conductas-de-la-sesion-en-vivo-ante-incidencias.md), [0060](../../preguntas/0060-letra-y-controles-de-sonido-durante-la-sesion.md), [0061](../../preguntas/0061-reproductor-en-otra-pantalla-con-wayland.md), [0068](../../preguntas/0068-ids-y-conteo-en-el-estado-reducido-de-la-secundaria.md) (el estado reducido de la secundaria gana `entradaId` de la candidata y `activa`; revisión 2 del ADR §10–§11) y [0080](../../preguntas/0080-duracion-y-lineas-sin-sincronizar-en-las-filas-de-la-cola.md) (duración y líneas sin sincronizar salen del resumen de la biblioteca, no de la cola). De la fase surgieron las propuestas [001](../../propuestas/001-volumen-y-voz-guia-desde-el-panel-de-cola.md) (volumen y voz guía en el panel; aplazada), [002](../../propuestas/002-selector-de-dispositivo-de-audio.md) (selector de dispositivo de audio), [004](../../propuestas/004-voz-guia-durante-la-cuenta-y-la-espera.md) (voz guía durante la cuenta y la espera) y [005](../../propuestas/005-cola-persistente-entre-sesiones.md) (cola persistente entre sesiones); ninguna entra en 0.2.0.

## Verificación

### Estrategia

Con la [estrategia de pruebas](../../pruebas.md) (decisión del 2026-11-20), esta fase no lleva una batería E2E extensa. La lógica va a Vitest; los E2E cubren solo lo que exige Electron real con dos procesos de renderer; la regresión completa la ejecuta el CI y lo que necesita hardware real va a la guía manual.

- `e2e/sesion-main.spec.ts` (de 0181; 2 casos): abrir la secundaria, cargarla y que un `fin` repetido cuente una sola vez; salir con sesión pide `ses.salir`, cierra las dos ventanas y la cola no sobrevive.
- `e2e/sesion-flujo.spec.ts` (de 0190; 4 casos, unos 20 s, estable en 3 pasadas): roles y ventanas; fin y cuenta; cierre conservando la cola y reanudación; caída de la secundaria. Condiciones: audio generado, letras inventadas, `SHINOBI_PANTALLAS_SIMULADAS` con 2 pantallas, `SHINOBI_PANTALLA_COMPLETA_SIMULADA`, `transicion_s` = 2, sin red. Secundaria, no crítica.
- Vitest: sesión en main (`main/sesion/*.test.ts`), secundaria (`renderer/src/secundaria/AppSecundaria.test.tsx`), estado de sesión y bloqueo (`renderer/src/sesion/sesion.test.tsx`), panel y lista (`vistas/biblioteca/cola/*.test.tsx`), diálogo de pantallas, tarjetas, Ajustes y cierre de la app.
- Capturas: `e2e/sesion-capturas.spec.ts` (opt-in, `SHINOBI_CAPTURAS_4=1`), fuera de la regresión.

### CI

| Ejecución | Commit | Resultado |
|---|---|---|
| [44855351917](https://github.com/Gomonsoft/shinobi-karaoke/actions/runs/44855351917) (`alpha-2`, PR #9) | `b6ed411` | **Correcto en los 6 trabajos**: `app` y `worker` en Windows, macOS y Ubuntu. En Ubuntu: Vitest 3027 correctas y 12 omitidas (225 archivos), y E2E con xvfb **187 correctos, 20 omitidos, 0 fallos**. |
| [44853656719](https://github.com/Gomonsoft/shinobi-karaoke/actions/runs/44853656719) (Empaquetado, manual) | | Correcto: 3 construcciones y las 6 pruebas de instalación (AppImage, `.deb` en 24.04 y 26.04, DMG en macOS 15 y 26, NSIS en Windows). Confirma la corrección del preload en Windows (defecto 4). |

Aviso: el run verde corresponde a `b6ed411`; la rama ya avanzó (HEAD `acc0e0b`, con trabajo de las fases 5 y 6) y su ejecución [44856768872](https://github.com/Gomonsoft/shinobi-karaoke/actions/runs/44856768872) seguía en curso al escribir este informe. Antes de fusionar la fase a `main`, hay que reconfirmar el verde sobre el HEAD final. Los E2E solo corren en Ubuntu: Windows y macOS ejecutan Vitest, no Playwright, así que la ventana secundaria real no se ejercita allí (solo en el ensayo de empaquetado y en la guía manual).

### Defectos encontrados por el CI y su corrección

La primera ejecución completa de los E2E en Ubuntu ([44849424744](https://github.com/Gomonsoft/shinobi-karaoke/actions/runs/44849424744), commit `f934249`) dio 167 correctos, 20 omitidos y **19 fallos**. Se clasificaron así:

| Fallos | Clasificación | Causa | Corrección |
|---|---|---|---|
| 14 de `editor-layout.spec.ts` | **Regresión real** (0185, `vistas/biblioteca/cola/panelCola.module.css`, diálogo de cierre de sesión) | Un aviso oculto del diálogo de cierre de sesión (`DialogoCierreSesion`, región viva) añadía 1 px de scroll de página en el editor. | Corregido en `panelCola.module.css` (`605a1dc`). La guía manual añade el caso 11.1 para comprobarlo con la ventana maximizada. |
| 5 de la ventana secundaria | **De la prueba** (consecuencia prevista de 0189) | `app.close()` de Playwright se cuelga con una sesión abierta, porque salir pide confirmación (`ses.salir`). | Las specs con sesión abierta salen con `salirSinConfirmar` (`e2e/salir.ts`; `b49e912`, `1895011`: incluye el arranque en Linux sin gestor de ventanas). |
| 1 de `ipc.spec.ts` (run 44853661863) | **Regresión menor de contrato en la prueba** | La lista de claves de `window.shinobi` no incluía `exportacion` (fase 6). Falló el run anterior al verde con 1 fallo y 185 correctos. | `b6ed411` «E2E ipc: window.shinobi expone exportacion». |

Otros dos defectos de la fase, surgidos en el mismo ciclo:

- **Prueba unitaria inestable que destapó un defecto real.** `PanelCola.test.tsx` fallaba de forma intermitente. La causa estaba en el código: el reintento de foco con `requestAnimationFrame` de `cola/tiempo.ts` no se cancelaba y quedaba más de uno pendiente. Corrección: un solo reintento pendiente (`4d29efd`), sin reintentos de prueba.
- **Preload roto en Windows en la app empaquetada.** El plugin `preloadsAutocontenidos` de `electron.vite.config.ts` (0179) comparaba rutas con separadores de Windows y dejaba el preload con `require` de archivos locales, imposible con `sandbox`; la ventana quedaba sin `window.shinobi`. Solo aparece en la app empaquetada, no en desarrollo ni en los E2E. Corregido normalizando separadores (`3354afe`); confirmado por el ensayo de empaquetado 44853656719 (las 6 pruebas de instalación en verde). La guía lo vigila con el caso 11.4 (solo Windows, app instalada).

En el run 44853661863 también falló `worker (windows-latest)` en `test_exportar.py` (`PermissionError` al borrar un temporal): es de la fase 6, no de esta, y se corrigió en `fd8181c`.

### Medidas

Las medidas que recoge la guía manual **no existen todavía**; quedan pendientes de su ejecución (tabla de «Ejecuciones» de la guía):

| Medida | Dónde se toma | Valor |
|---|---|---|
| Latencia percibida principal → secundaria | Caso 1.6 | Pendiente de la guía manual |
| Desviación de la cuenta (objetivo 4 s ± 0,5 s) | Caso 4.5 | Pendiente de la guía manual |
| Memoria con las dos ventanas | Caso 9.5 | Pendiente de la guía manual |
| Cortes de audio o letra en 30 min con separación en segundo plano | Caso 9.3 | Pendiente de la guía manual |

Medidas disponibles: `sesion-flujo.spec.ts` completa en unos 20 s (límite de la tarea: 90 s). La cuenta de 2 s se comprueba de extremo a extremo con tolerancia; la desviación real a 4 s y a 10 s no se mide automáticamente.

### Capturas

40 PNG en [`docs/ux/revision-fase-4/`](../../ux/revision-fase-4/README.md), tomadas el 2026-11-20 en un Mac con una sola pantalla Retina (pantalla 2 simulada): Biblioteca 12 estados × 2 (1280 × 800 al 100 % y 1280 × 720 al 125 %), reproductor 7 estados × 2 (1920 × 1080 y 1280 × 720), `ajustes-1280x800-100-reproductor` y `editor-1280x800-100-dialogo-bloqueo`. **Limitación:** las de 1920 × 1080 del reproductor salen recortadas a 1920 × 762, porque macOS limita `setContentSize` a la altura de la pantalla real; para P16 completo hace falta un monitor de al menos 1080 px de alto. La revisión del diseñador sigue por hacer. Comando: `SHINOBI_CAPTURAS_4=1 npx playwright test e2e/sesion-capturas.spec.ts --workers=1` desde `app/`.

## Resultado por criterio

Leyenda: «E2E» = casos de `app/e2e/sesion-flujo.spec.ts` (por su nombre abreviado) o `sesion-main.spec.ts`; «V» = Vitest (archivo bajo `app/src/`); «Guía n» = caso de la guía manual, **no ejecutada**. Un criterio cuya parte dependiente de la guía no está verificada se marca «Parcial».

Abreviaturas de los E2E de `sesion-flujo.spec.ts`: **F1** «roles y ventanas…», **F2** «fin y cuenta…», **F3** «cierre conservando la cola y reanudación…; Esc no cierra», **F4** «caída de la secundaria…». **M1** y **M2** son los dos casos de `sesion-main.spec.ts`.

### Biblioteca (S)

| Criterio | Verificación | Resultado |
|---|---|---|
| S1 · Diálogo de pantallas, preselección, una pantalla, recuerdo | V `vistas/biblioteca/sesion/DialogoPantallas.test.tsx` (preselección, pantalla guardada, una pantalla, pantalla que desaparece) y `preseleccion.test.ts`. Resoluciones reales y recuerdo tras reiniciar: Guía 1.1, 1.2, 1.12, 1.13 | Parcial (V correcto; reales pendientes de la guía manual) |
| S2 · Fallo al abrir, [Reintentar] | V `DialogoPantallas.test.tsx` («ses.error.abrir con [Reintentar]…», `PANTALLA_NO_DISPONIBLE`, `GUARDADO_PENDIENTE`, `CANCION_NO_DISPONIBLE`) | Correcto (V) |
| S3 · Panel con la activa, progreso y controles; la secundaria responde y la principal no suena | V `cola/PanelCola.test.tsx` (activa, progreso, Pausa/Siguiente/Reiniciar); E2E F1 (principal silenciada) y M1 (carga); Guía 1.4–1.7 para la respuesta real y la latencia | Parcial (V y E2E correctos; sensación y latencia pendientes de la guía manual) |
| S4 · «A continuación» y «Al final», repetida, [Deshacer] | V `Biblioteca.cola.test.tsx` («Reproducir a continuación…», «la misma canción dos veces…»), `main/sesion/cola.test.ts` y `maquina.test.ts` (la activa no se interrumpe) | Correcto (V) |
| S5 · Reordenar por arrastre, teclado y ⋯; foco; anuncio; Esc | V `cola/ListaPendientes.test.tsx` (Alt+↑/↓/Inicio/Fin, ⋯, arrastre, Esc, foco y anuncio) y `ordenCola.test.ts`. El arrastre usa `getBoundingClientRect` simulado: sin E2E con layout real. Guía 9.4 (reordenar con sonido) lo toca solo de refilón | Parcial (arrastre con layout real sin ejercitar) |
| S6 · Quitar con Supr o ⋯, foco y [Deshacer] | V `ListaPendientes.test.tsx` (foco siguiente/anterior/encabezado, [Deshacer] con `antesDe`) | Correcto (V) |
| S7 · Cuenta en el panel sincronizada (± 1 s), «Detener cuenta», «Empezar ya» | V `PanelCola.test.tsx` («muestra la cuenta…», «el reloj local baja la cuenta»), `servicio.test.ts` («Empezar ya» consume al momento). Sincronía real con la secundaria: Guía 4.3 | Parcial (lógica en V; sincronía medida pendiente de la guía manual) |
| S8 · En espera, [Iniciar]; en fin de cola, añadir arranca la cuenta | V `Biblioteca.cola.test.tsx` (toast con [Iniciar ahora], `cola.toast.cuenta` con [Detener cuenta]) y `PanelCola.test.tsx`; E2E F2 (en fin de cola, añadir arranca la cuenta) | Correcto |
| S9 · Entrada fallida: causa, [Pasar a la siguiente], [Descartar], `cola.noDisponible` | V `PanelCola.test.tsx` («causa y [Pasar…]», [Descartar]), `ListaPendientes.test.tsx` (no disponible), `servicio.test.ts` (volver a borrador, disponibilidad desactualizada, ilegible/sin pistas) y `maquina.test.ts` | Correcto (V) |
| S10 · Tarjetas Lista durante la sesión | V `Biblioteca.cola.test.tsx` («A la cola», E1, Eliminar y Volver a borrador de la activa `aria-disabled`, Editar datos y Aplicar tema disponibles) | Correcto (V) |
| S11 · Eliminar una pendiente con `bib.cola.dialogo.eliminar` | V `Biblioteca.cola.test.tsx`, `servicio.test.ts` («una canción eliminada mientras espera desaparece de la cola») | Correcto (V) |
| S12 · Cierre con pendientes, `ses.cierre`, obsoleto, conservar o eliminar | V `PanelCola.test.tsx` (diálogo con foco en Cancelar, `CONFIRMACION_OBSOLETA`, `ses.cierre.esperando`), `AppSecundaria.test.tsx`, `servicio.test.ts` (cierre desde la secundaria, revisión vieja); E2E F3 (Ctrl+W → «Cerrar y conservar cola»). El foco final en «Abrir en otra pantalla…» tras conservar no tiene una afirmación explícita que lo ligue a este criterio (solo el reintento de foco consumido en `PanelCola.test.tsx`); Guía 11.2–11.3 comprueban que el foco no salta | Parcial (foco tras conservar sin evidencia directa) |
| S13 · Salir con sesión o cola; la cola no sobrevive | V `navegacion/DialogoCierre.test.tsx` (con sesión, con cola, con trabajos, macOS); E2E M2; Guía 10 (macOS real) | Parcial (V y E2E correctos; macOS real pendiente de la guía manual) |
| S14 · Indicador de sesión | V `sesion/sesion.test.tsx` («IndicadorSesion (S14)»: estados, nombre accesible, desde Ajustes y desde Progreso, foco en el panel) | Correcto (V) |
| S15 · Recuperación: monitor desconectado, vuelve, caída, no responde | V `PanelCola.test.tsx` (banners), `main/sesion/ventanaSecundaria.test.ts` (pérdida, reconexión, caída, no responde), `servicio.test.ts`; E2E F4 (caída: incidencia, cola conservada, edición liberada). Desconexión de cable real: Guía 5 | Parcial (la desconexión real queda pendiente de la guía manual) |
| S15b · «Reproducir en otra pantalla…», variante con canción y Wayland | V `DialogoPantallas.test.tsx` (S15b, Wayland sin lista), `PanelCola.test.tsx` (Wayland). Wayland real: Guía 3 | Parcial (Wayland real pendiente de la guía manual) |
| S16 · Panel operable con teclado; sin atajos de una tecla; el foco nunca en `body` | V `ListaPendientes.test.tsx` («navegación (S16)», roving tabindex), `PanelCola.test.tsx` (foco al ocultar y al abrir). No hay prueba que afirme «ninguna acción de sesión con atajo de una tecla en la principal» ni «el foco nunca queda en `body`» | Parcial (sin evidencia de las dos afirmaciones globales) |
| S17 · A 1024 × 576 con el panel, 2 columnas, scroll propio, sin scroll horizontal | **Sin evidencia.** 0185 lo dejó «pendiente de E2E/captura (0190)» y 0190 no añadió ese caso (límite de 4 pruebas). El CSS lo prevé (`panelCola.module.css`: panel de 320 px bajo 1280 px), y las capturas `biblioteca-1280x720-125-*` lo muestran, pero ninguna prueba mide el scroll horizontal (ver además la [pregunta 0057](../../preguntas/0057-ancho-minimo-del-cuerpo-y-scroll-horizontal-a-1024-px.md) sobre `min-width: 1024px`) | **Sin evidencia** |
| S18 · Capturas de Biblioteca | 24 PNG en `docs/ux/revision-fase-4/` (12 estados × 2 tamaños) | Correcto (revisión del diseñador pendiente) |

### Reproductor (P)

| Criterio | Verificación | Resultado |
|---|---|---|
| P1 · Abrir en la segunda pantalla a pantalla completa, sin foco; F y ⛶ sin cortar audio | E2E F1 (la secundaria sin `window.shinobi`, sin foco; la principal operable), V `ventanaSecundaria.test.ts` (colocación dentro del `workArea`, sin foco en otra pantalla) y `PanelCola.test.tsx` (alternar pantalla completa). No se comprueba en E2E que la ventana esté dentro de la pantalla 2 simulada (ver Desviaciones). Pantalla completa real, Spaces, F sin cortes: Guía 1.3, 1.8, 2 | Parcial (pendiente de la guía manual) |
| P2 · Un solo motor | E2E F1 (la principal queda silenciada, su reproductor local no se abre), V `servicio.test.ts` («abre la sesión…, silencio…», restauración del silencio previo). La comprobación que pide la spec («solo la secundaria crea `AudioContext` con fuentes activas») **no se hace tal cual**. Doble audio auditivo y salida del sistema: Guía 1.5 | Parcial (pendiente de la guía manual) |
| P3 · Cuenta entre canciones: fondo, número, anillo, tarjeta; duración configurada | V `AppSecundaria.test.tsx` («S1 pinta la cuenta…», P3), `vistas/reproductor/sesion/cuenta.test.ts`; E2E F2 (la pendiente empieza tras la cuenta de 2 s). 3 s y 10 s cronometrados, aspecto a distancia: Guía 4.1–4.6 | Parcial (pendiente de la guía manual) |
| P4 · Movimiento reducido | V `AppSecundaria.test.tsx` (P4). Con el ajuste real del sistema: Guía 4.7 | Parcial (pendiente de la guía manual) |
| P5 · Reordenar durante la cuenta | V `AppSecundaria.test.tsx` (P5: un solo anuncio, las demás no reinician) y `maquina.test.ts` («mover las posteriores conserva la fecha límite…», «eliminar la candidata…») | Correcto (V) |
| P6 · Eventos duplicados o tardíos | E2E M1 (`fin` repetido, una sola cuenta) y F2 (avance de extremo a extremo); V `servicio.test.ts` («un fin y otro fin repetido…», «un fin y dos siguiente intercalados…»), `maquina.test.ts` («dos fin de la misma entrada…», «vencida con transicionId obsoleto»), `AppSecundaria.test.tsx` («informa `fin` una sola vez») | Correcto |
| P7 · Fin de la cola: sin cierre, añadir arranca la cuenta, «Detener cuenta», «Empezar ya» | E2E F2 (fin de cola sin cerrar la ventana, añadir arranca la cuenta); V `AppSecundaria.test.tsx` (P7, S2), `Biblioteca.cola.test.tsx`, `servicio.test.ts` | Correcto |
| P8 · Candidata borrada o sin pistas | V `AppSecundaria.test.tsx` (S4), `servicio.test.ts` («una canción que vuelve a borrador…», «con la disponibilidad desactualizada…»), `maquina.test.ts`, `PanelCola.test.tsx` | Correcto (V); ver deuda de 0181 sobre el botón «Pasar» sin siguiente real |
| P9 · Cierre de la secundaria con pendientes; cuenta congelada | V `AppSecundaria.test.tsx` (P9: el número no cambia en 5 s y sigue desde el mismo), `maquina.test.ts` («congela la cuenta…»), `servicio.test.ts` | Correcto (V) |
| P10 · Reanudar en el segundo, mismo estado, indicador; «Reiniciar canción»; misma canción dos veces | E2E F3 (la cola se conserva y `reanudar` vuelve en su segundo, ± 1 s); V `AppSecundaria.test.tsx` (P10), `maquina.test.ts` («conservar a mitad de canción…», «con la misma canción dos veces, solo esa entrada queda reanudable», «reanudar carga en el segundo…») | Correcto |
| P11 · Cerrar y conservar durante la cuenta: reabrir en S2 | V `AppSecundaria.test.tsx` (P11), `maquina.test.ts` («conservar durante la carga…», contexto reanudable) | Correcto (V) |
| P12 · Esc no cierra; Ctrl/Cmd + W cierra | E2E F3 (Esc no cierra; Ctrl + W → «Cerrar y conservar cola»); V `AppSecundaria.test.tsx` (P12: Ctrl+W y Cmd+W) | Correcto |
| P13 · Desconexión de pantalla; caída del renderer | E2E F4 (caída con `forcefullyCrashRenderer`: incidencia, cola conservada, edición y silencio liberados); V `ventanaSecundaria.test.ts` (recoloca en la primaria, recoloca si cambian las métricas) y `servicio.test.ts`. Sin cortar el audio con cable real: Guía 5 | Parcial (desconexión real pendiente de la guía manual) |
| P14 · La pantalla no se apaga en ningún estado | V `main/ventana/reposo.test.ts` (titulares), `servicio.test.ts` (retiene al abrir y libera al cerrar, caer y salir); E2E F1 y F4 (reposo retenido con la sesión y liberado tras la caída). El apagado real del sistema en S2/S3: Guía 8 | Parcial (pendiente de la guía manual) |
| P15 · La secundaria sin `rep.incompleta` ni toasts; los toasts van a la principal | V `AppSecundaria.test.tsx` (P15). Los toasts en la principal con la secundaria abierta: Guía 1.10 | Parcial (pendiente de la guía manual) |
| P16 · Capturas del reproductor | 14 PNG (7 estados × 2 tamaños). Las de 1920 × 1080 salen recortadas a 1920 × 762 | Correcto con limitación (rehacer en un monitor de 1080 px o más) |

### Editor (E)

| Criterio | Verificación | Resultado |
|---|---|---|
| E1 · Bloqueo con título exacto, sin navegar, foco al origen | V `sesion/sesion.test.tsx` («E1: con sesión muestra el diálogo…», Esc), `Biblioteca.cola.test.tsx` («E1: Editar…», «E1: Continuar…») | Correcto (V) |
| E2 · Bloqueo en pausa, cuenta, espera, fin de cola, fallo y con el diálogo de cierre | V `sesion/sesion.test.tsx` (`it.each` «E2: el bloqueo se mantiene en %s») y `servicio.test.ts` («el bloqueo de edición dura también con el diálogo de cierre abierto…») | Correcto (V) |
| E3 · Al cerrar la sesión, la misma acción abre el editor | V `sesion/sesion.test.tsx` («E3: al terminar la sesión…», «una cola conservada sin sesión no bloquea nada»); E2E F4 (edición disponible tras la caída) | Correcto |
| E4 · «Cerrar el reproductor…» del diálogo | V `sesion/sesion.test.tsx` («E4…») y `PanelCola.test.tsx` («“Cerrar el reproductor…” del bloqueo de edición también llega al diálogo») | Correcto (V) |
| E5 · Editor con cambios y borrador de tema: guardar antes de abrir el reproductor; fallo de guardado | `DialogoCierre.test.tsx` cubre el borrador de tema al cerrar la app, y `Editor.temas.test.tsx` el diálogo de salida del editor, pero **no se encontró una prueba que recorra el criterio** (pulsar el indicador de sesión o ‹ Biblioteca con cambios sin guardar, vaciar el guardado y solo entonces abrir el reproductor, y el caso `edi.dialogo.salir`) | **Sin evidencia** |
| E6 · Escucha Voz/Instrumental bloqueada | V `vistas/progreso/Progreso.test.tsx` («E6: la escucha… está aria-disabled, sin sonido y con el motivo») | Correcto (V) |
| E7 · Elementos bloqueados enfocables con candado y nombre accesible | V `sesion/sesion.test.tsx` («E7…») y `Biblioteca.cola.test.tsx` | Correcto (V) |
| E8 · Captura | `editor-1280x800-100-dialogo-bloqueo.png` | Correcto |

### Ajustes (AR)

| Criterio | Verificación | Resultado |
|---|---|---|
| AR1 · Sección «Reproductor», 4 s por defecto, ayuda asociada | V `vistas/ajustes/ReproductorAjustes.test.tsx` (AR1, `aria-describedby`) | Correcto (V) |
| AR2 · Elegir 10 s persiste; la siguiente cuenta dura 10 s; la en curso no cambia | V `ReproductorAjustes.test.tsx` (guarda `reproductor.transicion_s`), `maquina.test.ts`/`servicio.test.ts` (el entorno lleva `transicionS`). El E2E de la tarea 0188 prometía verificar «la siguiente cuenta dura 10 s» en 0190, pero 0190 solo usa `transicion_s` = 2 sembrado. Persistir al reiniciar y la cuenta de 10 s cronometrada: Guía 4.6 | Parcial (pendiente de la guía manual) |
| AR3 · Fallo de guardado | V `ReproductorAjustes.test.tsx` («AR3: si falla el guardado vuelve al valor anterior y avisa con “Copiar detalles”») | Correcto (V) |
| AR4 · Captura | `ajustes-1280x800-100-reproductor.png` | Correcto |

### Resumen de los criterios

- **Sin evidencia (2):** S17 (rejilla de 2 columnas sin scroll horizontal a 1024 × 576 con el panel abierto) y E5 (guardar el editor y el borrador de tema antes de abrir el reproductor desde el indicador). Ninguno tiene prueba ni caso de guía.
- **Parcial por falta de evidencia automática (2):** S5 (el arrastre solo se prueba con geometría simulada) y S16 (las afirmaciones globales de teclado y foco no están cubiertas por una prueba).
- **Parcial por depender de la guía manual (hardware o persona real):** S1, S3, S7, S13, S15, S15b, P1–P4, P13–P15 y AR2.
- Los demás (S2, S4, S6, S8–S11, S14, S18, P5–P12, P16, E1–E4, E6–E8, AR1, AR3, AR4) tienen su evidencia en Vitest o E2E, todos en verde en el CI.

## Desviaciones

Respecto de las specs y del ADR 0017, según las notas de las tareas:

- **Pantalla perdida (0180, 0181).** La secundaria pasa a la pantalla primaria, como piden la tarea y la spec 07. El ADR 0017 §3 decía «la de la principal». Se mantuvo la tarea; el ADR conviene alinearlo.
- **Contrato de la secundaria (pregunta 0068, ADR 0017 §10–§11, revisión 2).** El estado reducido añade `entradaId` de la candidata y `activa`, sin los cuales «Empezar ya», «Iniciar» y «Pasar» no actuaban desde un fallo de candidata.
- **`cierrePendiente`** es `null | { origen: 'principal' | 'secundaria' }` y no un booleano como lo dibuja el ADR (0177), para saber en qué ventana se pidió.
- **Campos del contrato fijados por el programador** donde el ADR no concreta (0177): incidencias, `pausar.causa`, el comando `transicion`, el informe `error` con `{ motivo, pista }` y `EstadoSecundariaIpc.transicion`.
- **Evento nuevo en la máquina (0181):** `{ tipo: 'pantallaCompleta', activa }`, porque `pantalla.movida` limpiaría las incidencias.
- **Detección de recarga (0180 corregida en 0181):** con `did-navigate` posterior a `did-finish-load`, no con `did-start-navigation`, que también saltaba con navegaciones que `bloquearNavegacionTotal` cancela (lo detectó `e2e/seguridad.spec.ts`).
- **Pantalla completa en `moverA` (0180):** sale, mueve al 80 % de la nueva pantalla y vuelve a entrar; con `colocacion: 'sistema'` (Wayland) se abre en ventana de 960 × 540 y no se pide pantalla completa.
- **Preloads sin chunks compartidos (0179):** plugin `preloadsAutocontenidos` que da a cada entrada su propia copia de los módulos propios, porque `output.codeSplitting: false` no admite varias entradas. Origen del defecto de Windows (arriba).
- **Panel, diálogos y foco (0184, 0185).** «Mover a…» y «Cambiar de pantalla…» reutilizan el diálogo de pantallas en modo `mover`, sin el texto de botón que la spec no define; en Wayland `sesion.abrir` recibe la primera pantalla y main la ignora. `DialogoCierreSesion` se monta en `ProveedorSesion`, no en la Biblioteca, para que aparezca también desde `edi.bloqueo` en Letra o el Editor. Textos nuevos provisionales: «Cerrar aviso» y `ses.salir.extraMac`.
- **Franja de la cuenta y la espera (0182):** solo lleva volumen, atajos y pantalla completa, sin la voz guía (propuesta 004).
- **Duración y líneas sin sincronizar (0186, respuesta 0080):** vienen del resumen de la biblioteca por props, no de `EntradaIpc`.
- **«Agregar otra vez al final» del ⋯ (0186):** muestra `cola.toast.final` con [Deshacer], que la spec no pedía para una pendiente.
- **Pruebas (0190).** No se comprueba que la secundaria esté dentro de la pantalla 2 simulada: con una sola pantalla real, macOS la recoloca (x = 0), y la colocación la cubre `ventanaSecundaria.test.ts`. P2 no se comprueba con `AudioContext` (solo silencio de la principal y reproductor local sin abrir). Los duplicados de `fin` los cubre `sesion-main.spec.ts`, no `sesion-flujo.spec.ts`. No hay E2E de S17 ni del arrastre con layout real. Las specs con sesión salen con `app.exit(0)`/`salirSinConfirmar` porque salir pide confirmación (comportamiento previsto).
- **Pruebas de feedback de la propia tarea 0190.** La tarea se reescribió el 2026-11-20 con la nueva estrategia de pruebas: 4 E2E en lugar de 13 escenarios y verificación manual fuera de la tarea.

## Deuda y seguimiento

- **0177/0181:** `sesion.preferencias` devuelve `config.reproductor` completo, con `secundaria`; no se estrechó.
- **0181:** en S4, `pendientes` cuenta también la fallida si era la candidata; «Pasar a la siguiente canción» puede aparecer sin una siguiente real y main lo ignora (hace falta un campo aparte). `app:solicitudCierre` lleva el motivo, que el diálogo de cierre de 0189 ya aprovecha.
- **0179:** el clic en el Dock y `activate` no tienen E2E (Playwright no puede simularlos); revisados por código.
- **0185:** el foco tras un cierre pedido desde la secundaria no se gestiona (no hay origen local).
- **0186:** los errores de las operaciones de cola se descartan en silencio (la fuente de verdad son los eventos de estado).
- **0189:** `npm run test:e2e:criticos` falló en local en el equipo de desarrollo (`flujo-principal` no mostraba «Revisa los datos de la canción»); el CI lo da en verde, por lo que se trata como de entorno.
- **0181:** `e2e/ventana.spec.ts` (DPR 1) falla en el Mac de desarrollo por su DPR; no se comprobó si ya fallaba antes. El CI en Ubuntu está en verde.
- **Capturas** de P16 a 1920 × 1080 recortadas (ver Capturas).

## Riesgos abiertos

- **La guía manual no se ha ejecutado.** Sin ella no hay evidencia sobre pantalla completa real, Spaces de macOS, escalas distintas, desconexión de cable, reposo real, HDMI ni las medidas de latencia, desviación de la cuenta, memoria y cortes en 30 min. Es requisito del cierre formal (criterio de 0190: al menos un equipo con dos pantallas reales por sistema).
- **Wayland.** La colocación depende del sistema (`ses.wayland`); el diálogo y el panel están probados en Vitest, pero el comportamiento real de arrastrar y pulsar F no se ha visto (Guía 3).
- **Audio por HDMI.** Qué pasa con el sonido al desconectar el cable de una pantalla con altavoces no está verificado (Guía 6). La salida es siempre la predeterminada del sistema (propuesta 002 para elegir dispositivo).
- **CPU durante una separación.** El riesgo del ADR 0017 (cortes de audio o letra en la secundaria mientras el worker separa en segundo plano) solo lo mide la guía (caso 9).
- **Ventana secundaria en Windows y macOS.** Los E2E solo corren en Ubuntu con pantallas simuladas; allí la ventana real solo se ve en el ensayo de empaquetado (arranque) y en la guía. Un defecto de plataforma (como el del preload en Windows) solo aparecería en el empaquetado o a mano.
- **S17 y E5 sin evidencia**, y arrastre y teclado con geometría simulada (S5, S16): conviene decidir si se añaden pruebas de Vitest en las tareas 0185/0186/0170 o si pasan a la guía.
- **CI sobre el HEAD final.** El run verde es de `b6ed411`; hay que reconfirmar con el HEAD de `alpha-2` (el run 44856768872 estaba en curso).

## Incoherencias encontradas al escribir el informe

- La tarea 0188 prometía que «la siguiente cuenta dura 10 s» (AR2 en main) se verificaría en 0190, pero 0190 no lo incluye; queda para la guía (4.6).
- La tarea 0185 dejaba S17 «pendiente de E2E/captura (0190)» y 0190 no lo recogió.
- [docs/pruebas.md](../../pruebas.md) decía que las specs `sesion-*` «serán secundarias»; ya existen (`sesion-main`, `sesion-flujo` y `sesion-capturas` opt-in) y su inventario debe listarlas (lo mantiene el QA).
- El ADR 0017 §3 («la de la principal») y la tarea/spec 07 («pantalla primaria») discrepan sobre dónde va la secundaria al perder su pantalla; se siguió la tarea.
- La nota de 0190 dice que se «quita el silencio de E2E de la principal» en `sesion-flujo.spec.ts`; es solo del caso F1, y no cubre la comprobación con `AudioContext` que pide P2.

## Preguntas abiertas

Ninguna de la fase queda abierta: 0058–0061, 0068 y 0080 están respondidas. Las propuestas 001, 002, 004 y 005 no bloquean.
