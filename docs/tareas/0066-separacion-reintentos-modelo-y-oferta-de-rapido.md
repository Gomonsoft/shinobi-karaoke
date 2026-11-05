# 0066 — Separación: reintentos por memoria, modelo que falta y oferta del modelo Rápido
- Estado: Hecha
- Paso del pipeline: 2
- Depende de: 0057, 0065
- ADRs: 0004 (Revisiones 2026-11-05, puntos 2–4; Revisión 2026-11-05 bis), 0009 §4
- Spec UX: docs/ux/04-progreso-pipeline.md (wireframe "Error de separación con oferta del modelo Rápido", criterios 7, 8b, 8c, 18 y 20), docs/ux/02-biblioteca.md (criterio 18). Textos definitivos tras `preguntas/0019` §3 y `0020`; detalles técnicos en `preguntas/0021` §1
- Cuándo: tras 0065; en paralelo con 0068–0072

## Objetivo
Política de reintentos de `separar` sobre el mecanismo de 0063 y conexión con la puerta de consentimiento de 0057. **Nunca se pasa a Rápido de forma automática.**

## Criterios de aceptación
- [ ] **Política de `separar`** (`politicaReintento` de 0063):
  1. `MEMORIA_INSUFICIENTE` o `PROCESO_TERMINADO` en el intento 1 → intento 2 con `bloques: 'pequenos'`, mismo dispositivo y mismo modelo (`motivo: 'memoria'`, sin espera).
  2. Lo mismo en el intento 2 con `dispositivo: 'cuda'` → intento 3 con `dispositivo: 'cpu'` y `bloques: 'pequenos'` (`motivo: 'memoria_cpu'`).
  3. En cualquier otro caso, o si ya no quedan intentos → error definitivo `MEMORIA_INSUFICIENTE` (también si el último fue `PROCESO_TERMINADO`).
  - El resto de códigos no se reintenta.
  - Si el trabajo cambió de dispositivo, no se guarda el factor medido (0065).
  - La fase `reintentando` lleva `motivo: 'memoria'` o `'memoria_cpu'`, y la interfaz la muestra con `prog.reintento.memoria` (variante "con el procesador" en el tercer intento) y `bib.paso.reintento.memoria`. `PROCESO_TERMINADO` se comporta **exactamente** igual que la memoria, también en el error final y en la oferta (`ux/04` criterio 20).
- [ ] **Modelo que falta**: antes de lanzar el worker (en el gancho de inicio de 0065), el servicio comprueba el modelo del modo vigente con `modelos/verificados.json` (tamaño y `mtime`, ADR 0009 §4).
  - Si falta o no cuadra → lo descarga dentro del mismo trabajo con el `DescargadorModelos` de 0033 (reanudable, SHA-256), emitiendo la fase `descargando_modelo` con bytes. Cancelar el trabajo cancela la descarga y conserva el `.descarga`. Después lanza el worker.
  - Si la descarga falla → error definitivo `MODELO_NO_DISPONIBLE` con el `codigo` de la descarga en `mensaje` (`SIN_CONEXION`, `VERIFICACION_FALLIDA`, `SERVICIO_NO_DISPONIBLE`, `SIN_ESPACIO`).
  - Si el **worker** devuelve `MODELO_NO_DISPONIBLE` (checkpoint corrupto) → se borra la entrada de `verificados.json` y el archivo, y se reintenta **una vez** pasando por la descarga.
  - Con modo `rapido` y su modelo ausente se usa Calidad (ADR 0004, Revisiones punto 3), y `TrabajoIpc.modo` lo refleja.
  - Durante `descargando_modelo`, "Cancelar separación" sigue disponible (`ux/04` criterio 18). Lo descargado se conserva para la próxima vez.
  - El error final se muestra con "Reintentar", que vuelve a intentar la descarga y la separación, y no con "Descargar y reintentar" (`preguntas/0020` §2).
