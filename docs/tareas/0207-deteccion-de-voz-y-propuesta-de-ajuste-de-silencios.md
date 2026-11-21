# 0207 — Detección de voz y propuesta de ajuste de silencios (funciones puras)

- Estado: Pendiente
- Paso del pipeline: 4
- Depende de: [0200](0200-esquema-del-estilo-ampliado-y-normalizacion.md) (tipo `Espera`)
- ADRs: [0018](../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md) §6.1 y §6.4, [0015](../adr/0015-linea-de-tiempo-y-picos-de-voz.md#revisión-para-020--fase-5), [0005](../adr/0005-letras-y-formato-de-sincronia.md#revisión-para-020--fase-5)
- Spec UX: no aplica (funciones puras)

## Objetivo

Implementar el algoritmo de «Ajustar los silencios» como funciones puras y deterministas sobre los picos de voz, verificadas con picos sintéticos de silencios conocidos.

## Contrato

- **`shared/silencios.ts`** (nuevo):
  - **`PARAMETROS_SILENCIOS`**, con los valores provisionales del ADR: percentil 0,95, piso de −60 dBFS, umbral relativo de −30 dB, umbral mínimo de −60 dBFS, silencio mínimo de 400 ms, voz mínima de 50 ms y margen de cola de 100 ms. Exportado como constante con nombre y aceptado como parámetro opcional.
  - **`detectarVoz({ pasoMs: 10, pares: Int16Array }, p?)`**:
    - amplitud de cada bloque `max(|min|, |max|)`;
    - referencia: percentil con histograma de 32 768 cubetas sobre los bloques por encima del piso;
    - umbral entero `max(ref − 30 dB, −60 dBFS)`;
    - bloques con voz y rachas de menos de `vozMinimaMs` eliminadas;
    - devuelve `{ intervalos: [inicioMs, finMs][], referenciaDbfs, umbralDbfs }`, con los intervalos semiabiertos en tiempo de audio.

    Sin bloques por encima del piso, los intervalos salen vacíos.
  - **`proponerAjusteSilencios(letra, voz, { duracionMs, espera, comodin = 'cuenta', p? })`**:
    - sigue los pasos 1–6 de ADR 0018 §6.1;
    - devuelve `{ letra, cambios, lineasCambiadas, finesFijadosCambiados, huecosLargos, sinVoz, espera }`;
    - no toca líneas con `palabras`, pausas, inicios ni textos;
    - los fines nuevos son `fin_ms` enteros;
    - convierte con `offset_ms`;
    - `espera` es `null` si no hay huecos largos o si la casilla `comodin` ya está activa;
    - es puro: no muta la entrada.

## Archivos

`app/src/shared/silencios.ts` (nuevo), `silencios.test.ts` y un generador de picos sintéticos en `app/src/shared/__fixtures__/picos.ts` (nuevo): voz a un nivel dado en tramos, ruido residual, cola con decaimiento y ráfagas.

## Criterios de aceptación

- [ ] Voz a −6 dBFS en [1,00–3,20 s], [3,70–6,00 s] y [11,00–13,00 s], con ruido a −70 dBFS. Las líneas que empiezan en 1,00, 3,70 y 11,00 s quedan con fin en 3,30, 6,10 y 13,10 s (± 10 ms), y el hueco de la segunda (4,9 s ≥ 4000) cuenta como largo.
- [ ] Una línea cuyo silencio dura 300 ms (< 400) no cambia.
- [ ] Una ráfaga de 30 ms dentro de un silencio no lo parte.
- [ ] Una cola que decae por debajo del umbral en 80 ms queda dentro de ± 1 bloque + margen.
- [ ] Una ventana que empieza con silencio (marca adelantada) toma el fin tras la voz, no al principio.
- [ ] Un fin fijado se sustituye y cuenta en `finesFijadosCambiados`. Un fin igual al actual no cuenta como cambio.
- [ ] Una línea con palabras y una pausa con tiempo no cambian. La pausa limita la ventana.
- [ ] Con `offset_ms = 250` los fines son coherentes en tiempo de letra.
- [ ] Última línea: ventana hasta `duracionMs`.
- [ ] Con un hueco largo y la cuenta desactivada, `espera` vuelve con `cuenta: true` y el resto igual. Si la cuenta ya está activa, `null`.
- [ ] Toda letra resultante pasa `validarInvariantesLetra`.
- [ ] Dos ejecuciones con la misma entrada dan resultados idénticos (`toStrictEqual`).

## Pruebas de feedback

- Unitarias: `silencios.test.ts`.
- E2E: ninguna.
- Críticos: sí (toca `shared/`, aunque nada del flujo lo usa todavía).
- Manual: la calibración real queda en [0210](0210-herramienta-de-calibracion-del-ajuste-de-silencios.md).

## Notas de implementación
