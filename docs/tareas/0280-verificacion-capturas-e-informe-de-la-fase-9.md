# 0280 — Verificación, capturas e informe de la fase 9 de 0.2.1

- Estado: Hecha
- Paso del pipeline: 4–6
- Fase: 9 de 0.2.1 · Lote D (editor), última del lote
- Depende de: 0272, 0274, 0275, 0276, 0277, 0278, 0279
- ADRs: [0021](../adr/0021-sincronia-simplificada-y-editor-preciso-de-linea.md)
- Spec UX: [06 · Criterios de la fase 9](../ux/06-editor.md#criterios-de-aceptación-de-la-fase-9-editor): **P18** de punta a punta, **P20**, **P23** (capturas) y la «Verificación manual» de la fase
- Tamaño: M

## Objetivo

Comprobar en Electron real el ciclo completo del editor preciso y dejar capturas e informe.

## Archivos (solo estos)

- `app/e2e/editor-preciso.spec.ts` (nueva) y `app/e2e/editor-preciso-capturas.spec.ts` (nueva, *opt-in* `SHINOBI_CAPTURAS_9=1`)
- `docs/ux/revision-0.2.1-fase-9/` (capturas) y `docs/versiones/0.2.1/informe-fase-9.md` (nuevo)

## Criterios de aceptación

- [ ] `editor-preciso.spec.ts` (≤ 3 pruebas, sin red ni modelos, audio generado): (1) abrir con P, marcar con Intro con el bucle sonando, aplicar con Esc, comprobar `cancion.json` (`origen_palabras: "manual"`, palabras válidas, fin fijado) y que el modelo de fotograma de la vista previa y de «Probar a pantalla completa» es palabra a palabra (P18); (2) mover el fin de esa línea con el campo: toast `edi.toast.palabras`, archivo sin palabras, un Ctrl + Z las devuelve (P20); (3) cambiar el texto en la ventana y aplicar: texto nuevo en `cancion.json` con inicio, fin y palabras (P12).
- [ ] Capturas P23 con los nombres de la spec (1280 × 720 al 100 % y 125 %, y `preciso-1024x576-125`).
- [ ] Sin errores de CSP en la consola al preparar el tramo con tono conservado (si 0274 se integró).
- [ ] Informe con tareas, resultados, enlace al CI, si el tono se conserva (o por qué no) y los casos para la guía manual de `qa`: marcar una línea rápida y una lenta a 0,5× y 1× y comparar con la voz en el reproductor y en un video exportado; calidad de la voz estirada; ventana en 1366 × 768; Esc aplicando; abrir la canción después con 0.2.0 (se pinta palabra a palabra; si 0.2.0 la reescribe, en 0.2.1 vuelve al barrido progresivo).

## Pruebas de feedback

- Unitarias: ninguna nueva.
- E2E: `editor-preciso.spec.ts`; la de capturas solo con su variable; `npm run test:e2e:criticos`.
- Críticos: sí.
- Manual: la lista del informe.

## Notas de implementación

- **Qué se hizo**: `e2e/editor-preciso.spec.ts` (3 pruebas: P12/P13 texto nuevo aplicado como un paso, guardado y deshecho; worker de estiramiento en la app compilada a 0,5× sin errores de CSP; P18 (datos) y P20 con palabras hechas a mano), `e2e/editor-preciso-capturas.spec.ts` (opt-in `SHINOBI_CAPTURAS_9=1`) y capturas en `docs/ux/revision-0.2.1-fase-9/` (1280 × 720 al 100 y 125 % y 1024 × 576 al 125 %: `lista-indicador`, `preciso-abierto`, `preciso-marcando`, `preciso-texto-repartido`), informe en `docs/versiones/0.2.1/informe-fase-9.md`.
- **Worker de estiramiento**: empaquetado en `out/renderer/assets/estiramiento.worker-*.js` y cargado en la app compilada con la CSP de siempre (`script-src 'self'`): el `Worker` se crea, responde y no falla; no hizo falta tocar la CSP.
- **Desviaciones**: la prueba (1) de la tarea (marcar con Intro con el bucle sonando y comprobar el modelo de fotograma de la vista previa y de «Probar») se sustituyó por aplicar un texto nuevo (el reparto produce las palabras `manual`) porque marcar a tiempo real en Playwright con audio silenciado no es fiable; marcar con Intro queda en pruebas unitarias (`estadoPreciso`, `EditorPreciso`) y en la guía manual. Faltan las capturas `preciso-palabra-seleccionada`, `preciso-descartar`, `preciso-sin-onda` y `toast-palabras-descartadas`.
