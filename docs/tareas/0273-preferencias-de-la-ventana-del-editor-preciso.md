# 0273 — Preferencias de la ventana del editor preciso en `config.editor.paneles`

- Estado: Pendiente
- Paso del pipeline: 4 (editor)
- Fase: 9 de 0.2.1 · Lote C (render, biblioteca y preferencias), última del lote
- Depende de: 0266 (mismo lote: `shared/config.ts`)
- ADRs: [0021](../adr/0021-sincronia-simplificada-y-editor-preciso-de-linea.md) §9; [0006](../adr/0006-persistencia-y-modelo-de-datos.md#revisión-para-021); [0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md#revisión-para-020--layout-adaptable-y-paneles) (preferencias de paneles)
- Spec UX: [06 · Fase 9, «La ventana»](../ux/06-editor.md#la-ventana) (filas «Tamaño inicial», «Recordar»), criterio **P2** (parte de datos)
- Tamaño: S

## Objetivo

Guardar posición, tamaño y margen del bucle de la ventana para todas las canciones, con la misma persistencia y el mismo restablecer que la distribución de paneles.

## Archivos (solo estos)

- `app/src/shared/paneles.ts` y `paneles.test.ts`
- `app/src/shared/config.ts` (esquema de `editor.paneles`) y `config.test.ts`

## Criterios de aceptación

- [ ] `config.editor.paneles.preciso` opcional: `{ x, y, ancho, alto, margen_ms: 0 | 500 | 1000 }` en px CSS, con lectura tolerante por campo (valor no válido → por defecto).
- [ ] En `shared/paneles.ts`: `PRECISO_POR_DEFECTO` (760 × 440, margen 500 = `MARGEN_ESCUCHA_LINEA_MS`; la posición inicial es «sin posición» y la calcula la ventana) y `LIMITES_PRECISO` (mínimo 560 × 360).
- [ ] El esquema parcial del renderer (`configParcialRendererSchema`) admite escribirlo, y «Restablecer distribución» (que ya escribe los paneles por defecto) lo devuelve a «sin preferencia».
- [ ] Una configuración de 0.2.0 sin el campo se lee igual; 0.2.0 ignora el campo.

## Pruebas de feedback

- Unitarias: `config.test.ts` y `paneles.test.ts` (tolerancia, valores por defecto, parcial del renderer).
- E2E: ninguna.
- Críticos: sí (`shared/`).
- Manual: ninguna propia.

## Notas de implementación

`MARGEN_ESCUCHA_LINEA_MS` lo crea 0269 en `shared/escucha.ts`; si aún no existe, usar el literal 500 con un comentario y que 0280 lo sustituya.
