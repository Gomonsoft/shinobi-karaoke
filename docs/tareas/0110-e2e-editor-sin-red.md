# 0110 — E2E del editor sin red (semilla con audio de 30 s, audio de Chromium silenciado)
- Estado: Hecha
- Paso del pipeline: 4 y 5
- Depende de: 0091, 0095, 0101, 0102, 0105–0109
- ADRs: 0010 (§1 "Pruebas"), 0009 §8 (dobles y variables `SHINOBI_*` solo sin empaquetar)
- Spec UX: docs/ux/06-editor.md (criterios de la fase); docs/ux/02-biblioteca.md (vuelta desde el editor)
- Archivos: crea `app/e2e/editor.spec.ts` y, si hace falta, `app/e2e/fixtures/editor.ts`. **No toca código de producción**: si algo falla por un fallo de la app, se corrige en la tarea correspondiente o se anota aquí.
- Paralelizable con: 0111. **Cierra la fase.**

## Contexto para quien implementa
- Patrón de los E2E existentes (léelos): `e2e/letras.spec.ts` (siembra con `sembrar(datos)` de `src/main/biblioteca/semilla.ts` en un directorio de `crearTemporal`, lanza `_electron` con `SHINOBI_DATOS`) y `e2e/separacion.spec.ts` (separador falso).
- Semilla (0095), canciones de 30 s:
  - 17 «Editor: pista de clics», letra sin tiempos y pistas;
  - 18 «Editor: separando»;
  - 19 «Editor: lista incompleta».
- Total de la semilla (pregunta 0028): **18 entradas**, porque no existe el id 9 y las ids 10 (sin pistas) y 11 (JSON inválido) están dañadas a propósito. Si una prueba cuenta tarjetas, espera 18 (17 si una se ha borrado, etc.). Tras marcar como lista la 17 en *Borradores*, el recuento del filtro baja en 1. No se rellena el id 9. Si `fixtures/editor.ts` necesita canciones nuevas, se crean en el directorio temporal de la prueba y no se añaden a la semilla compartida. Si hubiera que añadirlas a la semilla, usarían ids desde el 20 y habría que actualizar los recuentos de los E2E de Biblioteca.
- Audio: lánzalo con `SHINOBI_SILENCIAR_AUDIO=1` (0094). Chromium usa una salida falsa si no hay dispositivo, y el reloj avanza igual. **No se comprueba la precisión en ms** (eso es 0094 y 0111): solo orden, rangos amplios y persistencia.
- Leer `cancion.json` del disco al final de cada prueba (`<datos>/biblioteca/<id>/cancion.json`) para comprobar lo guardado.

## Criterios de aceptación
- [ ] **Sincronizar en una pasada** (canción 17):
  - abrir con Continuar → editor con el foco en "Sincronizar al ritmo" y el banner `edi.banner.sinsync`;
  - S → cuenta atrás → pulsar Intro 12 veces separadas ~1 s con `page.keyboard.press('Enter')`;
  - el contador llega a "12/12 sincronizadas ✓";
  - Esc;
  - en `cancion.json` (≤ 3 s después): 12 inicios estrictamente crecientes, todos < 30000, y la pausa sin tiempo.
- [ ] **Mantener para el fin**: en una línea, `keyboard.down('Enter')`, esperar 600 ms y `up` → esa línea tiene `fin_ms` no nulo en disco.
- [ ] **Retroceso** en el modo deshace la última marca (el contador baja en 1).
- [ ] **Ajuste fino y límites**:
  - seleccionar una línea, Alt+→ ×3 → inicio +30 ms en disco;
  - forzar el límite contra la siguiente → tooltip `edi.limite.siguiente` visible;
  - Ctrl/Cmd+Z deshace y Ctrl/Cmd+Mayús+Z rehace.
- [ ] **Desplazamiento**: `.` ×3 → `offset_ms: 300` en disco; "Restablecer" → 0.
- [ ] **Estilo**:
  - pasar a sólido, poner la letra `#5A1E6E` → aviso `edi.contraste.letra`; "Usar letra blanca" → "Buen contraste";
  - cambiar la fuente a Bangers;
  - `cancion.json#estilo` refleja lo último.
- [ ] **Marcar como lista** (canción 17 sincronizada):
  - vuelve a la Biblioteca con la tarjeta enfocada, la clase de resalte presente y el toast "«Editor: pista de clics» está lista para cantar.";
  - `estado: "lista"` en disco.
- [ ] **No disponible** (canción 18): Voz e Instrumental inactivos con "Disponible cuando termine la separación (42 %)"; el popover de "Marcar como lista" muestra el motivo de la separación.
- [ ] **Lista incompleta** (canción 19): la insignia dice "Falta 1 línea"; la primera pulsación de "Hecho" abre el popover y [Salir igualmente] vuelve a la Biblioteca.
- [ ] **Borrador guardado**: entrar en un borrador, cambiar algo y salir con ‹ Biblioteca → toast "Borrador guardado."; entrar y salir sin cambios → sin toast.
- [ ] **Corregir la letra** → vista Letra en C con el stepper "Letra" con ✓ y `aria-current="step"` (0024); al volver, las líneas no modificadas conservan su tiempo.
- [ ] **Cerrar la ventana con cambios pendientes**: cambiar un color e inmediatamente cerrar la app (`electronApp.close()` o `ventana.close()`) → al reabrir, el color está guardado.
- [ ] **Texto demasiado largo** en Letra (0102): pegar más de 5000 renglones → `let.pegar.demasiado` y "Usar esta letra" inactivo.
- [ ] El conjunto completo de E2E (fases anteriores incluidas) pasa en los 3 SO de la CI. Si Linux sin dispositivo de audio no avanzara el reloj, se documenta en las notas y se añade a la CI un *sink* nulo de PulseAudio (`pactl load-module module-null-sink`) en el *workflow*, avisando al arquitecto con una pregunta.

