# 0186 — Panel de la cola: lista de pendientes

- Estado: Pendiente
- Paso del pipeline: 6
- Depende de: [0183](0183-estado-de-sesion-en-la-principal-bloqueo-de-edicion-e-indicador.md). Puede avanzar en paralelo con [0185](0185-panel-de-cola-sesion-controles-recuperacion-y-cierre.md) como componente aislado. Se integra en el hueco del panel cuando 0185 lo deja.
- ADRs: [0017](../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md) §6 (operaciones por id, deshacer y vaciar)
- Spec UX: [Biblioteca · Fase 4](../ux/02-biblioteca.md#fase-4-de-020--ventana-secundaria-y-cola) (filas de «A continuación», «⋯ de una pendiente», reordenar con ratón y teclado, navegación, quitar y deshacer, vaciar, «Cambios hechos por otros», S4–S6 y S16), [Sistema visual · Fase 4](../ux/sistema-visual.md#020--ventana-secundaria-y-cola-fase-4) (fila y arrastre)

## Objetivo

Crear la lista «A continuación ({n})» con reordenación por arrastre, teclado y menú, quitar con deshacer y vaciar. Todo se hace sobre entradas por id y nunca interrumpe la activa.

## Contrato

- **`vistas/biblioteca/cola/ListaPendientes.tsx`**:
  - `role="list"` con *roving tabindex*. Las filas de 48 px muestran posición, asa, «título — artista», duración y ⋯;
  - la etiqueta «Siguiente» va en la candidata durante la cuenta y en la espera;
  - `cola.noDisponible` con la causa, y `bib.lista.incompleta`;
  - nombre accesible `cola.aria.fila`.
- **Reordenar**:
  - arrastre desde el asa con la línea de destino; Esc cancela; desplazamiento automático en los bordes; nunca por encima de la activa;
  - Alt + ↑ / ↓ y Alt + Inicio / Fin;
  - el ⋯ con «Reproducir a continuación», «Subir», «Bajar», «Mover al final», «Agregar otra vez al final» y «Quitar de la cola».
  
  Todo se traduce a `cola.mover({ entradaId, antesDe })` o a `cola.agregar`. El foco sigue a la fila movida y se anuncia `cola.anuncio.movida`.
- **Quitar** (⋯ o Supr):
  - `cola.quitar`, sin confirmación;
  - toast `cola.toast.quitada` con [Deshacer] → `cola.agregar({ cancionId, donde: { antesDe, siRevision } })` con lo que devolvió `quitar`;
  - el foco pasa a la siguiente fila, si no a la anterior, si no al encabezado.
- **[Vaciar…]**: con 2 o más pendientes. Abre el diálogo `cola.dialogo.vaciar` y llama a `cola.vaciar({ contexto: false })`.
- **Cambios externos**: la lista se actualiza sin mover el foco. Si desaparece la fila enfocada, se aplica la regla de «Quitar».

## Archivos

`app/src/renderer/src/vistas/biblioteca/cola/ListaPendientes.tsx`, `FilaPendiente.tsx`, `useArrastreCola.ts` (o el nombre equivalente) y sus pruebas. Sin dependencias nuevas: el arrastre se hace con eventos de puntero, como los divisores de la subfase 2.1.

## Criterios de aceptación

- [ ] S4 (la parte de la lista y el deshacer), S5, S6 y S16 de la spec 02 en Vitest.
- [ ] Ratón, teclado y ⋯ dan el mismo orden: misma secuencia de `cola.mover` en las pruebas.
- [ ] [Deshacer] tras quitar, sin cambios entre medias, vuelve a la posición original. Con un cambio entre medias, va al final, porque la revisión es distinta.
- [ ] Una entrada repetida se ve como dos filas con `entradaId` distintos, y moverlas no las confunde.
- [ ] Con movimiento reducido no hay animación al reordenar.

## Notas de implementación
