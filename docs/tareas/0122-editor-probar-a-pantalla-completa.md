# 0122 — Editor: "Probar a pantalla completa" (botón y F), desplazamiento como un paso de deshacer y vuelta a la posición del reproductor
- Estado: Pendiente
- Paso del pipeline: 6
- Depende de: 0117 (`liberarAudio`), 0118 (`useVolumenCompartido` en el editor), 0119, 0120 (desplazamiento)
- ADRs: 0011 (§3 "Editor", §4 "Capa del editor"), 0010
- Spec UX: docs/ux/06-editor.md (§"Probar a pantalla completa", tabla de atajos (F), criterios 18, 42 y los de esta revisión; `edi.boton.probar`, `edi.probar.tooltip`, `edi.probar.sinlineas`); docs/ux/07-reproductor.md (§"Entrada" fila Editor, §"Prueba desde el editor"; criterios 27–30)
- Archivos (todos del editor): `app/src/renderer/src/vistas/editor/Editor.tsx`, `estado.ts` (+ test), `atajos.ts` (+ test), `DialogoAtajos.tsx`, `textos.ts`, `Editor.test.tsx`; el botón va bajo la vista previa (donde lo sitúan los wireframes A y B de `ux/06`).
- Paralelizable con: 0120, 0121.

## Contexto para quien implementa
- El editor (`Editor.tsx`) tiene:
  - un `MotorAudio` (`useMotorAudio`) con pista (original/voz/instrumental) y velocidad;
  - un *reducer* con historial (`estado.ts`; acciones `desplazar { deltaMs, ahora }` y `fijar_desplazamiento`);
  - la selección de línea;
  - el guardado con `vaciar()` (`useGuardadoEditor`);
  - los atajos en `atajos.ts` + `useAtajosEditor.ts`. Este último ya ignora el teclado si hay un `[role="dialog"]` en el documento, y la capa del reproductor lo es.
- La separación está completa si `cancion.pasos.separacion.estado === 'completado'` (lo que el editor ya usa para activar "Instrumental").
- El reproductor (0119/0120) recibe la instantánea en memoria y devuelve `alSalir({ posicionMs })` y `alDesplazar(±100)`.

## Objetivo
Probar la canción tal como se cantará sin salir del editor ni perder nada de él.

## Criterios de aceptación
- [ ] **Disponibilidad**: el botón `edi.boton.probar` (tooltip `edi.probar.tooltip`) y la tecla F están activos salvo:
  - en el modo "Sincronizar al ritmo" y su cuenta atrás (criterio 18);
  - sin ninguna línea con inicio → inactivo con `edi.probar.sinlineas` (texto y comportamiento exactos de `ux/06`).
  `DialogoAtajos` muestra "F — Probar a pantalla completa".
- [ ] **Abrir**:
  1. `await vaciar()`. Si falla, se sigue el comportamiento de `ux/06` (comprueba si pide el diálogo de salida o abre igual; si no lo dice, abre igual: el autoguardado sigue reintentando).
  2. Recuerda `{ pista, velocidad }` del motor del editor y llama a `motor.liberarAudio()`.
  3. Calcula `desdeMs`: con la línea seleccionada con inicio, `max(0, inicio_ms + offset_ms − 3000)`; si no tiene inicio, `max(0, motor.posicionMs())`.
  4. Monta `Reproductor` en una capa con `origen: 'editor'`, `modo` = `'karaoke'` si la separación está completada y `'original'` si no (con la etiqueta `rep.original` arriba en el centro, siempre visible, que dibuja el reproductor), la instantánea `{ letra, estilo }` del *reducer* (en vivo), `titulo`/`artista`/`duracionMs`/`gananciaDb` de la canción y `lineasSinSincronizar: 0` (desde el editor no hay aviso).
- [ ] **Desplazamiento**:
  - `alDesplazar(delta)` despacha `{ tipo: 'desplazar', deltaMs: delta, ahora, grupo: idPrueba }`;
  - el *reducer* gana el campo opcional `grupo?: string`: las entradas seguidas con el mismo `grupo` se funden en **una** del historial (un solo Ctrl/Cmd+Z deshace toda la prueba). Sin `grupo`, el comportamiento actual no cambia;
  - `idPrueba` es nuevo en cada apertura;
  - acotado a ±30 000 ms como ya hace el editor;
  - el autoguardado sigue su curso (también si se cierra la ventana con la capa abierta);
  - tests del *reducer*.
- [ ] **Volver** (`alSalir({ posicionMs })`):
  - desmonta la capa;
  - `motor.usarPista(pistaRecordada)` y `fijarVelocidad(velocidadRecordada)`, y luego `buscar(posicionMs)`, en pausa;
  - selecciona la línea que sonaba en `posicionMs` (la última con `inicio_ms + offset_ms ≤ posicionMs`); si ninguna había empezado, la selección no cambia;
  - desplaza la lista hasta ella;
  - el foco vuelve al botón "Probar a pantalla completa".
  El historial conserva todo lo anterior y el paso del desplazamiento, si lo hubo. La visita de `letras.abrirEdicion` no se cierra en ningún momento.
- [ ] La vista previa del editor, el autoguardado y el indicador de guardado siguen funcionando con la capa abierta (el editor sigue montado).
- [ ] Tests (`Editor.test.tsx`, API falsa del editor, reproductor con motor falso):
  - F abre la capa con `desdeMs` = línea − 3 s;
  - sin separación, modo `original`;
  - `.` dos veces y Esc → `offset_ms` +200 en el estado y un solo Ctrl+Z lo deshace;
  - al volver, la selección es la línea que sonaba, la pista y la velocidad son las de antes y el foco está en el botón;
  - F inactiva en el modo de sincronizar.

## Verificación
```bash
cd app
npm run lint && npm run typecheck && npm run format:check && npm test
npm run build && export SHINOBI_UV="$(which uv)" && npx playwright test e2e/editor.spec.ts
```

## Notas de implementación
(las rellena el programador al terminar)
