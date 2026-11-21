# 0205 — Peor contraste por tramos y cierre del cónico

- Estado: Hecha
- Paso del pipeline: 4
- Depende de: [0200](0200-esquema-del-estilo-ampliado-y-normalizacion.md)
- ADRs: [0018](../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md) §4, [0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md) §4
- Spec UX: no aplica (función pura; el aviso ya existe en el panel Estilo)

## Objetivo

Que el aviso de contraste cubra todos los colores que puede mostrar un degradado de cualquier forma y en cualquier fase del movimiento.

## Contrato

- **`muestrasFondo(fondo)`** (`renderer/src/karaoke/contraste.ts`):
  - **9 muestras por tramo**, extremos incluidos, interpoladas en sRGB como ya se hace;
  - tramos: de 0 a la primera parada (color sólido, basta un extremo), entre cada par de paradas consecutivas y de la última parada a 1;
  - en el **cónico**, además, el tramo de **cierre** desde la última parada hasta el color de la primera;
  - se eliminan los duplicados exactos y el orden es determinista.
- **`evaluarContraste` y `sugerirResaltado`** conservan su firma y su forma de resultado. Funcionan sobre `normalizarEstilo`.
- El movimiento no se evalúa aparte (ADR 0018 §4).

## Archivos

`app/src/renderer/src/karaoke/contraste.ts` y `contraste.test.ts`.

## Criterios de aceptación

- [x] Un degradado con dos paradas muy próximas (0,50 y 0,52), cuyo tramo intermedio baja el peor ratio, da un ratio menor que con las 11 muestras globales de antes.
- [x] Un cónico cuyo cierre entre la última y la primera parada pasa por un color de bajo contraste genera el aviso. El mismo degradado lineal no lo genera.
- [x] Los casos sólido y lineal de las pruebas existentes mantienen sus avisos y niveles. Si algún ratio cambia por el muestreo más fino, se ajusta la expectativa y se anota.

## Pruebas de feedback

- Unitarias: `contraste.test.ts`.
- E2E: ninguna.
- Críticos: no.
- Manual: nada.

## Notas de implementación

- `muestrasFondo` genera 9 muestras por tramo entre paradas (sRGB), más el cierre última-primera si `forma === 'conico'`; elimina duplicados conservando el orden. Un tramo de ancho 0 solo aporta sus dos extremos (no se inventan grises donde no hay transición). Los tramos 0-primera y última-1 son sólidos y ya quedan cubiertos por los extremos.
- `evaluarContraste` y `sugerirResaltado` pasan el estilo por `normalizarEstilo`; firmas y resultados intactos.
- Cambio de expectativa: un degradado de dos paradas pasa de 11 a 9 muestras y la central es el índice 4.
- Pruebas: `contraste.test.ts` (paradas 0,50/0,52; cierre del cónico frente al lineal). Archivos: `app/src/renderer/src/karaoke/contraste.ts` y `.test.ts`.
- Deuda: ninguna. Manual: nada.

