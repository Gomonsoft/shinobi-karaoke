# 0262 — `guardarTiempos` acepta palabras hechas a mano

- Estado: Pendiente
- Paso del pipeline: 4 y 5 (guardado)
- Fase: 8 de 0.2.1 (prepara la 9) · Lote B1 (contratos y main de letras)
- Depende de: 0261 (lote B2: `palabrasVisibles`, `validarPalabrasManuales` y `aPeticionTiempos` en `tiempos.ts`), 0283 (mismo lote: `servicio.ts`, `letrasBusqueda.ts`)
- ADRs: [0021](../adr/0021-sincronia-simplificada-y-editor-preciso-de-linea.md) §1 y §6; [0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md#revisión-para-021--fases-8-y-9) §2
- Spec UX: [06 · Fase 9, «Conceptos» y «Cómo se pinta»](../ux/06-editor.md#conceptos), criterio **P18** (guardar y reabrir conserva las palabras); sin interfaz
- Tamaño: S

## Objetivo

Que el único escritor de `letra` acepte y valide las palabras con `origen_palabras: "manual"` y siga restaurando las importadas con deshacer.

## Archivos (solo estos)

- `app/src/shared/letrasBusqueda.ts` (`tiempoElementoSchema`) y su test
- `app/src/main/letras/servicio.ts` y `servicio.test.ts`
- `app/src/shared/letras/tiempos.ts` y `tiempos.test.ts`, solo `aPeticionTiempos` (el archivo es del lote B2; 0261 ya terminó y 0272 no toca esa función)
- `app/src/renderer/src/vistas/editor/fixturesApi.ts` **no** se toca (lo adapta 0279 si hace falta).

## Criterios de aceptación

- [ ] `tiempoElementoSchema` (estricto) admite `origen_palabras: "manual"` opcional; cualquier otro valor es `ARGUMENTOS_NO_VALIDOS`.
- [ ] `aPeticionTiempos` envía `origen_palabras: "manual"` en las líneas que lo tienen y lo omite en las demás.
- [ ] Main, para una línea con `palabras` ≠ `null`:
  - sin `origen_palabras`: la regla de hoy (palabras de la referencia desplazadas por el delta del inicio);
  - con `"manual"`: `validarPalabrasManuales` (0261) contra el texto **guardado** de la línea y su fin (fijado o, si no hay, el inicio del siguiente elemento); no compara con la referencia. Si falla: `ARGUMENTOS_NO_VALIDOS` (respuesta a [0145](../preguntas/0145-contratos-de-las-fases-8-y-9-para-las-specs.md) §3).
- [ ] Main escribe `origen_palabras: "manual"` solo si hay palabras manuales; en cualquier otro caso el elemento queda sin el campo.
- [ ] Una petición sin cambios sigue sin escribir (comparación existente).
- [ ] Una canción de 0.2.0 abierta y guardada sin tocar palabras conserva sus palabras importadas byte a byte.

## Pruebas de feedback

- Unitarias: `main/letras/servicio.test.ts` (manuales válidas, texto que no coincide, solapes, fuera de la línea, restaurar importadas tras borrarlas, quitar el campo con `palabras: null`), test del esquema en `shared/`.
- E2E: ninguna.
- Críticos: sí (`main/`, `shared/`).
- Manual: ninguna propia (la cubre la guía de la fase 9).

## Notas de implementación
