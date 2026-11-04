# 0014 — Gestor de trabajos: colas, progreso con ETA, cancelación y eventos
- Estado: Pendiente
- Paso del pipeline: 0 (base de los pasos 1 y 2)
- Depende de: 0010, 0011, 0013
- ADRs: 0004, 0006
- Spec UX: docs/ux/04-progreso-pipeline.md (cola, ETA, cancelación, cierre con trabajos)

## Objetivo
Orquestar los trabajos en segundo plano según `arquitectura.md` §6, reflejarlos en la canción y avisar al renderer. En esta fase se prueba con el comando `demo`; los trabajos reales llegan en las fases 2 y 3.

## Criterios de aceptación
- [ ] Dos colas: `pesada` (concurrencia 1) y `ligera` (concurrencia 1), independientes. Un trabajo tiene `id`, `cancionId`, `paso` (`fuente` | `separacion`), `cola`, `comando`, `args`, estado (`en_cola` | `en_curso` | terminado) y posición en cola.
- [ ] Al empezar un trabajo, el paso de la canción pasa a `en_curso`; al terminar, a `completado` (con los datos del resultado aplicados mediante una función del llamador) o `error` (`{codigo, mensaje}`); al cancelar, a `pendiente`. Siempre a través del servicio de biblioteca (0010).
- [ ] Progreso: suavizado y **ETA** calculada con la velocidad observada en la fase determinada (sin ETA durante fases indeterminadas ni los primeros 15 s, como pide `ux/04`); eventos `trabajo:progreso` al renderer a ≤ 4 por segundo; `pasos.<paso>.progreso` en `cancion.json` cada ≥ 5 %.
- [ ] API IPC (`trabajos.listar()`, `trabajos.cancelar(id)`, `trabajos.alCambiar(cb)`) añadida al contrato de 0011. Cancelar un trabajo en cola lo retira sin lanzar nada.
- [ ] `biblioteca.eliminar(id)` (0010) cancela antes los trabajos de esa canción.
- [ ] Cierre de la app: `before-quit` consulta si hay trabajos en curso o en cola y expone esa información al renderer (`trabajos.hayPendientes()`); el diálogo visual se implementa con la vista de progreso (Fase 3). Si se cierra, se cancelan todos y no queda ningún proceso hijo vivo.
- [ ] Comando de desarrollo (solo en `npm run dev`, p. ej. menú "Desarrollo → Lanzar demo") que encola un `demo` sobre una canción de la semilla para verificar a mano progreso, cola y cancelación.
- [ ] Tests: orden FIFO por cola, concurrencia 1, trabajos ligero y pesado en paralelo, cancelación en cola y en curso, error → paso `error`, cierre con trabajos.

## Notas de implementación
(las rellena el programador al terminar)
