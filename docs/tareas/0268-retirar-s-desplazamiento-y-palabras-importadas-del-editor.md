# 0268 — Retirar del editor el atajo S, el desplazamiento de toda la letra y las marcas de palabras importadas

- Estado: Hecha
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

- [x] **S** no hace nada en el editor (lista, línea de tiempo, panel, transporte); el botón dice `edi.boton.sync` sin «(S)»; `edi.banner.sinsync` sin la tecla; el diálogo de atajos es la tabla «Atajos de teclado en 0.2.1» sin S, `,` ni `.` (E8-6). (P y Mayús + L de la tabla los añaden 0269 y 0279.)
- [x] Sin sección de desplazamiento en el panel; `,` y `.` no hacen nada en el editor ni en «Probar a pantalla completa»; sin indicador `rep.offset`; la prueba no crea pasos de deshacer (E8-10, R8-2). Se retiran las acciones `desplazar` y `fijar_desplazamiento` del *reducer* y el `limite` de tipo `desplazamiento`.
- [x] Con una canción de prueba con `offset_ms: 1500`, lista, ticks, regiones, vista previa y reproductor muestran los tiempos desplazados 1,5 s y marcar en `t` guarda `t − 1500` (pruebas existentes, sin la interfaz) (E8-10).
- [x] La nota Bluetooth sale con el texto nuevo bajo «Escuchar al ajustar» / «Bloquear enunciado» al salir del modo al ritmo por primera vez (E8-11); `edi.banner.yasync` con el texto nuevo.
- [x] Ninguna fila muestra ◆ ni el panel «por palabra» (E8-1, parte de interfaz); se retiran `edi.palabras.tooltip` y `edi.palabras.etiqueta` y las demás «Claves retiradas» de la spec que vivan en estos archivos.
- [x] `edi.toast.palabras` con el texto nuevo (singular y plural) y `edi.toast.palabras.ritmo` al salir del modo al ritmo si alguna línea perdió palabras hechas a mano; sin toasts durante el modo (spec 8.2). Usa `palabrasDescartadas`, que tras 0261 solo trae palabras manuales.
- [x] `edi.silencios.explicacion` con el texto nuevo (E8-5, parte de interfaz).

## Pruebas de feedback

- Unitarias: `atajos.test.ts` (S, `,`, `.` sin acción), pruebas del panel, del *reducer* y del reproductor afectadas.
- E2E: las specs cambiadas, con `npm run test:e2e:cambios` tras `npm run build`.
- Críticos: sí (editor del flujo principal).
- Manual: guía de la fase 8 — S, `,` y `.` no hacen nada; la nota Bluetooth se entiende.

## Notas de implementación

- **Qué se hizo**: `atajos.ts` ya no resuelve S, `,` ni `.` (se retira la acción `entrar_sync` del teclado; el botón sigue). Se retiran del *reducer* `desplazar` y `fijar_desplazamiento` (y el import de las funciones de `shared/letras/tiempos`; el tipo `Limite` `desplazamiento` sigue en `shared/` hasta 0271). Panel Sincronía sin la sección de desplazamiento ni «por palabra»; lista sin ◆; el reproductor (`atajos.ts`, `modelo.ts`, `Reproductor.tsx`, `DialogoAtajosReproductor.tsx`, `sesion/PantallaEstadoSesion.tsx`, `textos.ts`) sin `desplazar`, `alDesplazar`, `puedeDesplazar` ni `rep.offset`. La prueba desde el editor ya no crea pasos de deshacer (se quita `Prueba.grupo`). `offset_ms` se sigue aplicando (pruebas con `offset_ms` 250 y 1500). Textos nuevos: `edi.boton.sync` y su tooltip sin «(S)» (`Transporte.tsx`), `edi.banner.sinsync`, `edi.banner.yasync`, `edi.ayuda.bluetooth` (ahora bajo «Bloquear enunciado»), `edi.toast.palabras` (singular y plural, una vez por gesto) y `edi.toast.palabras.ritmo` (un toast al salir del modo al ritmo, comparando la letra de la entrada con la de la salida; sin toasts de palabras durante el modo), `edi.silencios.explicacion`. Se retiran las claves `edi.palabras.*`, `edi.offset.*`, `edi.boton.restablecer`, `edi.menu.borrador`, `edi.menu.aLetraLista`, `edi.menu.aLista` y la variante `edi.silencios.boton` del menú. Diálogo de atajos según la tabla «Atajos de teclado en 0.2.1» (sin P: lo añade 0279).
- **Archivos clave**: `vistas/editor/{atajos,estado,PanelSincronia,ListaLineas,Editor,DialogoAtajos,Transporte,textos,editor.module.css,silencios/textos}`, `vistas/reproductor/*`; pruebas adaptadas: `atajos.test.ts` (editor y reproductor), `estado.test.ts` (las palabras de los casos son `origen_palabras: 'manual'` y la regla de 0261 las descarta), `PanelSincronia.test.tsx`, `Editor.test.tsx`, `Reproductor.estados.test.tsx`, `modelo.test.ts`, `escuchaComprobacion.test.ts` y `useSincronizarAlRitmo.test.ts` (campo `tonoConservado` del lote E).
- **E2E cambiados, sin ejecutar**: `e2e/editor.spec.ts` (entrar al modo por botón; el ajuste fino ya no prueba el desplazamiento; `offset_ms: 500` va en los datos de «fin independiente» y del nuevo caso «los marcadores con offset_ms del archivo…»; el toast de borrador usa `I`), `e2e/editor-layout.spec.ts` (S por botón; sin las comprobaciones del bloque de desplazamiento; la del panel a 300/360/480 px pasa a comprobar que no se desborda), `e2e/reproductor.spec.ts` («,» y «.» sin efecto desde el editor y sin pasos de deshacer).
- **Suite crítica (`qa`)**: `e2e/criticos/flujo-principal.spec.ts` entra al modo con el botón (`/^Sincronizar al ritmo/`) y marca con `E.marcarLista` en borrador: no necesita cambios.
- **Deuda / avisos**: el tipo `Limite` `desplazamiento` y `desplazar`/`fijarDesplazamiento` de `shared/letras/tiempos.ts` los borra 0271. `docs/Test-manuales/0.2.0/fase-5-…md` (fila 14.10) cita el texto antiguo de `edi.silencios.explicacion`: es de la guía de 0.2.0 y no se toca.
- **Manual (guía de la fase 8)**: S, `,` y `.` no hacen nada; la nota Bluetooth se entiende; con una canción de `offset_ms` ≠ 0 la lista y la vista previa siguen desplazadas.
