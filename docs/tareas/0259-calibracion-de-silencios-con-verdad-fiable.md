# 0259 — `calibrar:silencios`: verdad fiable y más líneas utilizables
- Estado: Pendiente (backlog, fuera de 0.2.0-alpha.2; herramienta de desarrollo)
- Paso del pipeline: 4 (editor)
- Depende de: [0210](0210-herramienta-de-calibracion-del-ajuste-de-silencios.md)
- ADRs: [0018](../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md) (ajuste de silencios)
- Spec UX: —

## Objetivo
La calibración con las 6 canciones del usuario no permitió sacar conclusiones ([QA](../Test-manuales/0.2.0/ejecucion-2026-11-21-windows.md) §2 e I-8). Hay dos problemas en `app/scripts/calibrar-silencios.ts:124-130`:
- Solo toma como verdad las líneas **sin** palabras con `fin_ms` fijado. Por eso 3 de las 6 canciones aportan 0 o 1 líneas.
- Acepta como verdad cualquier fin fijado, también los que dejó «Ajustar los silencios». Con Dedos Rotos el resultado es circular: error de 0 ms.

QA sugiere probar un silencio mínimo de 250 ms, pero con datos insuficientes para recomendarlo.

## Contrato (a decidir)
- Admitir líneas con palabras usando como verdad el fin de su última palabra, **solo** si la línea no se ha editado después. Puede depender de la regla de la fase 8 del [feedback](../versiones/0.2.0/feedback-alpha-1.md).
- Excluir las canciones o líneas cuyos fines salieron de «Ajustar los silencios», si el historial o una marca lo permiten. Si no se puede, el informe avisa de una verdad sospechosa (error 0 en todas las combinaciones).
- Imprimir cuántos fines difieren más de 200 ms, el dato que pide el caso 15.2 de la guía de estilo.
- No cambiar `PARAMETROS_SILENCIOS` hasta tener una calibración concluyente.

## Criterios de aceptación
- [ ] Con la biblioteca de ejemplo de los tests, la herramienta usa las líneas nuevas, avisa de una verdad circular e imprime el recuento de fines que difieren más de 200 ms.

## Pruebas de feedback
- Unitarias: `app/scripts/calibrar-silencios.test.ts`.
- E2E: ninguna.
- Críticos: no.
- Manual: repetir la calibración con las canciones del usuario.

## Notas de implementación
