# 0046 — E2E: importar un archivo local (elegir y arrastrar)

- Estado: Hecha
- Paso del pipeline: 1
- Depende de: 0044, 0045
- ADRs: 0007, 0009 §8
- Spec UX: docs/ux/03-anadir-cancion.md (criterios 2, 3, 11)

## Objetivo

Comprobar con la app compilada y el worker real de desarrollo (con `av`, sin red) que un archivo local se convierte en una canción de la biblioteca y que abandonar no deja restos.

## Criterios de aceptación

- [ ] El audio de prueba lo genera el propio test (WAV PCM 16 de 30 s escrito con Node: cabecera RIFF + tono; y un archivo de texto con extensión `.mp3`) en el temporal de 0023. Sin archivos de audio versionados.
- [ ] El diálogo nativo se sustituye en el E2E (`electronApp.evaluate` sobre `dialog.showOpenDialog`, o una variable `SHINOBI_DIALOGO_PRUEBAS` ignorada si `app.isPackaged`).
- [ ] Recorridos:
  1. Biblioteca vacía → "Añadir canción" → "Elegir archivo…" → "Leyendo el audio…" → formulario con título del nombre del archivo → cambiar título → "Continuar" → vista de progreso con "Preparar el audio" ✓ → "Volver a la biblioteca": la tarjeta aparece como borrador con el título nuevo; en disco, `biblioteca/<id>/cancion.json` válido (`fuente.tipo = archivo`, `pasos.fuente = completado`, `ganancia_db` numérica) y `fuente/mezcla.flac` (empieza por `fLaC`); `.importando/` vacía; el WAV original con el mismo SHA-256.
  2. Elegir → "Cancelar" en el formulario → la Biblioteca no cambia y `biblioteca/` solo contiene `.importando` vacía.
  3. Archivo de texto `.mp3` → banner `add.error.FORMATO_NO_SOPORTADO`, sin restos.
  4. Arrastrar el WAV sobre la Biblioteca (evento `drop` sintético con la ruta de prueba, como en 0020) → la vista 03 lee el audio automáticamente.
  5. Cerrar la app con el formulario abierto → al relanzar, ninguna canción nueva y `.importando/` vacía.
- [ ] Se ejecutan en el job E2E de la CI (Linux) en < 60 s en total.

## Notas de implementación

- **Qué se hizo**: `app/e2e/importar-archivo.spec.ts` (5 recorridos: elegir y confirmar, cancelar, `.mp3` falso, arrastrar, cerrar con el formulario abierto) y el doble del selector `SHINOBI_DIALOGO_PRUEBAS` (`app/src/main/fuente/dialogoPruebas.ts` + test; cableado mínimo en `main/index.ts`; documentado en `app/README.md`). Su valor es una ruta o `cancelar`; se ignora si `app.isPackaged` (ADR 0009 §8).
- **Decisiones**: el WAV (30 s, PCM 16 mono, 440 Hz) y el `.mp3` de texto se generan en el test en el temporal; cada test escribe un `config.json` con instalación completa (si no, arranca Primer arranque). El arrastre se hace con `Input.dispatchDragEvent` por CDP (un `drop` sintético no da ruta real a `webUtils.getPathForFile`). La comprobación de "Preparar el audio" ✓ busca el texto `completado` de la fila (el icono no tiene texto).
- **Cómo probarlo** (desde `app/`, con uv): `SHINOBI_UV=/ruta/uv npm run build && SHINOBI_UV=/ruta/uv npx playwright test e2e/importar-archivo.spec.ts` (~20 s).
- **Deuda técnica**: solo verificado en macOS; en CI Linux depende de que `uv sync` del worker esté hecho (ya lo está, 0024).