## Verificación
```bash
cd app
export SHINOBI_UV=$(which uv)
npm run lint && npm run typecheck && npm run format:check && npm test
npm run build && npx playwright test e2e/editor.spec.ts
npx playwright test
```

## Notas de implementación
- `app/e2e/editor.spec.ts` (10 pruebas, sin fixtures nuevas: siembra con `sembrar()` en un temporal, `SHINOBI_SILENCIAR_AUDIO=1` y `SHINOBI_LRCLIB_URL` a un puerto cerrado para no tocar la red). Cubre: sincronizar en una pasada (12 Intro) y marcar como lista (toast, foco, resalte, `estado: lista`); mantener Intro para el fin y Retroceso; ajuste fino Alt+→, límite contra la siguiente, deshacer/rehacer, desplazamiento `.` y Restablecer; Estilo (aviso de contraste con punto en la pestaña, «Usar letra blanca», Bangers, estilo en disco); canción separándose; lista incompleta («Falta 1 línea», popover y «Salir igualmente»); toast «Borrador guardado.» solo con cambios; corregir la letra (stepper, tiempos conservados); cierre de ventana con cambios pendientes; más de 5000 renglones.
- **Fallos reales de la app que destapó el E2E (corregidos):** `EscuchaComprobacion` (0106) y `GuardadoEditor` (0104) guardaban `{ setTimeout, clearTimeout }` en un objeto y los llamaban como métodos (`this.reloj.clearTimeout(...)`): en Chromium lanza «Illegal invocation». Con la app compilada, pulsar S fallaba y el autoguardado del editor no guardaba nada; los tests unitarios pasaban porque inyectan temporizadores falsos. Ahora se envuelven en funciones (`escuchaComprobacion.ts`, `guardado.ts`) y hay un test de `EscuchaComprobacion` con el reloj real.
- Notas de la semilla y el entorno: 1) la id 11 tiene el JSON dañado a propósito, así que `idDe(datos, titulo)` de `fixtures/separacion.ts` falla con la semilla; el spec usa ids fijos `5eed0000-…-0000000000NN`. 2) Las tarjetas 17–19 quedan al final de la Biblioteca y los menús (tarjeta, selector de fuente) se cierran con el `scroll` que provoca Playwright: el spec filtra por título con el buscador y elige la fuente por teclado. 3) La canción 18 (separando al 42 %) llega al editor como separación interrumpida (la app la reconcilia al arrancar), por lo que el E2E comprueba «Disponible cuando se separen las pistas» y el popover con «Separar las pistas»/«Ir a Separación»: pregunta 0029 (no bloquea). 4) El botón «Marcar como lista» usa `aria-disabled`, de ahí el `click({ force: true })`. 4b) Los 5001 renglones se pegan con el portapapeles real (`clipboard.writeText` desde main + Ctrl/Cmd+V): `fill` lanza un evento por renglón y tarda ~25 s. 5) Audio: en macOS con Chromium silenciado el reloj avanza bien (sincronizar, mantener y retroceso estables); no se ha podido comprobar Linux sin dispositivo de audio aquí: si fallara en la CI, añadir el sink nulo de PulseAudio (`pactl load-module module-null-sink`) y avisar al arquitecto con una pregunta.
- Probar: `cd app && export SHINOBI_UV="$(which uv)" && npm run build && npx playwright test e2e/editor.spec.ts`.
- Deuda: el «punto de aviso» y el toast «Borrador guardado.» quedan cubiertos solo por el E2E (no hay test de integración a nivel `Editor`). No se verifican milisegundos (0111).

### Mantenimiento

- Síntoma: el E2E «estilo: aviso de contraste…» fallaba en ~3 de cada 5 ejecuciones aisladas (sin `[role="option"][data-activa]` tras pulsar `b`).
- Causa real (fallo de la app, no del test): `SelectorFuente` cerraba el menú ante cualquier `scroll` en captura, y el contenedor del panel de Estilo (`div` del panel) emitía un scroll de reajuste al desaparecer el aviso de contraste, justo al abrirse el selector. Ese scroll no movía el botón ni el menú.
- Arreglo: en `SelectorFuente.tsx`, ante un scroll ajeno solo se cierra si el botón ancla se ha movido respecto a su posición al abrir. Test unitario en `ControlesEditor.test.tsx` («ignora un scroll ajeno que no mueve el botón…»). El E2E no se ha modificado; 10 ejecuciones aisladas seguidas pasan.
