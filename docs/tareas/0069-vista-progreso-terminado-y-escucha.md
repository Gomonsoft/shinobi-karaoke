# 0069 — Vista de progreso: separación terminada, duración real y escucha de voz e instrumental
- Estado: Hecha
- Paso del pipeline: 2
- Depende de: 0068; 0012/0022 (Hechas: `shinobi-media://` ya sirve `pistas/voz.flac` e `instrumental.flac`)
- ADRs: 0004, 0008 (CSP `media-src shinobi-media:`)
- Spec UX: docs/ux/04-progreso-pipeline.md §1 (wireframe "Terminado", "Escuchar Voz / Instrumental", criterio 9), docs/ux/sistema-visual.md
- Cuándo: en paralelo con 0070, 0071 y 0072

## Objetivo
Cuando la separación termina y la vista sigue abierta, mostrar cuánto tardó y dejar escuchar el resultado antes de seguir.

## Criterios de aceptación
- [x] ✓ "Separar voz e instrumental" con la **duración real** a la derecha ("1 min 48 s"). Se toma de `segundos_total` del resultado; si la vista se abre más tarde, del resultado guardado o, si no hay, sin dato. Si hace falta guardarla, se añade un campo opcional en `pasos.separacion` con su migración tolerante (ADR 0006), anotado en las notas.
- [x] `prog.escuchar` con dos botones [▶ Voz] [▶ Instrumental]: reproductor mínimo en línea (▶/❚❚ + barra de posición accesible, `<audio>` con `shinobi-media://<id>/pistas/<pista>.flac`).
  - Solo suena una pista a la vez: al pulsar una se pausa la otra.
  - Al salir de la vista se para.
  - Si el archivo no se puede cargar (pistas borradas) → mensaje en línea y la canción se trata como dañada (el resumen ya lo detecta al reescanear).
- [x] Primario: "Buscar la letra" (`prog.boton.letra.fin`), o "Ir al editor" si ya hay letra. Foco inicial en él. Sin "Cancelar".
- [x] Anuncio `aria-live` "Terminado" (criterio 14).
- [x] Teclado: los botones de escucha son alcanzables con Tab; Espacio reproduce y pausa; la barra de posición se mueve con las flechas.
- [x] Tests de componente: terminado con duración, sin duración, una pista suena y la otra se pausa al pulsarla, parada al desmontar, error de carga, primario según haya letra.

## Notas de implementación
- **Duración persistida**: nuevo campo opcional `segundos` en `pasos.separacion` (`pasoSchema` en `shared/cancion.ts`, tolerante: las canciones antiguas sin campo siguen validando; sin migración de versión) y en `pasoResumenSchema` del IPC. `ServicioSeparacion.alResultado` lo escribe con `segundos_total`; `GestorTrabajos.pasoCambio` lo fusiona en el paso `completado` y lo pone a `null` en los demás cambios de `separacion` (al reempezar se borra).
- **Modelo** (`vistas/progreso/modelo.ts`): bloque `terminado` (con `editor` si hay letra), `formatearDuracion`, dato en la fila "Separar voz e instrumental"; el anuncio al completarse la separación es "Terminado".
- **Escucha** (`vistas/progreso/Escucha.tsx`): un `<audio src="shinobi-media://<id>/pistas/<pista>.flac">` por pista con ▶/❚❚ y `input range` (flechas); solo una suena a la vez, se pausan al desmontar y un error de carga muestra un mensaje en línea (`role="alert"`).
- **Deuda**: no existe un canal de reescaneo en el IPC, así que el error de carga solo avisa en línea; que la canción pase a dañada depende de que el resumen se recalcule al reescanear (no se fuerza desde la vista). Sin pruebas de reproducción real (jsdom no la implementa; se simulan `play`/`pause`).
- Probar: `npm test`, `npm run lint`, `npm run typecheck`, `npm run test:e2e`.
