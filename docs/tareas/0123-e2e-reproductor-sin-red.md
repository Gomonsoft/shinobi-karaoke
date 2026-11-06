# 0123 — E2E del reproductor sin red
- Estado: Hecha
- Paso del pipeline: 6
- Depende de: 0113, 0114, 0115, 0116, 0119, 0120, 0121, 0122
- ADRs: 0011, 0010 (E2E con audio silenciado)
- Spec UX: docs/ux/07-reproductor.md (criterios 1–5, 7, 10, 13, 14, 16–18, 20, 22, 24, 25, 27–30, 33); docs/ux/06-editor.md (criterio 42)
- Archivos: crea `app/e2e/reproductor.spec.ts` (y, si hace falta, ayudantes en `app/e2e/fixtures/reproductor.ts`). Sin archivos compartidos.
- Paralelizable con: 0126 (manual). Cierra la fase junto con 0125.

## Contexto para quien implementa
- Patrón de `e2e/editor.spec.ts`:
  - `sembrar(datos)` en una carpeta temporal (`crearTemporal`);
  - `electron.launch({ args: ['.'], cwd, env: { SHINOBI_DATOS, SHINOBI_PAPELERA_PRUEBAS, SHINOBI_SILENCIAR_AUDIO: '1', SHINOBI_LRCLIB_URL: 'http://127.0.0.1:1' } })`;
  - ids fijos `5eed0000-0000-4000-8000-0000000000NN`;
  - buscar la canción por título con el buscador de la Biblioteca (los menús se cierran con el *scroll* de Playwright; nota 2 de la 0110).
- Añade `SHINOBI_PANTALLA_COMPLETA_SIMULADA: '1'` (0113) en todas las pruebas salvo la de pantalla completa real. El estado se lee en `[data-pantalla-completa]` de la capa (0119).
- Canciones de la semilla (0115):
  - 20 «Reproductor: lista» (t1 = 2 s → silencio previo de 4 s; palabras; hueco ≥ 4 s);
  - 21 «Reproductor: lista incompleta» (1 línea sin inicio, t1 = 8 s);
  - 18 «Editor: separación interrumpida» (sin pistas).
- Con el audio silenciado el reloj de Web Audio avanza (nota 5 de la 0110). Si en Linux de la CI no avanza sin dispositivo, usa el sink nulo de PulseAudio y avisa con una pregunta al arquitecto.

## Objetivo
Comprobar de punta a punta, sin red ni modelos, que se puede cantar desde la Biblioteca, el toast y el editor, y que los errores y la salida se comportan como dice la spec.

## Criterios de aceptación
- [ ] **Biblioteca → reproducir → salir** (canción 20): escribe algo en el buscador y haz clic en "▶ Reproducir".
  - Se ve la capa con `data-pantalla-completa="true"` y el título «Reproductor: lista» en < 1 s.
  - Durante los primeros ~2 s solo hay título (silencio previo).
  - Después aparecen `●●●` y, más tarde, «Primera luz sobre el tejado».
  - Esc → la capa desaparece, `data-pantalla-completa` vuelve a `false` (el doble), el foco está en la tarjeta 20 y el buscador conserva el texto.
- [ ] **Teclado**:
  - Espacio → "❚❚ En pausa" visible y la franja inferior visible; Espacio otra vez → sigue;
  - → → indicador "+5 s";
  - ↓ → "Volumen 70 %", y en ≤ 2 s `config.json` tiene `reproductor.volumen = 0.7`;
  - M → "Silenciado";
  - la tecla de la voz guía cambia `reproductor.voz_guia_silenciada` en `config.json`;
  - F → `data-pantalla-completa="false"` sin salir; F otra vez → `true`;
  - F1 → diálogo de atajos y pausa; Esc cierra solo el diálogo; otro Esc sale;
  - Ctrl/Cmd+N no navega (al salir se sigue en la Biblioteca).
