# 0020 — Biblioteca: filtros, búsqueda, menú ⋯, diálogos y teclado
- Estado: Pendiente
- Paso del pipeline: — (raíz) y 5
- Depende de: 0010, 0019
- ADRs: 0006
- Spec UX: docs/ux/02-biblioteca.md

## Objetivo
Completar la interacción de la Biblioteca: encontrar canciones y gestionarlas desde la tarjeta.

## Criterios de aceptación
- [ ] **Filtros** Todas / Listas / Borradores (control segmentado con recuento); persisten durante la sesión. El filtro *Listas* y su recuento incluyen las listas **incompletas** (el filtro se basa en `estado: "lista"`, no en `estaIncompleta`; `ux/02` §"Lista incompleta"). Mensajes `bib.sinresultados` y `bib.sinlistas` con "Borrar búsqueda" (criterio 10).
- [ ] **Búsqueda** en vivo por título y artista sin distinguir mayúsculas ni tildes ("cancion" encuentra "Canción"); Ctrl/Cmd+F enfoca, Esc vacía.
- [ ] **Menú ⋯** con las opciones por estado de `ux/02` (Lista: Reproducir, Editar, Editar datos, Volver a borrador, Mostrar en la carpeta, Eliminar…; Borrador: Continuar, Editar datos, Mostrar en la carpeta, Eliminar… — "Cancelar trabajo" aparece solo con trabajos, conectado en la Fase 3; Dañada: Mostrar en la carpeta, Eliminar… — "Re-separar pistas" llega en la Fase 3). Se abre con clic, tecla Menú o Mayús+F10.
- [ ] **Editar datos**: diálogo con Título (obligatorio, "Escribe un título."), Artista, Álbum (máx. 200 caracteres, recortando espacios); guarda con `biblioteca.actualizarMetadatos`.
- [ ] **Volver a borrador** y **Eliminar…** con los diálogos y textos exactos de `ux/02`; tras eliminar, toast `bib.toast.eliminada` (criterios 11 y 12). Si la papelera falla, toast de error con "Copiar detalles".
- [ ] **Teclado** de la rejilla: un único punto de tabulación con *roving tabindex*; flechas entre tarjetas; Intro = acción de la portada; Espacio = acción principal visible; tecla Menú = ⋯; Supr = Eliminar… (criterio 13).
- [ ] **Arrastrar un archivo** de audio/vídeo sobre la ventana abre el marcador de la vista 03 recordando la ruta (criterio 9; la importación real llega en la Fase 2).
- [ ] Tests de componente para búsqueda sin tildes, filtros (una lista incompleta aparece en *Listas* y cuenta en su recuento) y navegación con flechas; E2E: volver a borrador y eliminar una canción de la semilla (comprobando que la carpeta ya no está en `biblioteca/`).

## Notas de implementación
(las rellena el programador al terminar)
