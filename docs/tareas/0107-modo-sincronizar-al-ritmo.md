# 0107 — Editor: modo "Sincronizar al ritmo" (Intro, mantener para el fin, Retroceso, cuenta atrás)
- Estado: Hecha
- Paso del pipeline: 4
- Depende de: 0105, 0106
- ADRs: 0010 (§1 "Reloj" y "Pulsaciones"), 0005 (precisión ≤ 20 ms)
- Spec UX: docs/ux/06-editor.md (wireframe E; "Modo Sincronizar al ritmo"; criterios 11–19)
- Archivos: `app/src/renderer/src/vistas/editor/BannerSincronizar.tsx`, `useSincronizarAlRitmo.ts` y sus tests; en `Editor.tsx`, conectar el banner, la tecla S, el botón y el bloqueo de paneles. **No toca archivos compartidos.**
- Paralelizable con: 0108 (con cuidado en `Editor.tsx`) y 0109.

## Contexto para quien implementa
- *Reducer* (0093): `entrar_sync`, `sync_siguiente`, `marcar` (ms guardado), `fin_al_soltar`, `deshacer_marca`, `salir_sync` y `ultimaMarcaDeSesion`. La regla de una marca (demasiado pronto, borrar posteriores) ya está en `marcarInicioLinea` (0092).
- Reloj (0094): `motor.tiempoDeEvento(evento.timeStamp)` da el **tiempo de audio** que sonaba al pulsar (compensa la latencia y la velocidad). Para guardar: `tiempoGuardado(tAudio, letra.offset_ms)`.
- `useAtajosEditor` (0105) escucha en captura; Intro y Retroceso en el modo llegan como acciones.

## Criterios de aceptación
- [x] **Entrar** (S o botón):
  - `entrar_sync` con la selección;
  - cuenta atrás "3 · 2 · 1" de 3 s **en silencio** en la vista previa (`cuentaAtras` de `PantallaLetra`); Esc durante la cuenta atrás la cancela y sale del modo sin marcar;
  - después suena desde `máx(0, tiempo mostrado del elemento anterior con tiempo − 2000)`, o desde 0;
  - anuncio `edi.sync.titulo` + `edi.sync.siguiente`.
- [x] **Banner E**:
  - sustituye a la tercera fila del transporte, con `edi.sync.ayuda`, "Siguiente: «…» · línea n de total" o `edi.sync.fin`;
  - [MARCAR (Intro)] de 44 px como mínimo, que marca en `pointerdown` con el `timeStamp` del evento;
  - [↶ Deshacer (Retroceso)] (`disabled` sin marcas de la pasada), [❚❚ Pausa/Seguir (Espacio)] y [Terminar (Esc)];
  - foco doble (§7).
- [x] **Intro**:
  - `keydown` sin `repeat` → `marcar` con `tiempoGuardado(motor.tiempoDeEvento(e.timeStamp), offset)`;
  - si el motor no suena (`null`), no se marca;
  - "demasiado pronto" → `edi.sync.pronto` en el banner durante 2 s;
  - `keyup` con `e.timeStamp − timeStampDelKeydown ≥ 300` → `fin_al_soltar` con el tiempo del `keyup`; con menos, nada (el fin queda automático).
- [x] **Retroceso**:
  - lee `ultimaMarcaDeSesion` antes de despachar `deshacer_marca`;
  - salta a `máx(0, tiempoMostrado(marca) − 3000)` y sigue sonando;
  - sin marcas no hace nada.
- [x] Espacio pausa o reanuda dentro del modo. Un clic en una fila → `sync_siguiente` y salto como al entrar, sin cuenta atrás. La barra de tiempo, 1/2/3, la velocidad y el volumen siguen funcionando.
- [x] **Perder el foco** de la ventana (`blur`) → pausa, dentro del modo.
- [x] **Esc o Terminar** → `salir_sync` y pausa, y `mostrarAyudaBluetooth()` (0106) la primera vez en la sesión. Al llegar al final de la canción el modo termina solo.
- [x] Durante el modo:
  - la lista resalta "Siguiente" y la sigue;
  - la pestaña y el panel Estilo, el panel C, Supr, I/O/L, ↑/↓ y Alt/Ctrl+flechas no responden (criterio 18);
  - la vista previa reproduce en vivo.
- [x] Marcar actualiza fila, contador, ticks y vista previa en < 100 ms con 1000 líneas (criterio 45). Hay un test de rendimiento del *reducer* + `marcarInicioLinea` con 1000 líneas (< 10 ms por marca en CI).
- [x] Tests con un motor falso que devuelve tiempos deterministas:
  - entrar, cuenta atrás, cancelar con Esc;
  - marcar 3 líneas a 0,5× y a 1× con el mismo punto de audio → mismos ms (criterio 9, apoyado en el test de precisión de 0094);
  - repetición ignorada;
  - mantener ≥ 300 ms fija el fin y < 300 ms no;
  - Retroceso salta a marca − 3 s;
  - demasiado pronto;
  - `blur` pausa;
  - fin de la letra muestra `edi.sync.fin`.

## Verificación
```bash
cd app
npm run lint && npm run typecheck && npm run format:check
npx vitest run src/renderer/src/vistas/editor
```

## Notas de implementación
Se completó el trabajo parcial de Codex (no se rehízo).
- `useSincronizarAlRitmo.ts`: cuenta atrás de 3 s en silencio, arranque desde `máx(0, anterior − 2 s)`, marcar con `motor.tiempoDeEvento` + `tiempoGuardado`, "demasiado pronto" (2 s), fin al soltar (≥ 300 ms), Retroceso (marca − 3 s), clic en fila, `blur` pausa, fin de canción termina el modo, Esc/Terminar pausa y llama a `alSalir` (ayuda Bluetooth).
- `BannerSincronizar.tsx`: banner E con MARCAR en `pointerdown`, Deshacer, Pausa/Seguir y Terminar. `Editor.tsx` conecta banner, S, Esc, bloqueo de la pestaña Estilo y del panel C. `useAtajosEditor.ts` ignora repeticiones de Intro; `estado.ts` fija el fin automático al marcar.
- Tests: `useSincronizarAlRitmo.test.ts` (cuenta atrás/cancelar, 0,5× y 1× iguales, <300 ms, Retroceso sin marcas, motor parado, blur, fin, rendimiento 1000 líneas) y un test en `Editor.test.tsx` (S, banner, Estilo bloqueada, Esc).
- Verificación completa en verde (lint, typecheck, format, Vitest, build, Playwright).
- Deuda: sin E2E específico del modo (lo cubre 0110); la prueba de precisión real es 0111.
