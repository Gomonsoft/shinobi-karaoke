# 0269 — Doble clic en una región y Mayús + L: escuchar la línea con 0,5 s de margen

- Estado: Pendiente
- Paso del pipeline: 4 (editor)
- Fase: 8 de 0.2.1 · Lote D (editor)
- Depende de: 0268 (mismo lote: `Editor.tsx`, `atajos.ts`, `DialogoAtajos.tsx`)
- ADRs: [0021](../adr/0021-sincronia-simplificada-y-editor-preciso-de-linea.md) §8; [0015](../adr/0015-linea-de-tiempo-y-picos-de-voz.md#revisión-para-021--fases-8-y-9)
- Spec UX: [06 · 8.4](../ux/06-editor.md#84--doble-clic-en-una-región-de-la-línea-de-tiempo-escuchar-la-línea), criterios **E8-7**, **E8-8**, **E8-9**; claves `edi.timeline.region.tooltip`, `edi.escucharLinea`, `edi.escucharLinea.sinInicio`, `edi.atajo.escucharLinea`
- Tamaño: S

## Objetivo

Escuchar una línea con un doble clic (feedback, punto 5), con el margen en una constante con nombre.

## Archivos (solo estos)

- `app/src/shared/escucha.ts` (nuevo: `MARGEN_ESCUCHA_LINEA_MS = 500`, `MARGEN_ESCUCHA_PALABRA_MS = 250` y la función pura `tramoEscuchaLinea(letra, id, duracionMs)` en tiempo de audio) y `escucha.test.ts`
- `app/src/renderer/src/vistas/editor/`: `PistaSincronia.tsx`, `Editor.tsx`, `atajos.ts`, `DialogoAtajos.tsx`, `PanelSincronia.tsx` (botón «Escuchar la línea», si la spec lo pone en el panel), `textos.ts` y sus tests

## Criterios de aceptación

- [ ] Doble clic en el **cuerpo** de una región: reproduce con `reproducir({ desdeMs, hastaMs })` desde `máx(0, inicio mostrado − 500)` hasta `mín(duración, fin efectivo mostrado + 500)` y se pausa ahí; con la reproducción en curso salta sin pausa; con el inicio a 0,3 s empieza en 0 (E8-7, reloj simulado ± 20 ms). Sobre un tirador no reproduce (E8-8). Tooltip de la región `edi.timeline.region.tooltip`.
- [ ] «Bloquear enunciado» en la misma línea: busca a `máx(0, inicio audible − 500)`, el bucle sigue y no se pausa al final; en otra línea, el bucle termina sin restaurar la posición y suena el tramo nuevo (E8-8). Sustituye a la escucha de comprobación si estaba en curso. Región recortada: no suena y tooltip `edi.timeline.bucle.fuera`.
- [ ] **Mayús + L** hace lo mismo sobre la línea seleccionada (fuera de campos de texto); sin inicio no hace nada y muestra `edi.escucharLinea.sinInicio`. **L** y el doble clic en la lista no cambian (E8-9). El diálogo de atajos tiene la fila `edi.atajo.escucharLinea`.
- [ ] El valor sale de `MARGEN_ESCUCHA_LINEA_MS` (sin literales 500 en el renderer).

## Pruebas de feedback

- Unitarias: `escucha.test.ts` (tramo, recorte a 0 y a la duración, `offset_ms`), `PistaSincronia` (doble clic en cuerpo y en tirador) y `atajos.test.ts` (Mayús + L).
- E2E: un caso en `e2e/editor.spec.ts` (doble clic reproduce y se pausa al final), ejecutando esa spec.
- Críticos: sí (`shared/` y editor).
- Manual: guía de la fase 8 — el doble clic se siente natural con ratón y *touchpad*.

## Notas de implementación