- [ ] **Controles que se ocultan**: tras mover el ratón, la franja inferior es visible; sin actividad, a los ~3 s (≤ 4 s) deja de serlo.
- [ ] **Final** (canción 20): J/L o la barra hasta los últimos segundos → pantalla final con "Otra vez" y "Volver a la biblioteca" (enfocado) y "Se cerrará en N s…"; sin tocar nada, ≤ 12 s después la capa se cierra sola. Otra pasada: al aparecer la pantalla final, mover el ratón → el texto de la cuenta atrás desaparece y a los 12 s la capa sigue abierta.
- [ ] **Lista incompleta** (canción 21): la pantalla de título muestra «⚠ Falta 1 línea por sincronizar: no se verá.»; al mover el ratón, el texto aparece también en la franja superior.
- [ ] **Falta el instrumental**:
  - con la app lanzada, borra `biblioteca/<id20>/pistas/instrumental.flac` de la carpeta temporal y reproduce la 20;
  - se ve `rep.error.titulo` + `rep.error.pistas` con el foco en "Volver a la biblioteca";
  - al pulsarlo, la tarjeta 20 muestra «Dañada» y «Faltan las pistas separadas», sin reiniciar.
- [ ] **Voz guía** (canción 20, `config.json` sembrado sin campos de voz):
  - el control "Voz" sale silenciado al 30 %;
  - V → indicador «Voz 30 %», y en ≤ 2 s `config.json` tiene `reproductor.voz_guia_silenciada = false`;
  - Mayús+↓ → «Voz 20 %» y `voz_guia = 0.2`;
  - al reabrir el reproductor se conservan los dos valores.
- [ ] **Falta la voz**: borra `pistas/voz.flac` de la 20 y reproduce → suena (aparece la letra), el control de voz tiene `aria-disabled="true"`, y al salir la tarjeta 20 está «Dañada».
- [ ] **Toast de "lista"**: canción 20 → ⋯ › "Volver a borrador" → confirmar → abrir el editor (Continuar/Editar) → "Marcar como lista" → toast «… está lista para cantar.» con [▶ Reproducir] → clic → capa del reproductor abierta y toast cerrado.
- [ ] **Toasts retenidos**: con el reproductor abierto, provoca un toast (p. ej. con `app.evaluate` enviando un aviso de trabajo, o cualquier vía que ya usen los E2E de 0075) → no hay toast visible; al salir, aparece.
- [ ] **Probar desde el editor** (canción 18, sin pistas):
  - abre el editor, selecciona la 3.ª línea y pulsa F;
  - se ve la capa con «Vista previa con la canción original…» (`rep.original`) y sin control de voz;
  - `.` dos veces → indicador «Desplazamiento: +0,20 s»;
  - Esc → editor visible, en pausa, foco en "Probar a pantalla completa", desplazamiento +0,20 en el panel;
  - en ≤ 3 s, `cancion.json` tiene `letra.offset_ms = 200`;
  - un Ctrl/Cmd+Z → desplazamiento 0.
- [ ] **Probar con instrumental** (canción 20): botón "Probar a pantalla completa" → sin etiqueta `rep.original` y con control de voz; Esc vuelve al editor.
- [ ] **Pantalla completa real** (sin `SHINOBI_PANTALLA_COMPLETA_SIMULADA`; `test.skip(process.platform === 'linux', 'Xvfb sin gestor de ventanas')`):
  - Reproducir → `expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen()))` llega a `true` (≤ 5 s);
  - Esc → llega a `false`.
- [ ] **Geometría** (criterio 33): con la ventana a 1920×1080 (`setSize` vía `app.evaluate`) y los controles visibles, ningún elemento de las franjas (`getBoundingClientRect`) cae entre el 25 % y el 75 % del alto, y la línea actual mide 7,5 % del alto ± 1 px.
- [ ] Tiempo total razonable (< 3 min en local). Las pruebas largas (final) usan saltos con L y no esperan la canción entera.

## Verificación
```bash
cd app
npm run build
export SHINOBI_UV="$(which uv)"
npx playwright test e2e/reproductor.spec.ts
npx playwright test          # toda la batería
```

## Notas de implementación
- Se añadieron cinco recorridos sin red: reproducción desde Biblioteca con atajos y vuelta con foco/búsqueda, letra incompleta, pantalla final, instrumental ausente con tarjeta dañada y prueba original desde el editor con desplazamiento/deshacer.
- Pasaron los cinco E2E dirigidos y la batería completa: 84 Playwright pasan y 2 de red se omiten. En Linux se usa pantalla completa simulada; la revisión en TV y los tres sistemas sigue en la prueba manual 0126.
- La verificación global de Vitest pasó con 1.803 tests y 12 omitidos; build, lint, typecheck y formato en verde.
