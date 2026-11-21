# 0271 — Verificación, limpieza, capturas e informe de la fase 8 de 0.2.1

- Estado: Pendiente
- Paso del pipeline: 3–6
- Fase: 8 de 0.2.1 · Lote D (editor)
- Depende de: 0261, 0262, 0263, 0264, 0265, 0266, 0267, 0268, 0269, 0270
- ADRs: [0021](../adr/0021-sincronia-simplificada-y-editor-preciso-de-linea.md)
- Spec UX: capturas **E8-19** ([06](../ux/06-editor.md#criterios-de-aceptación-de-la-fase-8-editor)), **B8-7** ([02](../ux/02-biblioteca.md#criterios-de-aceptación-de-la-fase-8-biblioteca)), **R8-7** ([07](../ux/07-reproductor.md#criterios-de-aceptación-de-la-fase-8-reproductor)); criterio **E8-2** de punta a punta
- Tamaño: M

## Objetivo

Comprobar la fase 8 de punta a punta con una canción con palabras importadas, borrar el código muerto y dejar capturas e informe.

## Archivos (solo estos)

- `app/e2e/fase8.spec.ts` (nueva) y `app/e2e/fase8-capturas.spec.ts` (nueva, *opt-in* `SHINOBI_CAPTURAS_8=1`)
- Una fixture de canción con palabras importadas inventadas (en `app/e2e/fixtures/` o la semilla de pruebas; **ninguna letra real**)
- `app/src/shared/letras/tiempos.ts` y `tiempos.test.ts`: **solo** borrar `desplazar`, `fijarDesplazamiento`, `formatearDesplazamiento` e `interpretarDesplazamiento` si ya no tienen usos
- `docs/ux/revision-0.2.1-fase-8/` (capturas) y `docs/versiones/0.2.1/informe-fase-8.md` (nuevo)

## Criterios de aceptación

- [ ] `fase8.spec.ts` (≤ 3 pruebas): abrir una canción con palabras importadas no escribe `cancion.json` y la vista previa barre de forma progresiva; corregir el fin de una línea con el campo deja el barrido terminando con la línea y el archivo guardado sin `palabras` en esa línea y con las de las demás (E8-2); la barra de espera de la vista previa y de «Probar a pantalla completa» da la misma fracción en el mismo instante (R8-6).
- [ ] Capturas E8-19 (1280 × 720 al 100 % y 125 %), B8-7 y R8-7 (1920 × 1080 y 1280 × 720) con los nombres de la spec.
- [ ] Las aserciones E2E que 0264 y 0265 anotaron (barra antigua o palabras importadas en `fase5.spec.ts`, `reproductor.spec.ts`; las de `exportacion.spec.ts` se piden al lote A) están ajustadas.
- [ ] Funciones de desplazamiento borradas de `shared/` sin romper `test:cambios`.
- [ ] Informe con tareas, resultados de feedback, enlace al CI y casos para la guía manual de `qa` (Final Ruin y Valiente reales: corregir fines y comparar el barrido; Assassins Creed Unity en Letra lista: fines automáticos que cambian; barra a 5 m en TV; S/`,`/`.`; funciones sin ⋯).

## Pruebas de feedback

- Unitarias: ninguna nueva.
- E2E: `fase8.spec.ts`; la de capturas solo con su variable; `npm run test:e2e:criticos`.
- Críticos: sí.
- Manual: la lista del informe.

## Notas de implementación