- [ ] **Oferta de Rápido** (conecta la precondición de 0057):
  - `ofertaRapidoVigente(cancionId?)` es `true` si se cumplen las tres condiciones:
    - la canción tiene `separacion` en `error` con `MEMORIA_INSUFICIENTE`, o con `MODELO_NO_DISPONIBLE` **sin** causa `SIN_CONEXION`;
    - el trabajo fallido **se separaba con Calidad**. Se guarda `modelo: 'calidad'` en el `mensaje` o en un campo opcional del error del paso, con migración tolerante; anotar cuál se eligió;
    - no hay Rápido pendiente (`preguntas/0021` §1).
  - Separando con Rápido, el error de memoria no tiene oferta (`prog.error.MEMORIA_INSUFICIENTE.rapido`).
  - Se deriva de `cancion.json`, así que sobrevive a un reinicio.
  - `runtime.aceptarYUsarRapido('separacion')` (0057) la usa como precondición.
  - El renderer, tras aceptar, llama a `separacion.separar(id)`, que se lanza con Rápido.
  - Si la descarga de Rápido falla o se cancela, el modo no cambia y queda `rapidoPendiente` (0057). "Reintentar" vuelve a llamar a `aceptarYUsarRapido('separacion')` sin diálogo y luego a `separar` (`ux/04` 8c y `preguntas/0021` §1).
  - Las separaciones que estén en cola usarán también Rápido al empezar (modo vigente).
  - Se expone a la interfaz como campo derivado del resumen o de la canción (`ofrecerRapido: boolean`), sin canal nuevo si es posible.
- [ ] **Runtime falso**: el escenario puede marcar el modelo Calidad como ausente y hacer fallar su descarga (`SIN_CONEXION` o `VERIFICACION_FALLIDA`), para los E2E de 0076.
- [ ] Tests (gestor y worker falsos, con el escenario del separador de 0060):
  - memoria en el intento 1 → éxito en el 2 con `bloques: 'pequenos'`;
  - CUDA: intentos 1 y 2 fallan → 3.º en CPU;
  - CPU: dos fallos → error definitivo y `ofrecerRapido`;
  - `PROCESO_TERMINADO` tratado como memoria;
  - modelo ausente → `descargando_modelo` → éxito;
  - descarga fallida con `SIN_CONEXION` → `MODELO_NO_DISPONIBLE` sin oferta;
  - con `VERIFICACION_FALLIDA` → con oferta;
  - checkpoint corrupto → una re-descarga;
  - aceptar Rápido sin oferta vigente → `ARGUMENTOS_NO_VALIDOS`;
  - aceptar con oferta → `separar` usa Rápido;
  - nunca se lanza Rápido sin `rapido_aceptado`.

