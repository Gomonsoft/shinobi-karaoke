# 0215 — Editor: «Ajustar los silencios»

- Estado: Pendiente
- Paso del pipeline: 4
- Depende de: [0207](0207-deteccion-de-voz-y-propuesta-de-ajuste-de-silencios.md), [0208](0208-lectura-del-nivel-base-de-picos-en-el-editor.md), [0209](0209-historial-del-editor-reemplazos-y-ajustar-silencios.md)
- ADRs: [0018](../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md) §6, [0015](../adr/0015-linea-de-tiempo-y-picos-de-voz.md#revisión-para-020--fase-5)
- Spec UX: [06 · AS · Ajustar los silencios](../ux/06-editor.md#as--ajustar-los-silencios-feature-13) (AS1–AS8)

## Objetivo

Botón y diálogo que proponen, muestran y aplican en un solo paso el ajuste de los fines de línea a los silencios de la voz.

## Contrato

- **Botón**:
  - en la fila de controles de la línea de tiempo (`PistaSincronia.tsx`), con icono `audio-waveform`, alineado a la derecha antes de «Minimizar»;
  - con la ventana por debajo de 1280 px de ancho, solo el icono, de 36 × 36, con tooltip y nombre accesible;
  - ítem «Ajustar los silencios…» en el menú ⋯ de la cabecera.
- **Precondiciones y popover** (`edi.silencios.falta.*`):
  - líneas sin inicio (`edi.falta.lineas`, con [Ir a la primera]);
  - separación pendiente o en curso;
  - picos preparándose (se actualiza en vivo);
  - picos con error, con [Reintentar] de la fase 2;
  - picos no disponibles;
  - borrador de tema;
  - sincronización al ritmo (tooltip).
- **Pulsar**:
  - se lee `leerPicosBase` (0208), con su memo de la visita;
  - se ejecuta `detectarVoz` y `proponerAjusteSilencios` (0207) con la letra en memoria, la duración y la espera **efectiva** de la canción (resuelta o, en D2, la de `estilo`);
  - si tarda más de 300 ms, el botón pasa a «Buscando silencios…»;
  - con `lineasCambiadas = 0`, toast `edi.silencios.nada` y anuncio, sin diálogo.
- **Diálogo** (`DialogoAjustarSilencios.tsx`):
  - recuentos `edi.silencios.lineas`, `.manuales` (omitido si es 0) y `.cuenta.activar` o `.yaActiva` (omitido si no hay huecos largos), con el umbral efectivo;
  - revelador «Ver las líneas» (`aria-expanded`), con lista `role="list"` de `cambios` que incluye número, texto truncado, fin anterior y nuevo, «fijado» y «silencio largo»;
  - el foco va a confirmar y Esc cancela.
- **Confirmar**:
  - se recalcula con la `version` actual del editor;
  - si los recuentos coinciden, se despacha `ajustar_silencios` con la propuesta nueva;
  - si no, se queda abierto con los recuentos nuevos y `edi.silencios.obsoleto` (`role="alert"`) (AS8).
- **Después**:
  - toast `edi.silencios.toast` con [Deshacer];
  - foco al botón;
  - resalte de 2 s con borde `info` de las regiones cambiadas en la línea de tiempo (sin fundido con movimiento reducido);
  - la selección, el cabezal, el zoom y el bucle no cambian.
- **Textos**: las claves `edi.silencios.*`.

## Archivos

`vistas/editor/silencios/{BotonAjustarSilencios,DialogoAjustarSilencios,useAjustarSilencios}.ts(x)` (nuevos), el montaje en `PistaSincronia.tsx` y en el menú ⋯ de `Editor.tsx`, el resalte de regiones en `PistaSincronia.tsx`, los textos y sus pruebas. Además, **una** prueba E2E en `e2e/editor.spec.ts`.

## Criterios de aceptación

- [ ] AS1–AS8.
- [ ] AS1 en los seis viewports de la subfase 2.1: lo comprueba el E2E existente de `editor-layout.spec.ts` si ya recorre esos tamaños; si no, en las capturas de 0218.

## Pruebas de feedback

- Unitarias:
  - `useAjustarSilencios.test.ts`, con dobles de la API de picos: motivos, propuesta, sin cambios y obsoleta;
  - `DialogoAjustarSilencios.test.tsx`: recuentos, omisiones, lista, foco y Esc.
- E2E: **una** prueba en `editor.spec.ts`.
  - Datos: una canción de la semilla con voz **generada** con silencios conocidos (el separador falso o una fixture WAV generada en la prueba, con letra inventada).
  - Recorrido: abrir Sincronía → esperar los picos → «Ajustar los silencios» → comprobar los recuentos → aplicar → comprobar el fin de una línea (± 10 ms + margen) y la casilla de cuenta → Ctrl/Cmd + Z devuelve los fines.
- Críticos: sí (el editor forma parte del flujo crítico).
- Manual (guía de la fase): AS9, con la calibración de [0210](0210-herramienta-de-calibracion-del-ajuste-de-silencios.md).

## Notas de implementación
