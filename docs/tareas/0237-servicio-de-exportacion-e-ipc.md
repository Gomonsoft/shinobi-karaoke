# 0237 — Servicio de exportación, cola, perfiles e IPC

- Estado: Pendiente
- Paso del pipeline: 6
- Depende de: [0231](0231-worker-comando-exportar.md), [0232](0232-capacidades-de-exportacion-y-licencias-de-codecs.md), [0233](0233-cliente-del-worker-con-tuberia-y-bucle-de-fotogramas.md), [0234](0234-ventana-offscreen-de-exportacion-y-rol.md), [0236](0236-destinos-temporal-y-diario-de-exportacion.md)
- ADRs: [0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md) §1, §3, §5, §8–§11, [0017](../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md#revisión-para-020--fase-6)
- Spec UX: [10](../ux/10-exportacion.md) (estados, errores, varias exportaciones, interacción con otras acciones, cierre de la app)

## Objetivo
`ServicioExportacion` en main: orquesta todo y lo conecta al IPC, a la biblioteca, al cierre de la app y a la sesión. **Única tarea de la fase que toca `main/ipc/handlers.ts`, `main/index.ts` y `main/cierre.ts`.**

## Contrato
- `main/exportacion/servicio.ts`:
  - **cola** propia de concurrencia 1; una exportación por canción; `DESTINO_OCUPADO`;
  - **perfiles**: lanza `capacidades-exportacion` la primera vez y guarda el resultado; combina con `MEMORIA_MINIMA` (`os.totalmem()`) para `soportado` y `motivo`;
  - **instantánea** de lo guardado al aceptar `iniciar` (letra, estilo resuelto de `ServicioTemas`, modalidad — `karaoke` si es borrador —, duración, `ganancia_db`, pistas presentes; `CANCION_NO_DISPONIBLE` si falta el instrumental);
  - **ejecución**: diario → worker `exportar` (tubería, prioridad baja, `núcleos − 1` hilos) → espera `preparando` → ventana offscreen → `ejecutarBucle` → cierre de stdin → resultado → `sustituir` → borrar diario → `config.exportacion` (opciones y `factor_corrector`);
  - **cancelación y fallo**: matar el worker, destruir la ventana, `limpiar`, borrar diario; traducir `PROCESO_TERMINADO` a `MEMORIA_INSUFICIENTE` y la cancelación propia a `cancelado`; `posicionMs` en los errores;
  - **progreso**: por fotograma codificado, con el módulo de progreso existente (ETA), ≤ 4 eventos/s, ≥ 1 cada 2 s;
  - **suspensión**: `powerSaveBlocker('prevent-app-suspension')` mientras haya una en curso;
  - **biblioteca**: eliminar una canción cancela su exportación con limpieza antes de la papelera;
  - **sesión**: sin bloqueo (ADR 0019 §9); consulta `perfilCompatibleConSesion` al iniciar por si la tabla deja de estar vacía.
- `handlers.ts`: canales de §10 con remitente por rol. `index.ts`: cableado y `recuperarAlArrancar()` (aviso único al renderer). `cierre.ts`: `hayAlgoEnCurso` cuenta exportaciones; al confirmar se cancelan; «Reparar el motor» también las cancela. En macOS, cerrar la principal no las detiene.

## Criterios de aceptación
- [ ] Con dobles de worker y ventana: éxito, cancelación en cola y en curso, fallo de worker, fallo de `rename`, `LIMPIEZA_FALLIDA` y caída de la ventana offscreen, cada uno con el estado, el código y la limpieza del ADR.
- [ ] Dos exportaciones: la segunda espera y empieza sola; una segunda de la misma canción se rechaza.
- [ ] Editar la canción durante la exportación no cambia la instantánea (V14); eliminarla la cancela.
- [ ] Abrir una sesión con una exportación en curso no la detiene, y viceversa.
- [ ] `hayAlgoEnCurso` es verdadero con una exportación en cola.

## Pruebas de feedback
- Unitarias: `servicio.test.ts` con dobles (worker, ventana, destinos, reloj), `handlers.test.ts` de los canales nuevos, `cierre.test.ts`.
- E2E: ninguna propia (la cubre 0241).
- Críticos: sí.
- Manual: suspensión del equipo durante una exportación larga; cierre de la app a mitad (M7).

## Notas de implementación
