# 0237 — Servicio de exportación, cola, perfiles e IPC

- Estado: Pendiente
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
