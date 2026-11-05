# 0088 — E2E: letras sin red con un doble HTTP local de LRCLIB
- Estado: Hecha
- Paso del pipeline: 3
- Depende de: 0082, 0083, 0085, 0086, 0087
- ADRs: 0005 (Revisión 2026-11-05), 0007, 0009 §8
- Spec UX: docs/ux/05-letra.md (criterios 1–13); docs/ux/04-progreso-pipeline.md (criterio 5); docs/ux/02-biblioteca.md (líneas de paso)
- Cuándo: cierra la fase.

## Objetivo
Probar el paso Letra de punta a punta con la app compilada, **sin acceso a Internet**. LRCLIB se sustituye por un servidor HTTP local que levanta la propia prueba (`SHINOBI_LRCLIB_URL`, solo sin empaquetar).

## Criterios de aceptación
- [ ] **Doble** `app/e2e/fixtures/lrclib/servidor.ts`: `http.createServer` en `127.0.0.1:0`, que sirve `/api/get`, `/api/search` y `/api/get/:id` desde las fixtures de 0077, siempre con letras **inventadas**.
  - **Escenarios** por título:
    - con palabra, línea y texto;
    - solo `search`;
    - 404 en todo;
    - instrumental;
    - 429 con `Retry-After: 1` una vez;
    - 429 con `Retry-After: 120`;
    - 500;
    - lento (12 s, para el tiempo agotado).
  - **Registro de peticiones**, para comprobar:
    - la cabecera `User-Agent` exacta y que no hay cookies;
    - que las peticiones van en serie;
    - los parámetros `duration`, `album_name` y `q`.
  - "Sin conexión": `SHINOBI_LRCLIB_URL=http://lrclib.invalid`.
- [ ] **Recorridos** (canciones creadas con la semilla de E2E o importando el WAV de prueba, como en 0046):
  1. **Feliz**:
     1. Importar un archivo.
     2. En Progreso, pulsar "Buscar la letra mientras tanto" con el separador falso (0075) en marcha.
     3. La búsqueda se lanza sola (comprobado en el registro del doble: `duration` correcta).
     4. Se ven tres resultados ordenados palabra > línea > texto, con sus insignias y la comparación de duración.
     5. ↑/↓ cambian la vista previa.
     6. "Usar esta letra" lleva a C con Letra ✓ en el stepper.
     7. En disco, `cancion.json` válido con `origen: lrclib`, `lrclib_id`, palabras y `pasos.letra = completado`, y la separación termina sin perder la letra.
  2. **Editar título y artista + Intro**: busca de nuevo y quedan guardados en `cancion.json` y en la tarjeta.
  3. **Banners**:
     - no encontrada (foco en Título);
     - instrumental;
     - sin conexión;
     - servicio caído (500);
     - 429 largo → servicio no disponible sin una segunda petición;
     - 429 corto → resultados tras la espera;
     - tiempo agotado → banner antes de 11 s.
     En todos, "Pegar" e "Importar" están disponibles.
  4. **Pegar**:
     - texto con estrofas → contador correcto y pausas en `cancion.json`;
     - texto LRC → aviso y tiempos conservados, con la marca final como `fin_ms`.
  5. **Importar** con `SHINOBI_DIALOGO_PRUEBAS`: un `.lrc` mejorado; un `.txt` en Windows-1252; un archivo vacío → `let.error.archivo` sin cambiar la letra.
  6. **Sustituir**: con letra sincronizada, "Usar esta letra" pide confirmación; Cancelar no cambia `cancion.json` y Sustituir sí.
  7. **Edición en C**: cambiar una línea, cambiar solo espacios en otra y borrar una tercera; tras el autoguardado, en `cancion.json` la primera queda sin tiempos y conservan id y tiempos la segunda y las no tocadas. La tarjeta de la Biblioteca muestra "Falta 1 línea por sincronizar".
  8. **Cerrar y relanzar** la app tras editar: la letra sigue igual y "Continuar" abre el Editor (marcador).
  9. **Enlace** "Letra: LRCLIB": llega a `shell.openExternal` sustituido (como en `seguridad.spec.ts`).
- [ ] **Empaquetada**: un test unitario (no E2E) comprueba que con `empaquetada: true` se ignora `SHINOBI_LRCLIB_URL` (0081 ya lo cubre; aquí se enlaza).
- [ ] Se ejecutan en el job E2E de la CI (Linux) en menos de ~90 s en total. Ninguna petición sale a `lrclib.net`: el cliente (0081) registra en `app.log` la URL base que usa al arrancar, y el E2E comprueba que es la del doble.

## Notas de implementación
- **Qué se hizo**: doble HTTP en `app/e2e/fixtures/lrclib/servidor.ts` (`iniciarServidorLrclib()` → `{ url, peticiones, maxSimultaneas, reiniciar, cerrar }`; el escenario sale de una palabra clave del título en `TITULOS`: completa, solo search, inexistente, instrumental, límite corto/largo, servicio roto, lenta). Sirve las fixtures de 0077 con duraciones relativas a la del `get` (igual, +5 s, muy distinta). Reutilizable por 0089 u otros. Recorridos en `app/e2e/letras.spec.ts` (8 tests, ~40 s): feliz (importar con el separador falso, "Buscar la letra mientras tanto", tres resultados ordenados con insignias y duración, ↑/↓, cabeceras sin cookies, turnos en serie, `duration` correcta, `app.log` con la URL base y sin `lrclib.net`, la separación termina sin perder la letra); editar título/artista con Intro (`album_name`, `q` sin artista, tarjeta) y enlace "Letra: LRCLIB" a `shell.openExternal`; banners (no encontrada con foco en Título, instrumental, 500, 429 corto con espera, tiempo agotado antes de 11 s, 429 largo con una sola petición) y `lrclib.invalid` (sin conexión, sin peticiones); pegar (estrofas y LRC con `fin_ms`); importar (`.lrc` mejorado, `.txt` Windows-1252, vacío → `let.error.archivo`); sustituir (Cancelar/Sustituir); edición en C con ids y tiempos, tarjeta "Falta 1 línea por sincronizar" y relanzar → "Continuar" abre el Editor.
- **Empaquetada**: no hay E2E; `main/letras/lrclib.test.ts` (0081, "se ignora si está empaquetada…") y `main/index.ts` (borra la variable) lo cubren.
- **Decisiones**: las canciones salen de la semilla («Borrador sin letra», 215 s) retitulada en `cancion.json`, porque con letra ya elegida «Continuar» abre el Editor (marcador sin stepper) y no hay acceso de vuelta a Letra: los tests de C llegan a ella pegando o eligiendo. En la vista Letra el stepper muestra "paso actual" (●) y el ✓ se comprueba en Progreso (diferencia con `ux/05`: `preguntas/0024`).
- **Fallos de la app**: ninguno.
- **Cómo probarlo**: `npm run build && npx playwright test e2e/letras.spec.ts` (con `SHINOBI_UV` para el import).
- **Deuda**: ninguna.
