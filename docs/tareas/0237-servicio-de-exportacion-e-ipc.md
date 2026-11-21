# 0237 — Servicio de exportación, cola, perfiles e IPC

- Estado: Hecha
- Paso del pipeline: 6
- Depende de: [0231](0231-worker-comando-exportar.md), [0232](0232-capacidades-de-exportacion-y-licencias-de-codecs.md), [0233](0233-cliente-del-worker-con-tuberia-y-bucle-de-fotogramas.md), [0234](0234-ventana-offscreen-de-exportacion-y-rol.md), [0236](0236-destinos-temporal-y-diario-de-exportacion.md); de la fase 5, [0202](0202-resolucion-de-apariencia-con-reemplazos-de-espera.md) y [0203](0203-main-marcar-letra-lista-guardar-reemplazos-y-modalidad-en-la-sesion.md) (estilo resuelto con reemplazos y `modalidad` para la instantánea)
- ADRs: [0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md) §1, §3, §5, §8–§11, [0017](../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md#revisión-para-020--fase-6)
- Spec UX: [10](../ux/10-exportacion.md) (estados, errores, varias exportaciones, interacción con otras acciones, cierre de la app)

## Objetivo

`ServicioExportacion` en main: orquesta todo y lo conecta al IPC, a la biblioteca, al cierre de la app y a la sesión. **Única tarea de la fase que toca `main/ipc/handlers.ts`, `main/index.ts` y `main/cierre.ts`.**

## Contrato

Revisado el 2026-11-20 con las notas de implementación de 0230, 0233, 0236 y 0238–0240 y las respuestas a [0132](../preguntas/0132-avisos-de-limpieza-e-interrupcion-de-la-exportacion.md) y [0133](../preguntas/0133-reintentar-una-exportacion-con-el-mismo-destino.md) (ADR 0019 §5, §6 y §10, revisión del 2026-11-20).

### Servicio (`main/exportacion/servicio.ts`)
- **Cola** propia de concurrencia 1, con una exportación por canción. `DESTINO_OCUPADO` si la ruta del destino coincide con la de otra exportación en curso o en cola (comparación sin mayúsculas en Windows y macOS).
- **Perfiles**: lanza `capacidades-exportacion` la primera vez y guarda el resultado en memoria. Lo combina con `memoriaMinimaDe` y `os.totalmem()` para dar `soportado` y `motivo` por perfil y formato. Con un fallo del sondeo, `exportacion.perfiles()` **rechaza** con `RUNTIME_NO_DISPONIBLE` si falta el motor (el diálogo lo detecta así, 0238). Con cualquier otro fallo, todos los perfiles salen `no_comprobado`.
- **Destinos** (`Destinos` de 0236):
  - `destinoPropuesto` recibe `config.exportacion.carpeta` como carpeta recordada;
  - `desdeTrabajoId` reutiliza la ruta que main guarda de cada trabajo terminado en esta sesión (0133);
  - `elegirDestino` abre el diálogo sobre la ventana principal.
- **`iniciar`**: valida la combinación (catálogo y soporte), la canción (Lista o borrador con instrumental y al menos una línea con inicio; si no, `CANCION_NO_DISPONIBLE`), `perfilCompatibleConSesion` y `DESTINO_OCUPADO`. **Solo después** llama a `Destinos.consumir(destinoId)`: si algo falla antes, el `destinoId` sigue valiendo (0238). Después toma la instantánea de lo guardado: letra, estilo resuelto de `ServicioTemas` con reemplazos, modalidad (`karaoke` si es borrador), duración, `ganancia_db` y pistas presentes. Anota `destinoExistia` y `iniciadaEn`, guarda las opciones en `config.exportacion` y encola.
- **Ejecución**: diario → worker `exportar` (`entrada: 'tuberia'`, `prioridad: 'baja'`, `núcleos − 1` hilos y `parametrosDe` de 0230) → espera el fin de `preparando` → ventana offscreen (0234) → `ejecutarBucle` (0233) → cierre de stdin → resultado → `sustituir` → borrar el diario. Al terminar: `terminadaEn`, `factor_corrector` (`acotarFactorCorrector`) y `carpeta` en `config.exportacion`.
- **Cancelación y fallo**: matar el worker, destruir la ventana, `limpiar` y borrar el diario. Si `limpiar` falla, `limpiezaFallida: true` con el resultado real, y main guarda la ruta del temporal para `mostrarEnCarpeta`. Traducciones de main: `PROCESO_TERMINADO` → `MEMORIA_INSUFICIENTE`; cancelación propia → `cancelado`; `ENTRADA_INCOMPLETA` (tras una caída de la ventana) → `ERROR_INTERNO`. Todos los errores llevan `posicionMs`.
- **Arranque**: `DiarioExportacion.recuperarAlArrancar()` produce un `AvisoExportacionIpc`: `interrumpida`, o `limpieza_fallida` si el temporal no se pudo borrar (main guarda su ruta con el `avisoId`). Los avisos se guardan hasta `avisosPendientes()` y se emiten con `exportacion:aviso`. Cada uno se entrega una vez.
- **Progreso** por fotograma codificado, con el módulo de progreso existente (ETA): ≤ 4 eventos/s y ≥ 1 cada 2 s. `etaSegundos` es `null` los primeros 15 s, para «Calculando tiempo…».
- **Avisos del sistema**: al terminar o fallar con la ventana principal sin foco, la misma notificación y la misma alternativa de macOS sin firma (rebote e insignia del Dock) que la separación, con `main/avisos/`. No se avisa al cancelar.
- **Suspensión**: `powerSaveBlocker.start('prevent-app-suspension')` mientras haya una exportación en curso, liberado al terminar por cualquier causa y en `before-quit`.
- **Biblioteca**: eliminar una canción cancela su exportación, en cola o en curso, con limpieza, y espera a que termine antes de la papelera.
- **Sesión**: sin bloqueo (ADR 0019 §9).

### Contratos compartidos (amplía lo que dejó 0230; excepción a la propiedad de `shared/` y `preload/`)
- `ExportacionIpc` gana `destinoExistia: boolean`, `iniciadaEn: string | null`, `terminadaEn: string | null` y `limpiezaFallida: boolean`. `LIMPIEZA_FALLIDA` deja de ser código de trabajo.
- Nuevos `AvisoExportacionIpc`, el evento `exportacion:aviso`, el canal `exportacion.avisosPendientes` y `mostrarEnCarpeta({ trabajoId } | { avisoId })`. `destinoPropuesto` admite `desdeTrabajoId`, excluyente con `desdeDestinoId`. Se actualizan `ROLES_POR_CANAL` (solo la principal), el preload, los fixtures y `crearApiExportacionFalsa`.
- `MEMORIA_MINIMA` de 2160 líneas pasa de 8 GiB a **7 GiB** (ADR 0019 §5).

### IPC, arranque y cierre
- `main/ipc/handlers.ts`: sustituir los manejadores provisionales que responden `ERROR_INTERNO` (0230) por los reales, con remitente por rol y `rolDe` completo.
- `main/index.ts`: cableado del servicio (biblioteca, temas, config y avisos) y `recuperarAlArrancar()` antes de crear la principal.
- `main/cierre.ts`: `hayAlgoEnCurso` cuenta las exportaciones en curso o en cola. Al confirmar se cancelan con limpieza. «Reparar el motor» también las cancela. En macOS, cerrar la principal no las detiene.

### Renderer ya integrado (ajustes de este alcance)
- `exportacion/estado.ts`: `clasificarAviso` usa `limpiezaFallida` y `AvisoExportacionIpc` (`avisosPendientes()` al montar y `exportacion:aviso`). Se retira la deducción por `PROCESO_TERMINADO` (0132).
- `DialogoSeguimiento.tsx`: «Tardó…» sale de `terminadaEn − iniciadaEn` y `exp.error.conservado`/B3 de `destinoExistia`, también para exportaciones que este diálogo no lanzó. «Reintentar» y «Cambiar opciones» piden `destinoPropuesto({ …, desdeTrabajoId })` (0133).
- `MuestraExportacion`: reutiliza `MarcaDeAgua` de [0235](0235-render-por-fotograma-y-marca-de-agua.md) en lugar de la suya, si 0235 ya está integrada. Si no, queda como deuda de 0241.

## Criterios de aceptación

- [ ] Con dobles de worker y ventana: éxito, cancelación en cola y en curso, fallo del worker, fallo de `rename`, limpieza fallida (`limpiezaFallida` con el resultado real) y caída de la ventana offscreen. Cada caso con el estado, el código, `posicionMs` y la limpieza del ADR.
- [ ] `iniciar` rechazado por cualquier validación no consume el `destinoId`; aceptado, lo consume. `DESTINO_OCUPADO` con el mismo destino que otra exportación en cola.
- [ ] Dos exportaciones: la segunda espera y empieza sola. Una segunda de la misma canción se rechaza.
- [ ] Editar la canción durante la exportación no cambia la instantánea (V14). Eliminarla la cancela antes de la papelera.
- [ ] Un diario de una caída produce un único aviso `interrumpida`, que se entrega aunque la principal se suscriba después. Si el temporal no se puede borrar, el aviso es `limpieza_fallida` con `mostrarEnCarpeta({ avisoId })`.
- [ ] `destinoPropuesto({ desdeTrabajoId })` repite carpeta y nombre del trabajo con la extensión del formato.
- [ ] Con 7,5 GiB de `totalmem` (doble), 2160 líneas se ofrece; con 6 GiB sale `motivo: memoria`.
- [ ] Con la principal sin foco, terminar o fallar lanza la notificación (doble de `main/avisos/`).
- [ ] Abrir una sesión con una exportación en curso no la detiene, y viceversa. `hayAlgoEnCurso` es verdadero con una exportación en cola.
- [ ] En el renderer: toasts de limpieza e interrumpida con los datos nuevos, «Tardó…» y `exp.error.conservado` con una exportación que el diálogo no lanzó, y «Reintentar» con el mismo nombre.

## Pruebas de feedback

- Unitarias: `servicio.test.ts` con dobles (worker, ventana, destinos, diario, avisos y reloj), `handlers.test.ts` de los canales reales, `cierre.test.ts`, esquemas nuevos en `exportacionIpc.test.ts` y, en el renderer, `estado.test.ts` y `ProveedorExportacion.test.tsx` ajustados.
- E2E: ninguna propia (la cubre 0241).
- Críticos: sí.
- Manual: suspensión del equipo durante una exportación larga; cierre de la app a mitad (M7).

## Notas de implementación

**Qué se hizo.** `ServicioExportacion` completo y conectado a la IPC, la biblioteca, el cierre y el arranque.

- `main/exportacion/servicio.ts`: cola de concurrencia 1 (una exportación por canción), perfiles con sondeo cacheado (un fallo no se recuerda; `RUNTIME_NO_DISPONIBLE` rechaza, otro fallo da `no_comprobado`; memoria con `os.totalmem()` y umbral de 7 GiB), estimaciones con el factor corrector, destinos (`desdeTrabajoId`, `DESTINO_OCUPADO` sin mayúsculas en Windows y macOS), `iniciar` con todas las validaciones antes de `consumir` el `destinoId`, instantánea clonada de lo guardado (V14), ejecución (diario → worker `exportar` por tubería con prioridad baja y `núcleos − 1` hilos → ventana offscreen → `ejecutarBucle` → cierre de stdin → `sustituir` → diario borrado), cancelación y fallo con limpieza (worker muerto y ventana destruida antes de tocar el temporal, por Windows), traducciones (`PROCESO_TERMINADO` → `MEMORIA_INSUFICIENTE`, `ENTRADA_INCOMPLETA` → `ERROR_INTERNO`), progreso (≤ 4/s, ≥ 1 cada 2 s, ETA `null` los primeros 15 s con `EstimadorProgreso`), `powerSaveBlocker('prevent-app-suspension')`, avisos de arranque (`avisosPendientes`, `exportacion:aviso`) y `mostrarEnCarpeta({ trabajoId } | { avisoId })`.
- Contratos (`shared/`, preload, fixtures): `ExportacionIpc` con `destinoExistia`, `iniciadaEn`, `terminadaEn` y `limpiezaFallida`; `AvisoExportacionIpc`; canal `exportacion:avisosPendientes`, evento `exportacion:aviso` (rol: solo principal); `destinoPropuesto` con `desdeTrabajoId` (excluyente con `desdeDestinoId`); `mostrarEnCarpeta` con trabajo o aviso; `MEMORIA_MINIMA` a 7 GiB. `crearApiExportacionFalsa` gana `avisosPendientes`, `alAviso` y `emitirAviso`.
- `main/ipc/handlers.ts`: retirados los manejadores provisionales `ERROR_INTERNO`; cada canal de exportación comprueba el rol del remitente; los eventos se reenvían a la principal; `runtime.instalar` («Reparar el motor») cancela antes las exportaciones.
- `main/index.ts`: cableado (biblioteca, temas vía `resolver(cancion).estilo`, config, avisos, `shell`, `dialog.showSaveDialog` sobre la principal, `powerSaveBlocker`) y `recuperarAlArrancar()` antes de crear la principal; eliminar una canción cancela su exportación antes de la papelera; `before-quit` la cierra.
- `main/cierre.ts`: `hayAlgoEnCurso` cuenta las exportaciones (`exportando`), `pausar` recibe la intención y en macOS cerrar la ventana no las detiene. `main/avisos/servicio.ts`: `avisarSistema(texto)` (notificación, parpadeo o Dock sin toast al renderer). `diario.ts` informa de si el temporal no se pudo borrar; `destinos.ts` gana `destinoDesdeRuta` y `rutaDe`, y `consumir` ya no gasta un destino que no se puede usar.
- Renderer: `clasificarAviso` devuelve una lista y usa `limpiezaFallida` (se suma al aviso del resultado real); avisos de arranque por `avisosPendientes()` al montar y `exportacion:aviso` (dedupe por `avisoId`); «Tardó…» sale de `terminadaEn − iniciadaEn` y `exp.error.conservado`/B3 de `destinoExistia`, también para exportaciones que el diálogo no lanzó (se eliminan `tardoMs` y `existia` del contexto); «Reintentar» y «Cambiar opciones» piden `destinoPropuesto({ …, desdeTrabajoId })`; la muestra del diálogo usa `MarcaDeAgua` de 0235 (`.muestraInterior` es un contenedor `size` para sus `cqh`).

**Archivos clave.** `app/src/main/exportacion/servicio.ts` y `servicio.test.ts`, `app/src/main/ipc/handlers.ts` (+ `handlers.exportacion.test.ts`), `app/src/main/index.ts`, `app/src/main/cierre.ts`, `app/src/shared/{exportacion,ipc,canales}.ts`, `app/src/renderer/src/exportacion/`, `app/e2e/exportacion.spec.ts`.

**Cómo probarlo.** `npx vitest run src/main/exportacion src/main/ipc src/shared src/renderer/src/exportacion`; E2E real de punta a punta: `npm run build && npx playwright test e2e/exportacion.spec.ts` (exporta 3 s a 640×480 a 24 FPS con el worker PyAV, la ventana offscreen y la tubería; comprueba 72 fotogramas con PyAV, que solo queda el video en la carpeta y la config).

**Resultado de las comprobaciones.** `typecheck`, `lint`, `format:check`, `test:cambios` y `test:e2e:criticos` en verde; `out/preload/*.js` solo requieren `electron`. Medidas en este equipo (macOS, Apple Silicon, un solo intento, no son la guía M1): 640×480 a 24 FPS × 72 fotogramas, 3,1 s con el arranque de la app; 1920×1080 a 30 FPS × 900 fotogramas (30 s de canción), 26,3 s; cancelar a mitad del 1080p/720p tardó 40 ms y no dejó temporal ni diario.

**Decisiones y desviaciones.**
- Sin señal de fin de `preparando` (el worker no la emite y esperar `codificando` bloquearía): la ventana se crea a la vez que el worker prepara el audio y la tubería frena el bucle. Pregunta [0134](../preguntas/0134-fin-de-la-fase-preparando-de-la-exportacion.md) (no bloquea).
- `iniciadaEn` se anota cuando la exportación empieza a ejecutarse (en cola vale `null`), para que «Tardó…» no cuente la espera.
- Tras cancelar o fallar el diario se borra siempre, también con `limpiezaFallida` (como pide esta tarea; el ADR 0019 §6 decía conservarlo). Si se conservara, el arranque lo leería como una exportación «interrumpida» falsa.
- Una segunda exportación de la misma canción se rechaza con `ARGUMENTOS_NO_VALIDOS` (no hay código propio en el catálogo).
- El aviso del sistema (`avisarSistema`) usa los textos de `exp.toast.ok` y `exp.toast.error`; al pulsarlo solo trae la ventana al frente.
- Un `capturar()` o un fotograma colgados no retrasan la cancelación: se destruye la ventana en el momento.

**Para la guía manual (`docs/Test-manuales/`).**
- Suspensión del equipo durante una exportación larga (el sistema no debe suspenderse; la pantalla sí puede apagarse) y que el bloqueo se libera al terminar, cancelar o fallar.
- M7: cerrar la app a mitad confirmando el diálogo (sin temporales en la carpeta) y matar el proceso: aviso `interrumpida` una sola vez al reabrir; si el temporal sigue abierto, aviso de limpieza con «Mostrar en la carpeta» (Windows: sustituir y borrar con el archivo abierto en otro programa).
- Windows: notificación del sistema con la principal sin foco al terminar y al fallar; macOS sin firma: rebote e insignia del Dock.
- Cerrar la ventana principal en macOS con una exportación en curso: no la detiene y, al reabrir la ventana, el diálogo la sigue.
- Exportar durante una sesión en vivo y abrir una sesión durante una exportación (audio de la secundaria sin cortes).

**Deuda técnica.** Las exportaciones terminadas se recuerdan en memoria (50 como máximo) y se pierden al reiniciar. «Mostrar en la carpeta» de un trabajo fallido sin `limpiezaFallida` responde `DESTINO_NO_DISPONIBLE` (no hay archivo que mostrar). Los E2E de los demás casos (cancelar, fallo, caídas, aviso de arranque con la app real) son de 0241.
