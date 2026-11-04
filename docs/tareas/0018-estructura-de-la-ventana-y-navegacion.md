# 0018 — Estructura de la ventana, navegación entre vistas y atajos globales
- Estado: Pendiente
- Paso del pipeline: —
- Depende de: 0011, 0016
- ADRs: 0007
- Spec UX: docs/ux/00-mapa-de-vistas.md §2, §3 y §6; docs/ux/sistema-visual.md §7

## Objetivo
El marco común de la app (barra superior, área de contenido, toasts) y la navegación propia entre vistas, con marcadores de posición para las vistas de fases posteriores.

## Criterios de aceptación
- [ ] Barra superior fija de 56 px (`role="banner"`) con el logotipo-botón "Shinobi Karaoke" (lleva a la Biblioteca), zona de contexto vacía, botón ⚙ (Ajustes) y botón primario "+ Añadir canción" visible **solo** en la Biblioteca (y oculto en su estado vacío, según `ux/02`). Sin barra en las vistas que la spec excluye (primer arranque, reproductor).
- [ ] Navegación por estado propio (ADR 0007): `biblioteca`, `anadir`, `cancion` (`{id, paso}`), `ajustes`, `reproductor` (`{id}`), `primer-arranque`. Las vistas de fases posteriores son marcadores de posición con su título y "‹ Biblioteca".
- [ ] Arranque: si `config.instalacion.estado !== "completa"` se muestra el marcador "Primer arranque" (la vista real llega en la Fase 2); si no, la Biblioteca.
- [ ] Atajos globales de `ux/00` §6: Ctrl/Cmd+N (Añadir), Ctrl/Cmd+, (Ajustes), Esc (cierra diálogo/menú o vuelve a la Biblioteca desde las vistas del espacio de canción), Ctrl/Cmd + + / − / 0 (zoom de la interfaz con `webFrame`/menú de Electron). Los atajos de una tecla no se disparan con el foco en un campo de texto.
- [ ] Menú de aplicación nativo mínimo (necesario en macOS para copiar/pegar y salir) con los mismos atajos.
- [ ] *Landmarks* (`banner`, `main`) y enlace "Saltar al contenido"; al cambiar de vista el foco va al primer elemento lógico de la vista (o a su título).
- [ ] Gestor de toasts global montado en la raíz.
- [ ] Prueba E2E: Ctrl/Cmd+, abre el marcador de Ajustes y Esc vuelve a la Biblioteca.

## Notas de implementación
(las rellena el programador al terminar)
