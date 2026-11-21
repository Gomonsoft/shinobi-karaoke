# 001 — Volumen y voz guía desde el panel de la cola

- Estado: Aplazada
- Origen: pregunta [0060](../preguntas/0060-letra-y-controles-de-sonido-durante-la-sesion.md) §2 (el usuario eligió «no por ahora»)
- Fecha: 2026-11-11
- Relacionadas: ADR 0017, [Biblioteca · Fase 4](../ux/02-biblioteca.md)

## Problema
Durante un evento, el operador está en la ventana principal y el reproductor en otra pantalla. Para subir el volumen o la voz guía tiene que mover el ratón a la otra pantalla o usar el volumen del sistema.

## Propuesta
Añadir al panel de la cola el volumen general y el nivel de la voz guía, sincronizados con el reproductor.

## Valor y coste
- Valor: alto en eventos reales; evita ir a la otra pantalla.
- Coste estimado: S–M (dos comandos nuevos por IPC y dos controles en el panel).
- Riesgos: dos sitios que cambian el mismo valor; hay que mantenerlos sincronizados.

## Decisión
Aplazada por el usuario el 2026-11-11. Revisar tras ejecutar la guía manual de la fase 4.
