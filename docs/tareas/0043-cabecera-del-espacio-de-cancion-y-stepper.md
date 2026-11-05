# 0043 — Cabecera del espacio de canción con stepper
- Estado: Hecha
- Paso del pipeline: 1–4 (común)
- Depende de: 0016, 0018, 0019
- ADRs: 0006 (paso actual derivado)
- Spec UX: docs/ux/00-mapa-de-vistas.md §2 ("Espacio de canción", reglas del stepper) y §3 ("Continuar" de un borrador)

## Objetivo
La cabecera compartida por las vistas 3–6 (hoy la zona de contexto de la barra está vacía, 0018): "‹ Biblioteca", título · artista (o "Nueva canción"), estado de guardado y stepper de 4 pasos con sus reglas de navegación. La necesitan Añadir canción y Progreso en esta fase.

## Criterios de aceptación
- [x] Componente `CabeceraCancion` con dos modos: **nueva** ("Nueva canción", paso 1 actual, resto no navegables) y **canción existente** (`«Título» · Artista`, "✎ Borrador · guardado ✓" o "✓ Lista").
- [x] Stepper (1 Fuente, 2 Separación, 3 Letra, 4 Editor) con los indicadores de `ux/00` §2 (✓ ⟳ % "En cola" ✕ ⚠ ● ○) calculados con funciones puras a partir del `ResumenCancion`/`Cancion` y del trabajo vivo (`useTrabajosVivos`, 0020), y las reglas de "navegable cuando"; los pasos no navegables tienen `aria-disabled` y tooltip con el motivo (provisional para los que la spec no da: "Primero añade el audio", "Primero elige una letra").
- [x] Navegar por el stepper usa `ir({ tipo: 'cancion', id, paso })`; las vistas de Letra y Editor siguen siendo marcadores.
- [x] Accesible: `nav` con `aria-label="Pasos de la canción"`, paso actual con `aria-current="step"`, navegable con Tab.
- [x] Tests de componente: indicadores para cada combinación de pasos relevante (fuente en curso/error/interrumpida; separación en cola/en curso con %; letra con líneas), navegabilidad y tooltips, modo nueva.

## Notas de implementación
- Qué se hizo: `CabeceraCancion` (props `resumen: ResumenCancionIpc | null`, `actual: PasoCancion`; `null` = modo "Nueva canción"), con "‹ Biblioteca", título · artista, insignia "Borrador · guardado ✓" / "Lista" y stepper (`nav` + `ol` de botones, `aria-current="step"`, `aria-disabled` + tooltip con el motivo, nombre accesible "Paso N, Etiqueta, estado"). Lee `useTrabajosVivos` para el trabajo vivo (porcentaje, "En cola").
- Archivos: `app/src/renderer/src/vistas/cancion/` (`pasos.ts` funciones puras `pasosDeCancion`/`pasosDeNueva`, `CabeceraCancion.tsx`, `cabecera.module.css`, `CabeceraCancion.test.tsx`).
- Decisiones: "tiene letra" = `pasos.letra.estado === 'completado'` (el resumen no trae el nº de líneas). La cabecera NO se monta aún en `Marco` ni en `App.tsx`: la usarán las vistas 0044 (Añadir) y 0045 (Progreso) arriba del contenido (la spec la dibuja en el contenido, no en la barra). Motivos provisionales: "Primero añade el audio" (pasos 2–4 sin fuente) y "Primero elige una letra". Un paso en cola se muestra con ○ + "En cola". El paso actual se marca con ● aunque ya esté completado.
- Probar: `npx vitest run src/renderer/src/vistas/cancion`.
- Deuda: el tooltip de un paso bloqueado se muestra con foco/ratón/clic; sin barra de conexión entre pasos (──── del boceto).
