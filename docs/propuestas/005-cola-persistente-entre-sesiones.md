# 005 — Conservar la cola al cerrar la app

- Estado: Idea
- Origen: fase 4 (decisión 0049: la cola vive en memoria y se vacía al salir)
- Fecha: 2026-11-20
- Relacionadas: ADR 0017, ADR 0006

## Problema
Si la app se cierra o se cae en mitad de un evento, la cola preparada se pierde y hay que rehacerla.

## Propuesta
Guardar la cola en disco y ofrecer recuperarla al abrir («Tenías 8 canciones en cola. ¿Recuperarlas?»).

## Valor y coste
- Valor: alto en eventos largos; es un seguro ante cierres accidentales.
- Coste estimado: S–M (persistencia y revalidación de entradas al recuperar).
- Riesgos: contradice la decisión 0049 («al salir de la app, se vacía»); requiere que el usuario la revise.

## Decisión
