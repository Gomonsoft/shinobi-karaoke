# 0209 — Historial del editor: reemplazos de espera y acción «ajustar silencios»

- Estado: Pendiente
- Paso del pipeline: 4
- Depende de: [0201](0201-contratos-de-cancion-apariencia-config-e-ipc-de-la-fase-5.md), [0207](0207-deteccion-de-voz-y-propuesta-de-ajuste-de-silencios.md)
- ADRs: [0018](../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md) §3 y §6.3, [0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md#revisión-para-020--fase-5)
- Spec UX: no aplica (lógica del _reducer_). Los botones, avisos y textos son de 0212 y 0215.

## Objetivo

Preparar el estado del editor para que la espera de la canción y el ajuste de silencios sean pasos del historial y se guarden con el autoguardado existente.

## Contrato

- **`AparienciaEditor`** (`vistas/editor/estado.ts`) añade `reemplazos: { espera?: Espera } | null`. Solo tiene contenido con `tema` y `heredar`.
  - `aSeleccionIpc` lo envía en esos modos, con el valor completo (objeto o `null`), para que deshacer lo restaure.
  - La carga inicial lo toma de `cancion.apariencia.reemplazos`.
- **Acción `espera`**: `{ tipo: 'espera', espera: Espera | null, clave, ahora }`.
  - Con `propio` cambia `estilo.espera`. Con `tema` o `heredar` cambia `reemplazos.espera`; `null` lo quita, que es «volver a heredar indicadores».
  - Agrupa cambios seguidos del mismo campo en menos de 1 s, como el estilo.
  - No hace nada con sincronización al ritmo activa ni con un borrador de tema.
- **Acción `ajustar_silencios`**: `{ tipo: 'ajustar_silencios', propuesta, versionCalculo, ahora }`.
  - Si `versionCalculo !== estado.version`, no aplica y devuelve un aviso `{ tipo: 'propuesta_obsoleta' }` para que la vista recalcule.
  - Si no, crea **una** entrada del historial con la letra nueva y, si `propuesta.espera`, la apariencia con la espera nueva (en `estilo` o en `reemplazos`, según el modo).
  - Sin cambios (`lineasCambiadas === 0` y sin espera) no crea paso.
  - No hace nada con sincronización al ritmo activa ni con un borrador de tema.
- **Guardado**: `GuardadoEditor` ya agrupa `letra` y `apariencia` en un lote. Se comprueba que un paso con las dos llama a `guardarTiempos` y a `guardarApariencia`, y que deshacer reenvía las dos.

## Archivos

`app/src/renderer/src/vistas/editor/estado.ts` y, si hace falta, `guardado.ts`, con sus pruebas (`estado.test.ts`, `estado.apariencia.test.ts` y `guardado.test.ts`).

## Criterios de aceptación

- [ ] Ajustar con una propuesta de 3 líneas y espera nueva crea un paso. Deshacer devuelve letra y apariencia anteriores. Rehacer las vuelve a aplicar.
- [ ] Con `heredar`, la espera nueva queda en `reemplazos`. Con `propio`, en `estilo.espera`.
- [ ] Una propuesta calculada con otra `version` no se aplica y deja el aviso `propuesta_obsoleta`.
- [ ] Con la sincronización al ritmo activa o con un borrador de tema, la acción no cambia el estado.
- [ ] El guardado del lote incluye `reemplazos` y los tiempos.
- [ ] Las pruebas existentes del reducer pasan.

## Pruebas de feedback

- Unitarias: `estado.test.ts`, `estado.apariencia.test.ts` y `guardado.test.ts`.
- E2E: ninguna (la cubre el E2E de 0215).
- Críticos: sí (el editor forma parte del flujo principal).
- Manual: nada.

## Notas de implementación
