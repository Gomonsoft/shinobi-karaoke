# 0115 — Semilla: canciones del reproductor (20 y 21) y nombre de la canción 18
- Estado: Hecha
- Paso del pipeline: 6
- Depende de: — (empieza ya)
- ADRs: 0011, 0010 (semilla del editor, 0095)
- Spec UX: docs/ux/07-reproductor.md (silencio previo, `●●●`, lista incompleta)
- Preguntas: 0029 (respondida: renombrar la 18), 0028 (recuento de la semilla)
- Archivos: `app/src/main/biblioteca/semilla.ts`, `app/src/main/biblioteca/semilla.test.ts`, **compartido** `app/e2e/editor.spec.ts` (solo la constante `T18`).
- Paralelizable con: todas. Antes de 0123.

## Contexto para quien implementa
- `plan()` en `semilla.ts` devuelve las canciones de desarrollo (`npm run semilla`) con ids fijos `5eed0000-0000-4000-8000-0000000000NN`. Las del editor (17–19) usan el ayudante `editor(n, cancion, titulo, audio)`, que fija `duracion_ms = 30_000`. El audio se escribe como `fuente/mezcla.flac` y, si hay pistas, también como `pistas/voz.flac` y `pistas/instrumental.flac`. Generadores en `biblioteca/flac.ts`: `silencioFlacSegundos(s)` y `pulsosFlac({ segundos, periodoMs, desfaseMs })`.
- Ayudantes de letra: `letra(lineas)`, `linea(id, texto, inicio_ms)`, `pausa(id)` de `shared/__fixtures__`. `FIXTURES.lista()` es una canción Lista con pistas.
- Letras **inventadas** (ADR 0005: nada con copyright).

## Objetivo
Tener canciones de 30 s pensadas para el reproductor (manual y E2E), y que el nombre de la 18 diga lo que se ve al abrirla.

## Criterios de aceptación
- [ ] **20 «Reproductor: lista»** (artista «Shinobi Pruebas»), estado `lista`, con pistas y audio `pulsosFlac({ segundos: 30, periodoMs: 2000, desfaseMs: 2000 })`, estilo con degradado y una fuente distinta de la predeterminada. Letra (inicio en ms):
  - `r1` 2000 «Primera luz sobre el tejado» (**t1 < 6 s**: provoca un silencio previo de 4 s);
  - `r2` 5000 «Suben las barcas al puerto», con **tiempos de palabra** (5 palabras repartidas entre 5000 y 7500);
  - `r3` 8000 «Nadie sabe la canción»;
  - pausa `rp` (hueco: la siguiente línea va tras ≥ 4 s desde el fin efectivo de `r3`);
  - `r4` 16000 «Vuelve el coro a la plaza»;
  - `r5` 19000 «Y la noche se despierta»;
  - `r6` 22000 «Fin de la prueba».
  Asegura con `fin_ms` (o con la pausa) que el hueco entre `r3` y `r4` es ≥ 4 s y que entre `r4`–`r5` es < 4 s.
- [ ] **21 «Reproductor: lista incompleta»**, estado `lista`, con pistas, audio `silencioFlacSegundos(30)`. Líneas a 8000, 11000, **sin inicio**, 17000 y 20000 (una sin sincronizar → `incompleta`, `lineasSinSincronizar = 1`). t1 = 8 s, así que hay pantalla de título sin silencio previo.
- [ ] **18** pasa a llamarse **«Editor: separación interrumpida»** (pregunta 0029). Actualiza `semilla.test.ts` y `const T18` en `e2e/editor.spec.ts`. No cambia nada más de la 18.
- [ ] `semilla.test.ts`: la tabla de canciones incluye la 20 y la 21 (título, si tiene pistas, número de líneas) y el recuento total sube en 2. Comprueba con los derivados de `shared/derivados.ts` que la 21 es `incompleta` y la 20 no.
- [ ] `npm run semilla` sobre una carpeta vacía crea las 21 canciones. Sobre una ya sembrada, crea solo las nuevas (es idempotente por carpeta).

## Verificación
```bash
cd app
npm run lint && npm run typecheck && npm run format:check && npm test
npm run build && export SHINOBI_UV="$(which uv)" && npx playwright test e2e/editor.spec.ts
```

## Notas de implementación

- `semilla.ts` añade los ids 20 y 21 con audio generado de 30 s. La 20 tiene tiempos de palabra, una pausa con un hueco de 4 s y un estilo con degradado. La 21 tiene una línea sin inicio.
- La semilla nueva usa «Editor: separación interrumpida» para la 18. Una nueva ejecución sobre datos existentes añade solo las canciones que faltan y conserva las carpetas ya creadas.
- Se actualizaron las aserciones de recuento de Biblioteca y la constante `T18` del E2E del editor. Son 20 carpetas con los dos nuevos ids y el hueco del 9, según la decisión de la 0028. La discrepancia con el criterio de 21 queda en la [pregunta 0033](../preguntas/0033-total-de-canciones-de-la-semilla-del-reproductor.md).
- Verificado con los 3 tests de `semilla.test.ts` y dos ejecuciones de `npm run semilla` en una carpeta temporal. La primera creó 20 carpetas y la segunda reutilizó las 20. Pendiente la verificación completa de la app.
