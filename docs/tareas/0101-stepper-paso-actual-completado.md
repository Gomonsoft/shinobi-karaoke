# 0101 — Stepper: ✓ en el paso actual completado y subrayado del paso actual (respuesta a 0024)
- Estado: Hecha
- Paso del pipeline: 3 y 4
- Depende de: — (**puede empezar ya; tarea pequeña**)
- ADRs: —
- Spec UX: docs/ux/00-mapa-de-vistas.md §2 ("Paso actual"); docs/ux/sistema-visual.md §6 ("Lista de pasos (stepper)"); docs/ux/06-editor.md (criterio 2)
- Pregunta: `preguntas/0024` (respondida por el diseñador UX)
- Archivos: `app/src/renderer/src/vistas/cancion/pasos.ts`, `cabecera.module.css`, `CabeceraCancion.tsx` (solo el `aria-label`), `CabeceraCancion.test.tsx` y los tests de `pasos` si los hay; `app/e2e/letras.spec.ts` (expectativas de 0088). **`CabeceraCancion.tsx` lo toca también 0103**: esta va antes.
- Paralelizable con: todas salvo 0103 (que va después).

## Contexto para quien implementa
Hoy `pasos.ts` muestra ● ("paso actual") en Letra cuando se está en la vista Letra aunque ya tenga líneas, y lo mismo en Editor con la canción Lista. Hay dos `if (esActual && …) datos = { indicador: 'actual', detalle: null }`. La UX decide ahora (0024) que el círculo refleja **siempre el estado** del paso y que el paso actual se distingue con la etiqueta.

## Criterios de aceptación
- [x] `pasos.ts`:
  - se quitan los dos `if` de Letra y Editor;
  - ● (`indicador: 'actual'`) solo si el paso actual está pendiente (la regla `indicador === 'pendiente' && actual` que ya existe en `datosDePaso`);
  - Letra con ≥ 1 línea muestra ✓ también estando en la vista Letra, y Editor con la canción Lista muestra ✓ estando en el Editor.
- [x] **Descripción accesible**: cuando `actual` es `true` y el indicador no es `actual`, la descripción añade ", paso actual". Ejemplo: `aria-label` "Paso 3, Letra, completado, paso actual". Con ● se mantiene "paso actual" (sin duplicar).
- [x] `cabecera.module.css`: `.paso[aria-current='step'] .etiqueta` con `color: var(--texto-1)`, `font-weight: 600` y subrayado de 2 px `var(--acento-texto)` (`text-decoration-thickness: 2px; text-underline-offset: 4px`, o un borde inferior), visible con cualquier indicador.
- [x] Tests unitarios de `pasosDeCancion`: Letra actual con letra → `completado` + actual; Editor actual en Lista → `completado` + actual; Editor actual en borrador → `actual`.
- [x] E2E de 0088 (`e2e/letras.spec.ts`): donde se comprobaba ● en la vista C, ahora se comprueba ✓ con `aria-current="step"` (busca por `aria-label` que contenga "completado, paso actual").

## Verificación
```bash
cd app
npm run lint && npm run typecheck && npm run format:check
npx vitest run src/renderer/src/vistas/cancion
export SHINOBI_UV=$(which uv)
npm run build && npx playwright test e2e/letras.spec.ts
```

## Notas de implementación

- Letra y Editor conservan su indicador de estado cuando son el paso actual. La etiqueta se subraya y la descripción accesible anuncia el estado y el paso actual.
- Pasaron los tests de la cabecera y los E2E de Letra, además de la verificación completa conjunta de 0100–0102.
