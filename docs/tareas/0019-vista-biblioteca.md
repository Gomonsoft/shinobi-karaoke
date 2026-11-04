# 0019 — Vista Biblioteca: estado vacío, carga y tarjetas de borrador, lista y dañada
- Estado: Pendiente
- Paso del pipeline: — (raíz) y 5
- Depende de: 0009, 0012, 0017, 0018
- ADRs: 0006
- Spec UX: docs/ux/02-biblioteca.md

## Objetivo
La vista inicial con las canciones reales del directorio de datos, en sus estados estáticos, actualizándose en vivo cuando cambian.

## Criterios de aceptación
- [ ] **Cargando**: 4 tarjetas esqueleto mientras llega `biblioteca.listar()`; si tarda > 3 s, texto "Cargando tu biblioteca…" (criterios de `ux/02` "Estados").
- [ ] **Vacío**: textos `bib.vacia.*`, un único botón primario grande "Añadir canción" (que abre el marcador de la vista 03) y el de la barra superior oculto (criterio 8).
- [ ] **Rejilla**: `repeat(auto-fill, minmax(240px, 1fr))`, separación 24 px; orden `modificada` descendente; las tarjetas no se reordenan con cambios en vivo hasta volver a entrar en la vista (criterios 1 y 5).
- [ ] **Tarjeta** según la anatomía de `ux/02`: portada 16:9 con el **fondo del estilo** de la canción (sólido o `linear-gradient`), el título en **su fuente y color de letra** (0017) o, si es de YouTube sin estilo modificado, la miniatura vía `shinobi-media://` con velo; título (1 línea con elipsis), artista · duración (m:ss), insignia y menú ⋯ (el menú se completa en 0020).
- [ ] **Lista**: insignia "✓ Lista", botón "▶ Reproducir" y botón redondo de 48 px en la portada al pasar el ratón o enfocar; ambos abren el marcador del reproductor con el id.
- [ ] **Lista incompleta** (indicador derivado `estaIncompleta`, 0006) según `ux/02` §"Lista incompleta" y criterio 2b: insignia "✓ Lista" y "▶ Reproducir" sin cambios, sin botón extra; además, línea informativa `bib.lista.incompleta` con **icono ⚠ + color `aviso`** (no solo color), en singular con n = 1 ("⚠ Falta 1 línea por sincronizar"); las pausas no cuentan en n. Sigue contando en el filtro *Listas* (0020). Al sincronizar todas las líneas, la línea desaparece en vivo.
- [ ] **Borrador**: insignia "✎ Borrador", línea de paso según la tabla de `ux/02` para los casos sin trabajo activo (Falta la letra · `bib.paso.sincronia` "Faltan {n} líneas por sincronizar", en singular con n = 1 "Falta 1 línea por sincronizar" y sin contar pausas · Lista para revisar · ✕ {título del error} · ⚠ Interrumpido) y botón "Continuar" que navega con `vistaAlContinuar` (0006). "Reintentar" se muestra en error/interrumpido; hasta que existan los trabajos reales (fases 2–3) navega como "Continuar". Las líneas de trabajos activos (descargando, separando, en cola) se completan en la Fase 3.
- [ ] **Dañada**: portada `fondo-2` con icono de alerta, insignia "✕ Dañada", línea `bib.danada.json` o `bib.danada.pistas`; clic en la portada abre su menú ⋯.
- [ ] Clic en la portada / Intro: Lista → reproductor; Borrador → Continuar; Dañada → menú.
- [ ] Actualización en vivo con `alCambiarCancion` sin perder el foco.
- [ ] Cada tarjeta expone `bib.aria.tarjeta` a lectores de pantalla (criterio 14).
- [ ] Tests de componente de la línea de aviso/paso con n = 0, 1 y 2 (y con pausas, que no cuentan).
- [ ] Prueba E2E con la semilla de 0009: se ven las canciones esperadas con su insignia (incluida la lista incompleta con su aviso); con la biblioteca vacía se ve el estado vacío.

## Notas de implementación
(las rellena el programador al terminar)