## Notas de implementación
**Qué se hizo**
- `main/separacion/servicio.ts`: `politicaReintento` de `separar` (`planMemoria`, decide por los args del intento que falló: `bloques: 'normal'` → `pequenos` con `motivo: 'memoria'`; `pequenos` + `cuda` → CPU con `motivo: 'memoria_cpu'`; si no, `null`). `MEMORIA_INSUFICIENTE` y `PROCESO_TERMINADO` se tratan igual; `traducirError` convierte el `PROCESO_TERMINADO` definitivo en `MEMORIA_INSUFICIENTE`. Sin espera. El factor medido no se guarda si cambió el dispositivo (ya estaba en 0065).
- **Modelo que falta**: puerto `PuertoModelos` (`verificado`, `descargar`, `borrar`; implementado en `separacion/modelos.ts` sobre `runtime/modelos.ts`: `modeloVerificado` compara `verificados.json` con tamaño y `mtime`, sin SHA-256, y `borrarModelo`; la descarga es `runtime.gestor.descargarModelo`, reanudable, y exige consentimiento si es Rápido). `alEmpezar` lo comprueba y descarga dentro del mismo trabajo (fase `descargando_modelo` con bytes; cancelar aborta la descarga y conserva el `.descarga`). Fallo → `MODELO_NO_DISPONIBLE` con el código de la descarga en `mensaje`. Si el worker devuelve `MODELO_NO_DISPONIBLE`: plan con `motivo: null` y `antes` que borra el modelo, lo descarga y recrea `pistas.tmp`, una sola vez, sin contar como intento ni mostrar `reintentando`. Con modo `rapido` y modelo no verificado se usa Calidad (`TrabajoIpc.modo` lo refleja).
- **Oferta de Rápido**: `ServicioSeparacion.ofertaRapidoVigente(cancionId?)`. **Dónde se guarda el modelo**: campo opcional `modelo` (`calidad | rapido`) en el error del paso (`errorPasoSchema`, resumen e IPC del resumen), escrito por el gestor (`error.modelo ?? trabajo.modo`) solo en `separacion`; las canciones antiguas no lo tienen y no ofrecen Rápido (migración tolerante). Condiciones: modo vigente Calidad, sin Rápido pendiente, error `MEMORIA_INSUFICIENTE` o `MODELO_NO_DISPONIBLE` con `mensaje !== 'SIN_CONEXION'`, con `modelo === 'calidad'`. Se deriva de `cancion.json`. Se conecta a `runtime.aceptarYUsarRapido('separacion')` con `ofertaSeparacionVigente` (composicion.ts/index.ts, enlace tardío) y a `runtime.estado().ofrecerRapido` (la vista de 0068 lo lee de ahí; `calcularOfertaInstalacion` queda para el origen `primer_arranque`). Sin canal IPC nuevo. `ServicioRuntime.refrescar()` (no IPC) difunde el estado cuando termina una separación (`alCambiarOferta`).
- **Gestor** (cambios mínimos): `alEmpezar(trabajo, { señal, alProgreso })`; `PlanReintento.motivo: MotivoReintento | null` y `PlanReintento.antes`; `PeticionTrabajo.entornoIntento(intento)` (→ `OpcionesEjecucion.env` en `worker.ts`: `SHINOBI_INTENTO` por intento, solo con `intentoEnEntorno`, que `index.ts` activa sin empaquetar y con `SHINOBI_SEPARADOR_FALSO`); `PeticionTrabajo.traducirError`.
- **Runtime falso**: el descargador falso anota el modelo en `verificados.json` (como el real). "Calidad ausente" = no estar en `verificados.json`; "fallo de su descarga" = el escenario ya existente `fallo: { fase: 'modelo', modelo: 'calidad', codigo: 'SIN_CONEXION' | 'VERIFICACION_FALLIDA', veces: 'siempre' }`.
- Tests: `separacion/servicio.reintentos.test.ts` (19: todos los casos de la tarea con gestor real y worker simulado), un caso nuevo en `servicio.integracion.test.ts` (worker real + separador falso, CUDA → CPU con `SHINOBI_INTENTO`), 2 en `runtime/servicio.test.ts`. `servicio.test.ts`: el test de fallo usa ahora `ERROR_INTERNO` (la memoria ya se reintenta).
- **Cómo probarlo**: `SHINOBI_UV=<uv> npx vitest run src/main/separacion src/main/runtime`.

**Deuda / notas**
- Los E2E que separan sin modelo en disco ahora descargan el modelo con el runtime falso (en vez de fallar con `MODELO_NO_DISPONIBLE`); 0076 debe sembrar `verificados.json` o usar el escenario de fallo. `importar-youtube › cerrar la app durante la descarga` falla en E2E también con la comprobación de modelo desactivada (probable causa ajena: renderer en curso de 0069–0072).
- Mientras se descarga `descargando_modelo` el progreso del paso se persiste como el de `separando` (el umbral evita retrocesos, pero la barra del paso puede parecer adelantada); la vista de 0068 ya usa el evento, no el persistido.
- Sin tests unitarios propios en `trabajos/gestor.test.ts` para los ganchos nuevos (`antes`, `motivo: null`, `traducirError`, `entornoIntento`): los cubre `servicio.reintentos.test.ts`.
