# 0052 — Semilla con miniaturas y E2E de la miniatura vía `shinobi-media://`
- Estado: Hecha
- Paso del pipeline: 1 (y biblioteca)
- Depende de: 0009, 0012, 0019, 0022
- ADRs: 0003 (revisión 2026-11-04: miniatura JPEG), 0006, 0008
- Spec UX: docs/ux/02-biblioteca.md (criterio 15: portada con miniatura y velo)

## Objetivo
Saldar la deuda de la Fase 1 "semilla (0009) sin miniaturas" y comprobar en la app real que la portada de una canción de YouTube se sirve por el protocolo de medios.

## Criterios de aceptación
- [x] `npm run semilla` crea al menos 2 canciones `fuente.tipo = "youtube"` con `fuente/miniatura.jpg` y `fuente.miniatura` en `cancion.json`. Las miniaturas son imágenes propias generadas (degradado + texto o formas; sin fotos ni logotipos de terceros), JPEG de 320 × 180, versionadas en `app/scripts/fixtures/` (o generadas en el script sin dependencias nuevas). Anotar su origen en este archivo.
- [x] Una canción de YouTube de la semilla con el estilo modificado (no usa la miniatura como portada) para cubrir las dos ramas del criterio 15 de `ux/02`.
- [x] E2E (`e2e/medios.spec.ts` o nuevo): la tarjeta de una canción de YouTube muestra una `<img>` con `src` `shinobi-media://<id>/fuente/miniatura.jpg` que carga (`naturalWidth > 0`); una canción sin miniatura no tiene `<img>`; pedir `fuente/miniatura.png` da 404.
- [x] Puede hacerse en paralelo con todo el bloque de YouTube.

## Notas de implementación
- Miniaturas: `app/scripts/fixtures/miniatura-a.jpg` y `miniatura-b.jpg` (JPEG 320 x 180, degradado + formas), generadas con `app/scripts/fixtures/generar-miniaturas.mjs` (PNG propio por zlib y conversión con `sips`, solo macOS; sin dependencias nuevas). Origen: 100 % generadas, sin imágenes de terceros.
- Semilla (`app/src/main/biblioteca/semilla.ts`): +2 canciones de YouTube (ids ...0012 "Desde YouTube con portada", estilo predeterminado, y ...0013 "Desde YouTube con estilo propio"), ambas borradores con `fuente/miniatura.jpg`. Total 12 (antes 10); la semilla lee los JPEG de `process.cwd()/scripts/fixtures` (se ejecuta desde `app/`).
- Tests: `semilla.test.ts` ampliado; los recuentos de tarjetas de los E2E de biblioteca pasan de 10 a 12 (Todas 12, 7 borradores).
- E2E nuevo en `e2e/medios.spec.ts`. Desviación: la tarjeta NO usa `<img>` sino `background` CSS con la URL `shinobi-media://` en el `style` de la portada; el E2E comprueba esa URL, que carga (320 x 180 con `Image`), que las otras dos tarjetas no la usan, que no hay `<img>` en tarjetas y que `miniatura.png` da 404.
- Observación: React serializa `background: url(...)` (atajo), que sustituye al degradado; no afecta a lo visible.
- Probar: `npm run semilla -- --limpiar`, `npm test`, `npm run test:e2e`.
