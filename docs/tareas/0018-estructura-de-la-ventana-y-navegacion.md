# 0018 — Estructura de la ventana, navegación entre vistas y atajos globales
- Estado: Hecha
- Paso del pipeline: —
- Depende de: 0011, 0016
- ADRs: 0007
- Spec UX: docs/ux/00-mapa-de-vistas.md §2, §3 y §6; docs/ux/sistema-visual.md §7

## Objetivo
El marco común de la app (barra superior, área de contenido, toasts) y la navegación propia entre vistas, con marcadores de posición para las vistas de fases posteriores.

## Criterios de aceptación
- [x] Barra superior fija de 56 px (`role="banner"`) con el logotipo-botón "Shinobi Karaoke" (lleva a la Biblioteca), zona de contexto vacía, botón ⚙ (Ajustes) y botón primario "+ Añadir canción" visible **solo** en la Biblioteca (y oculto en su estado vacío, según `ux/02`). Sin barra en las vistas que la spec excluye (primer arranque, reproductor).
- [x] Navegación por estado propio (ADR 0007): `biblioteca`, `anadir`, `cancion` (`{id, paso}`), `ajustes`, `reproductor` (`{id}`), `primer-arranque`. Las vistas de fases posteriores son marcadores de posición con su título y "‹ Biblioteca".
- [x] Arranque: si `config.instalacion.estado !== "completa"` se muestra el marcador "Primer arranque" (la vista real llega en la Fase 2); si no, la Biblioteca.
- [x] Atajos globales de `ux/00` §6: Ctrl/Cmd+N (Añadir), Ctrl/Cmd+, (Ajustes), Esc (cierra diálogo/menú o vuelve a la Biblioteca desde las vistas del espacio de canción), Ctrl/Cmd + + / − / 0 (zoom de la interfaz con `webFrame`/menú de Electron). Los atajos de una tecla no se disparan con el foco en un campo de texto.
- [x] Menú de aplicación nativo mínimo (necesario en macOS para copiar/pegar y salir) con los mismos atajos.
- [x] *Landmarks* (`banner`, `main`) y enlace "Saltar al contenido"; al cambiar de vista el foco va al primer elemento lógico de la vista (o a su título).
- [x] Gestor de toasts global montado en la raíz.
- [x] Prueba E2E: Ctrl/Cmd+, abre el marcador de Ajustes y Esc vuelve a la Biblioteca.

## Notas de implementación
- **Qué se hizo**: marco de la ventana (`Marco`: enlace "Saltar al contenido", barra `banner` de 56 px con logotipo-botón, ⚙ y "+ Añadir canción" solo en la Biblioteca con canciones, `main` enfocable) y navegación por estado propio (`navegacion/estado.ts`: `Vista` = `biblioteca | anadir | cancion{id,paso} | ajustes | reproductor{id} | primer-arranque`, contexto `useNavegacion`). `App` lee `config.instalacion.estado` y arranca en Primer arranque o Biblioteca; las vistas de fases posteriores son `Marcador` (título + "‹ Biblioteca"); la Biblioteca provisional incluye su estado vacío (botón grande; el de la barra se oculta). Al cambiar de vista el foco va al `h1`/`[data-foco-inicial]`. Atajos en `navegacion/useAtajosGlobales.ts`: Ctrl/Cmd+N (Biblioteca y espacio de canción), Ctrl/Cmd+, (todas salvo primer arranque y reproductor), Esc (vuelve a la Biblioteca desde añadir/canción/ajustes/reproductor; no actúa con foco en un campo de texto ni con diálogo/menú abierto). Menú nativo en `main/menu.ts` (Archivo con los dos atajos, Edición, Ver con zoom por roles de Electron: Ctrl/Cmd + `+`/`=`/`-`/`0`; en macOS, menú de la app con Salir).
- **Cambio en el contrato IPC (mínimo)**: nuevo evento `evento:menu` y `ApiShinobi.alAccionMenu(cb)` (`'anadir' | 'ajustes'`) para que los items del menú (que consumen el atajo en macOS) lleguen al renderer; tocado `shared/canales.ts`, `shared/ipc.ts`, `preload/index.ts`, `main/index.ts` y la lista de claves de `e2e/ipc.spec.ts`.
- **Cómo probarlo** (desde `app/`): `npx vitest run src/renderer/src/App.test.tsx src/main/menu.test.ts` (atajos, foco, landmarks, arranque, barra, toasts, menú); `npm run build && npx playwright test e2e/navegacion.spec.ts` (E2E: Ctrl/Cmd+, abre Ajustes, Esc vuelve; barra de 56 px; menú con Añadir/Ajustes/Acercar/Alejar); `npm run dev` para verlo.
- **Decisiones / datos de trabajos**: el indicador de actividad (`⟳ n en curso`) NO está: depende del gestor de trabajos (0014) y queda como hueco en la barra (zona de contexto y acciones vacías). La zona de contexto queda vacía (el stepper llega con 0019+). Esc también sale de Ajustes (spec 08) y del reproductor marcador (la salida real al Editor llegará con su vista). El estado "Primer arranque" marcador incluye un botón "Ir a la Biblioteca" provisional para no dejar la app atascada hasta la Fase 2. Ante un error leyendo la config se arranca en Primer arranque (opción conservadora).
- **Deuda técnica**: la Biblioteca muestra brevemente el título normal hasta que `listar()` responde (luego el estado vacío si procede); el zoom no se prueba en E2E (solo la presencia de los items); no hay prueba visual de la altura 56 px en jsdom (la cubre el E2E); sin persistencia del nivel de zoom.
