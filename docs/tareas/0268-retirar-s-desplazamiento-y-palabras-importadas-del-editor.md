# 0268 — Retirar del editor el atajo S, el desplazamiento de toda la letra y las marcas de palabras importadas

- Estado: Pendiente
- Paso del pipeline: 4 (editor) y 5 (prueba desde el editor)
- Fase: 8 de 0.2.1 · Lote D (editor), primera del lote
- Depende de: — (si 0261 ya está integrada, adapta además las pruebas del editor que esa tarea anotó como rotas)
- ADRs: [0021](../adr/0021-sincronia-simplificada-y-editor-preciso-de-linea.md) §2 y §8; [0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md#revisión-para-021--fases-8-y-9)
- Spec UX: [06 · Fase 8](../ux/06-editor.md#fase-8-de-021--sincronía-y-editor-más-simples): 8.1 (filas «Lista de líneas» y «Panel Sincronía»), 8.3, 8.5, «Atajos de teclado en 0.2.1», «Microcopy (fase 8, editor)» y «Claves retiradas»; criterios **E8-1** (sin ◆ ni «por palabra»), **E8-6**, **E8-10**, **E8-11**; [07 · Fase 8, «Prueba desde el editor sin desplazamiento»](../ux/07-reproductor.md#prueba-desde-el-editor-sin-desplazamiento), **R8-2**
- Tamaño: M

## Objetivo

Quitar lo que confunde (feedback, puntos 3, 4 y 6) sin tocar los datos: `offset_ms` se sigue aplicando.

## Archivos (solo estos)

- `app/src/renderer/src/vistas/editor/`: `atajos.ts`, `estado.ts`, `PanelSincronia.tsx`, `ListaLineas.tsx`, `Editor.tsx`, `DialogoAtajos.tsx`, `textos.ts`, `editor.module.css` y sus tests
- `app/src/renderer/src/vistas/reproductor/`: `atajos.ts`, `modelo.ts`, `Reproductor.tsx` y sus tests
- `app/e2e/editor.spec.ts`, `e2e/reproductor.spec.ts`, `e2e/fixtures/editor.ts` y las demás specs que usen S, `,`, `.` o el panel de desplazamiento (buscar con `grep`)

## Criterios de aceptación

- [ ] **S** no hace nada en el editor (lista, línea de tiempo, panel, transporte); el botón dice `edi.boton.sync` sin «(S)»; `edi.banner.sinsync` sin la tecla; el diálogo de atajos es la tabla «Atajos de teclado en 0.2.1» sin S, `,` ni `.` (E8-6). (P y Mayús + L de la tabla los añaden 0269 y 0279.)
- [ ] Sin sección de desplazamiento en el panel; `,` y `.` no hacen nada en el editor ni en «Probar a pantalla completa»; sin indicador `rep.offset`; la prueba no crea pasos de deshacer (E8-10, R8-2). Se retiran las acciones `desplazar` y `fijar_desplazamiento` del *reducer* y el `limite` de tipo `desplazamiento`.
- [ ] Con una canción de prueba con `offset_ms: 1500`, lista, ticks, regiones, vista previa y reproductor muestran los tiempos desplazados 1,5 s y marcar en `t` guarda `t − 1500` (pruebas existentes, sin la interfaz) (E8-10).
- [ ] La nota Bluetooth sale con el texto nuevo bajo «Escuchar al ajustar» / «Bloquear enunciado» al salir del modo al ritmo por primera vez (E8-11); `edi.banner.yasync` con el texto nuevo.
- [ ] Ninguna fila muestra ◆ ni el panel «por palabra» (E8-1, parte de interfaz); se retiran `edi.palabras.tooltip` y `edi.palabras.etiqueta` y las demás «Claves retiradas» de la spec que vivan en estos archivos.
- [ ] `edi.toast.palabras` con el texto nuevo (singular y plural) y `edi.toast.palabras.ritmo` al salir del modo al ritmo si alguna línea perdió palabras hechas a mano; sin toasts durante el modo (spec 8.2). Usa `palabrasDescartadas`, que tras 0261 solo trae palabras manuales.
- [ ] `edi.silencios.explicacion` con el texto nuevo (E8-5, parte de interfaz).

## Pruebas de feedback

- Unitarias: `atajos.test.ts` (S, `,`, `.` sin acción), pruebas del panel, del *reducer* y del reproductor afectadas.
- E2E: las specs cambiadas, con `npm run test:e2e:cambios` tras `npm run build`.
- Críticos: sí (editor del flujo principal).
- Manual: guía de la fase 8 — S, `,` y `.` no hacen nada; la nota Bluetooth se entiende.

## Notas de implementación
