# 0204 — Geometría del fondo en el tiempo y CSS de los tres degradados

- Estado: Hecha
- Paso del pipeline: 4–6
- Depende de: [0200](0200-esquema-del-estilo-ampliado-y-normalizacion.md)
- ADRs: [0018](../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md) §2, [0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md#revisión-para-020--fase-5)
- Spec UX: no aplica (funciones puras). Los controles y el pintado por fotograma son tareas de interfaz (0211 y 0213).

## Objetivo

Funciones puras que convierten el fondo y el tiempo de audio en geometría y CSS, idénticas en editor, reproductor y exportación.

## Contrato

- **`renderer/src/karaoke/fondo.ts`** (nuevo): `geometriaFondoEn(fondo, tAudioMs, { estatico }): { anguloGrados, centro: { x, y } }`.
  - Sobre `normalizarEstilo`: fase 0 (la geometría configurada) si no hay `movimiento`, si `estatico` o si el fondo es sólido.
  - `fase = ((t mod P) + P) mod P / P`, con `P = periodo_s × 1000`. `s = +1` en sentido horario y `−1` en antihorario.
  - Lineal y cónico: `angulo = angulo_grados + 360 × fase × s`, normalizado a [0, 360).
  - Radial: `θ = 2π × fase × s` y `centro = centro + AMPLITUD_ORBITA × (sen θ, 1 − cos θ)`.
  - Redondeo a 0,01° y a 0,0001 (0,01 %).
- **`estiloCss.ts`**: `fondoCss(fondo, geometria?)`.
  - Sin geometría usa la fase 0.
  - Lineal: `linear-gradient(<a>deg, <paradas>)`. Es idéntico al actual si no hay movimiento, y las pruebas existentes no cambian.
  - Radial: `radial-gradient(circle farthest-corner at <x>% <y>%, <paradas>)`.
  - Cónico: `conic-gradient(from <a>deg at <x>% <y>%, <paradas>, <color de la primera parada> 100%)`.
  - `variablesEstilo` sigue dando `--k-fondo`, con la fase 0.
- Exportar también una función `fondoCssEn(fondo, tAudioMs, { estatico })`, que compone las dos anteriores para el pintado por fotograma y la exportación.

## Archivos

`app/src/renderer/src/karaoke/fondo.ts` (nuevo), `estiloCss.ts` y sus pruebas.

## Criterios de aceptación

- [x] `geometriaFondoEn` da el mismo resultado en `t` y en `t + P`, y para `t` negativo (silencio previo) da la fase correcta.
- [x] El sentido antihorario invierte el ángulo.
- [x] Con `estatico: true` o sin movimiento devuelve la geometría configurada.
- [x] El radial en la fase 0 tiene exactamente el centro configurado y, a mitad de periodo, se desplaza `(0, 2A)`.
- [x] `fondoCss` genera las tres formas y el cierre del cónico.
- [x] Un estilo de 0.1.0 produce exactamente la misma cadena que hoy.

## Pruebas de feedback

- Unitarias: `fondo.test.ts` (nuevo) y `estiloCss.test.ts`.
- E2E: ninguna.
- Críticos: no (solo funciones puras del renderer que aún no se usan en el flujo).
- Manual: nada (el aspecto se revisa en las tareas de interfaz).

## Notas de implementación

Se añadieron `fondo.ts` (`geometriaFondoEn`, tipo `GeometriaFondo`) y, en `estiloCss.ts`, `fondoCss(fondo, geometria?)` (lineal, radial y cónico con cierre) y `fondoCssEn(fondo, tAudioMs, opciones)`. Las pruebas están en `fondo.test.ts` y `estiloCss.test.ts`. Para probarlo: `npx vitest run src/renderer/src/karaoke`.

- Los defectos (forma lineal, centro 0,5/0,5, sin movimiento) se aplican dentro de `geometriaFondoEn` y no con `normalizarEstilo`. Así se evita clonar el estilo en cada fotograma.
- Un estilo de 0.1.0 produce la misma cadena `linear-gradient` que antes.
- Deuda: ninguna. No hay pasos manuales.
