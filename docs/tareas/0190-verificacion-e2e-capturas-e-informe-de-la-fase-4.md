# 0190 — Verificación E2E sin red, capturas e informe de la fase 4

- Estado: Pendiente
- Paso del pipeline: 4 y 6
- Depende de: [0177](0177-contratos-compartidos-de-sesion-cola-y-roles.md)–[0189](0189-salir-de-la-app-con-sesion-o-cola.md)
- ADRs: [0017](../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md) §13 (E2E y verificación manual), [0008](../adr/0008-seguridad-de-electron-y-protocolos-propios.md#revisión-para-020--fase-4), [0011](../adr/0011-reproductor-pantalla-completa-y-reutilizacion-del-motor.md#revisión-para-020--fase-4)
- Spec UX: [Biblioteca · Fase 4](../ux/02-biblioteca.md#fase-4-de-020--ventana-secundaria-y-cola) (S1–S18), [Reproductor · Fase 4](../ux/07-reproductor.md#fase-4-de-020--ventana-secundaria-y-cola) (P1–P16), [Editor · Fase 4](../ux/06-editor.md#fase-4-de-020--ventana-secundaria-y-cola) (E1–E8) y [Ajustes · Fase 4](../ux/08-ajustes-y-acerca.md#fase-4-de-020--ventana-secundaria-y-cola) (AR1–AR4)

## Objetivo

Comprobar la fase completa en Electron real y sin red, tomar las capturas de revisión, hacer la verificación manual en dos pantallas reales y escribir el informe de cierre. Solo añade pruebas, ayudantes de E2E, capturas e informe. Los defectos se corrigen en la tarea responsable (reabriéndola) o aquí si son menores, con una nota en el informe.

## Escenarios E2E (Playwright `_electron`, sin red)

Condiciones: audio generado de pocos segundos, letras inventadas, `SHINOBI_PANTALLAS_SIMULADAS` con 2 pantallas, `SHINOBI_PANTALLA_COMPLETA_SIMULADA`, `SHINOBI_SILENCIAR_AUDIO` y `transicion_s` de 2 s en el `config.json` sembrado. Archivos `e2e/sesion-*.spec.ts`. Son los 11 escenarios del ADR 0017 §13, como mínimo, con estos detalles:

1. **Ventanas y roles**: la secundaria tiene `window.shinobiReproductor` y no `window.shinobi`, está dentro de la pantalla simulada 2 y no tiene el foco. La principal sigue operable (P1 y S1).
2. **Cola**: siguiente y final, repetida, reordenar con teclado y con ⋯, quitar y deshacer. La activa no se interrumpe porque su posición sigue avanzando (S4–S6).
3. **Fin natural y cuenta** de 2 s con la candidata. Con 10 s configurados, dura 10 s (AR2 y P3).
4. **Fin de cola**: «Fin de la cola» sin cerrarse. **Añadir arranca la cuenta (0059-3B)**. En espera sin candidata, añadir no arranca.
5. **Eventos duplicados y tardíos**: desde la secundaria, `informar(fin)` dos veces y un `fin` con la `entradaId` anterior. Hay un solo avance y ninguna pendiente saltada (P6).
6. **Reordenar durante la cuenta**: con la misma candidata la cuenta sigue, y con otra se reinicia (P5).
7. **Entrada no disponible**: una pendiente pasa a borrador mientras espera y otra pierde el instrumental en disco. Aparece P3/S4 con la causa correcta, nada avanza hasta la acción, y «Descartar» funciona sin pendientes (S9 y P8).
8. **Bloqueo de edición**: E1–E5 de la spec 06. El editor con cambios sin guardar sale a la Biblioteca y abre la sesión, y los cambios están en disco antes del primer `cargar`. Durante la sesión, la escritura de letras por IPC devuelve `EDICION_BLOQUEADA`.
9. **Cierre**: desde la secundaria (Ctrl/Cmd + W) y desde la principal; eliminar, conservar y cancelar; la cuenta congelada; `ses.cierre.obsoleto`. Reabrir reanuda en el segundo (± 1 s) y en el mismo estado, y «Reiniciar» vuelve al principio. Cierre durante la cuenta. Esc no cierra (S12, P9–P12).
10. **Caída**: `forcefullyCrashRenderer()` de la secundaria. La cola se conserva, la edición se libera, `powerSaveBlocker.isStarted` es falso y la principal no está silenciada (P13 y S15).
11. **Pantalla**: `quitar(2)` recoloca la secundaria y el audio sigue; `añadir(2)` muestra «Llevar el reproductor allí» (S15).
12. **Un solo audio**: durante la sesión la principal está silenciada y no abre el reproductor local (P2).
13. **Salir** con sesión y con cola (S13).

## Capturas

En `docs/ux/revision-fase-4/`, con los nombres y tamaños de S18 (spec 02), P16 (spec 07), E8 (spec 06) y AR4 (spec 08). Se crea `README.md` con la semilla usada, el equipo y el estado «tomadas».

## Verificación manual (con la app empaquetada)

La lista «Verificación manual» del ADR 0017 §13:

- dos pantallas reales en Windows, macOS (Spaces y transición) y Linux con X11 y con Wayland (texto `ses.wayland`);
- desconectar el cable a mitad de una canción, también con el audio por HDMI;
- pantallas con escalas distintas;
- reposo con un evento largo en pausa;
- 30 minutos con 10 canciones y una separación en segundo plano, contando los cortes de audio.

Se registra el equipo y el resultado de cada punto. Lo que no se pueda verificar se anota como riesgo abierto.

## Informe

`docs/versiones/0.2.0/informe-fase-4.md`, con el formato de [informe-fase-3](../versiones/0.2.0/informe-fase-3.md):

- tareas;
- los criterios S1–S18, P1–P16, E1–E8 y AR1–AR4, cada uno con su resultado (E2E, Vitest o a mano);
- desviaciones;
- medidas: latencia entre el comando de la principal y la secundaria, desviación de la cuenta pintada frente al avance real y memoria con las dos ventanas;
- riesgos abiertos (Wayland, HDMI y CPU durante la separación) y preguntas.

Actualizar el estado de la fase en [plan-2](../versiones/0.2.0/plan-2.md) y en el [backlog](../versiones/0.2.0/backlog.md).

## Criterios de aceptación

- [ ] Los 13 escenarios en verde en CI con Windows, macOS y Linux.
- [ ] Las capturas de S18, P16, E8 y AR4 tomadas, y el README actualizado.
- [ ] La verificación manual registrada en el informe, con al menos un equipo con dos pantallas reales por sistema, o el hueco anotado como riesgo.
- [ ] El informe escrito, y el plan y el backlog actualizados.

## Notas de implementación
