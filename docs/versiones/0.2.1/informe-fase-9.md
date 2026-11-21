# Informe de la fase 9 de 0.2.1 · Editor preciso de línea

Tareas: [0272](../../tareas/0272-operaciones-puras-de-palabras-manuales.md) a [0279](../../tareas/0279-integrar-el-editor-preciso-en-el-editor.md) y [0280](../../tareas/0280-verificacion-capturas-e-informe-de-la-fase-9.md). Decisiones: [ADR 0021](../../adr/0021-sincronia-simplificada-y-editor-preciso-de-linea.md) §9 y spec [06 · Fase 9](../../ux/06-editor.md#fase-9-de-021--editor-preciso-de-línea).

## Qué incluye

Una ventana flotante no modal dentro del editor (P, botón de la lista, del panel y del riel) para marcar el inicio y el fin de cada palabra de una línea, con bucle con márgenes, velocidad de escucha con el tono conservado por debajo de 1×, forma de onda ampliada y edición rápida del texto. «Aplicar» es un solo paso del historial (texto, límites y palabras); el guardado escribe el texto con `letras.editarTextoLinea` antes de `guardarTiempos`. Las palabras hechas a mano se barren palabra a palabra en la vista previa, la prueba a pantalla completa, el reproductor, la secundaria y el video.

## Resultados de las tareas

| Tarea | Resultado |
|---|---|
| 0272 | Operaciones puras en `shared/letras/palabras.ts` (lote B2). |
| 0273 | `config.editor.paneles.preciso` (geometría y margen). |
| 0274, 0275 | WSOLA en TypeScript y tramo con tono conservado en `MotorAudio` (lote E). |
| 0276–0278 | `VentanaFlotante`, onda ampliada, regla, tira de palabras y la ventana (lote F). |
| 0279 | Integración en el editor: apertura, bloqueo de la línea abierta, aplicar como un paso, guardado del texto, indicadores, vista previa con el borrador, F6 y atajos. **Falta**: el menú contextual de la fila de la lista y el tooltip `edi.preciso.aviso.tirador` de los tiradores. |
| 0280 | `editor-preciso.spec.ts` (3 pruebas), capturas P23 y este informe. |

## Comprobación del worker de estiramiento en la app compilada

`npm run build` empaqueta `estiramiento.worker-*.js` en `out/renderer/assets/`. En la app compilada (Electron, CSP de `index.html` sin `worker-src`, que cae en `script-src 'self'`), al elegir 0,5× con el bucle de la ventana sonando, la prueba `editor-preciso.spec.ts › a 0,5×…` comprueba que el `Worker` se crea, responde con un mensaje, no emite ningún `error` y la consola no muestra errores de CSP; la nota «el tono también baja» (`edi.preciso.tono`, que solo sale si falla el estiramiento) no aparece. **No fue necesario tocar la CSP.** La precisión del reloj con tono conservado (≤ 10 ms) la cubren las pruebas unitarias de 0274/0275; la calidad de la voz estirada es de la guía manual.

## Pruebas

Verificación final compartida con la fase 8 (Windows):
- `typecheck`, `lint`, `format:check`: limpios. Vitest: 3410 pasan, 8 `EPERM` del entorno. Playwright completo con `--workers=1` (`SHINOBI_UV` definido): 202 pasan y 1 falla (`bucle nativo`, ver informe de la fase 8).
- E2E nuevos: `editor-preciso.spec.ts` — (1) P abre, la línea abierta bloquea sus campos, el texto nuevo se aplica con Ctrl+Intro como un paso, `cancion.json` conserva inicio y fin, trae palabras con `origen_palabras: "manual"` y un Ctrl/Cmd + Z lo devuelve todo (P12, P13); (2) a 0,5× el worker carga sin errores de CSP; (3) con palabras hechas a mano guardadas se muestran los indicadores de la fila y del panel (P18, datos) y mover el fin con el campo muestra `edi.toast.palabras`, deja la línea sin palabras y Ctrl+Z las devuelve (P20).
- Lo que **no** está cubierto por E2E: marcar con Intro con el bucle sonando (la comprobación del reloj es de los tests unitarios) y que «Probar a pantalla completa» sea palabra a palabra (modelo de render cubierto por pruebas unitarias del render compartido).

## Capturas (P23)

`docs/ux/revision-0.2.1-fase-9/editor-{1280x720-100,1280x720-125,1024x576-125}-{lista-indicador, preciso-abierto, preciso-marcando, preciso-texto-repartido}.png`. Faltan `preciso-palabra-seleccionada`, `preciso-descartar`, `preciso-sin-onda` y `toast-palabras-descartadas` (no hay `editor-preciso-capturas` para ellos todavía). En 1280 × 720 la ventana inicial (440 px de alto) enseña el contenido con scroll interno: conviene revisarlo con diseño.

## Para la guía manual de `qa`

- Marcar a mano una línea rápida y otra lenta de una canción real a 0,5× y 1× y comparar el barrido con la voz en el reproductor y en un video exportado.
- Calidad de la voz estirada a 0,5× y 0,75× y la primera vuelta grave del bucle.
- Mover y redimensionar la ventana con un portátil de 1366 × 768; Esc aplicando no sorprende.
- Con «Bloquear enunciado» activo y doble clic en la misma línea (corte posible al recolocar el bucle).
- Abrir la canción después con 0.2.0: se pinta palabra a palabra; si 0.2.0 la reescribe, en 0.2.1 vuelve al barrido progresivo.
- Cambiar el texto en la ventana con palabras ya marcadas (reaplicar el texto con LCS por palabras).
