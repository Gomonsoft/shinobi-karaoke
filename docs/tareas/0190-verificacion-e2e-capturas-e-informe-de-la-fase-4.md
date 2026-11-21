# 0190 — Pruebas de integración, capturas e informe de la fase 4

- Estado: Hecha (el cierre formal de la fase espera a la guía manual)
- Paso del pipeline: 4 y 6
- Depende de: [0177](0177-contratos-compartidos-de-sesion-cola-y-roles.md)–[0189](0189-salir-de-la-app-con-sesion-o-cola.md)
- ADRs: [0017](../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md) §13 (estrategia de pruebas), [0008](../adr/0008-seguridad-de-electron-y-protocolos-propios.md#revisión-para-020--fase-4), [0011](../adr/0011-reproductor-pantalla-completa-y-reutilizacion-del-motor.md#revisión-para-020--fase-4)
- Spec UX: [Biblioteca · Fase 4](../ux/02-biblioteca.md#fase-4-de-020--ventana-secundaria-y-cola) (S1–S18), [Reproductor · Fase 4](../ux/07-reproductor.md#fase-4-de-020--ventana-secundaria-y-cola) (P1–P16), [Editor · Fase 4](../ux/06-editor.md#fase-4-de-020--ventana-secundaria-y-cola) (E1–E8) y [Ajustes · Fase 4](../ux/08-ajustes-y-acerca.md#fase-4-de-020--ventana-secundaria-y-cola) (AR1–AR4)
- Estrategia de pruebas: [docs/pruebas.md](../pruebas.md) · Guía manual: [Test-manuales/0.2.0/fase-4](../Test-manuales/0.2.0/fase-4-ventana-secundaria-y-cola.md)

> Reescrita el 2026-11-20 con la nueva [estrategia de pruebas](../pruebas.md): las pruebas son feedback para los agentes, la regresión completa la ejecuta el CI y lo que necesita hardware real o una persona va a la guía manual. Sustituye a la versión con 13 escenarios E2E y verificación manual dentro de la tarea.

## Objetivo

Cerrar la fase 4 con el mínimo de pruebas de integración en Electron real que Vitest no puede dar, las capturas que piden las specs UX para la revisión del diseñador y el informe de cierre. Solo añade pruebas, ayudantes de E2E, capturas e informe. Los defectos se corrigen en la tarea responsable (reabriéndola) o aquí si son menores, con una nota en el informe.

## Pruebas de feedback

### E2E: una spec, `e2e/sesion-flujo.spec.ts` (secundaria, no crítica)

Solo lo que necesita dos procesos de renderer, IPC por rol y ventanas reales. Condiciones: audio generado de pocos segundos, letras inventadas, `SHINOBI_PANTALLAS_SIMULADAS` con 2 pantallas, `SHINOBI_PANTALLA_COMPLETA_SIMULADA`, `SHINOBI_SILENCIAR_AUDIO`, LRCLIB en un puerto cerrado y `transicion_s` de 2 s en el `config.json` sembrado. Reutiliza `e2e/fixtures/` y los ayudantes que deje [0181](0181-servicio-de-sesion-e-ipc-en-main.md) en `e2e/sesion-main.spec.ts`. Como mucho **4 pruebas**, < 90 s en total:

1. **Roles y ventanas**: abrir en la pantalla simulada 2. La secundaria tiene `window.shinobiReproductor` y no `window.shinobi`, sus límites están dentro de esa pantalla y no tiene el foco. La principal sigue operable (buscar y encolar) y está silenciada: su reproductor local no se abre (P1, P2, S1).
2. **Fin y cuenta con eventos duplicados**: dejar terminar la activa con una pendiente. Desde la secundaria, `informar(fin)` dos veces y un `fin` con la `entradaId` anterior: un solo avance, cuenta de 2 s y la pendiente empieza; ninguna se salta. Sin pendientes, «Fin de la cola» sin cerrar la ventana, y añadir arranca la cuenta (P3, P6, P7, 0059-3B). Si 0181 ya cubre los duplicados en `sesion-main.spec.ts`, aquí basta el avance de extremo a extremo.
3. **Cierre conservando la cola**: con pendientes, Ctrl/Cmd + W en la secundaria → «Cerrar y conservar cola». Reabrir reanuda la entrada interrumpida en su segundo (± 1 s). Esc en la secundaria no cierra la sesión (S12, P10, P12).
4. **Caída**: `webContents.forcefullyCrashRenderer()` de la secundaria. La principal muestra la incidencia, la cola se conserva, la edición vuelve a estar disponible, `powerSaveBlocker.isStarted` es falso y la principal no está silenciada (P13, S15).

Ejecutar solo esta spec (`npx playwright test e2e/sesion-flujo.spec.ts` tras `npm run build`) y los críticos (`npm run test:e2e:criticos`). La suite completa la ejecuta el CI.

### Lo que ya cubre Vitest (no se repite en E2E)

| Escenario del ADR 0017 §13                                                                                                | Dónde queda                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cola: siguiente y final, repetida, reordenar, quitar y deshacer; la activa no se interrumpe (S4–S6)                       | `main/sesion/cola.test.ts` y `maquina.test.ts` ([0178](0178-modelo-puro-de-cola-y-maquina-de-sesion.md)); panel en Vitest de [0185](0185-panel-de-cola-sesion-controles-recuperacion-y-cierre.md)/[0186](0186-panel-de-cola-lista-de-pendientes.md) |
| Reordenar durante la cuenta, misma u otra candidata (P5)                                                                  | `maquina.test.ts` (0178)                                                                                                                                                                                                                            |
| Entrada no disponible, «Pasar a la siguiente» y «Descartar» (S9, P8)                                                      | `maquina.test.ts` (0178) y `servicio.test.ts` ([0181](0181-servicio-de-sesion-e-ipc-en-main.md))                                                                                                                                                    |
| Bloqueo de edición y `EDICION_BLOQUEADA` en todas las fases (E1–E5)                                                       | `servicio.test.ts` (0181) y Vitest de [0183](0183-estado-de-sesion-en-la-principal-bloqueo-de-edicion-e-indicador.md)/[0187](0187-tarjetas-y-menus-de-la-biblioteca-durante-la-sesion.md)                                                           |
| Cierre: eliminar, cancelar, cuenta congelada, `ses.cierre.obsoleto`, cierre durante la cuenta, «Reiniciar» (S12, P9, P11) | `maquina.test.ts` (0178) y Vitest de 0185                                                                                                                                                                                                           |
| Desconexión y reconexión de pantalla (S15, ADR §3)                                                                        | `pantallas.test.ts` y `ventanaSecundaria.test.ts` ([0180](0180-pantallas-ventana-secundaria-pantalla-completa-y-reposo.md)) y `servicio.test.ts` (0181); con cable real, en la guía manual                                                          |
| Roles, remitente por canal y `sesionId` ajeno                                                                             | `seguridad.test.ts` y `registro.test.ts` ([0179](0179-roles-de-ventana-remitente-por-rol-y-documento-secundario.md)) y `seguridad.spec.ts`                                                                                                          |
| Reposo con titulares (P14)                                                                                                | `reposo.test.ts` (0180); con el sistema real, en la guía manual                                                                                                                                                                                     |
| Ajustes «Cuenta entre canciones» (AR1–AR3)                                                                                | Vitest de [0188](0188-ajustes-cuenta-entre-canciones.md)                                                                                                                                                                                            |
| Salir con sesión o con cola (S13)                                                                                         | Vitest de [0189](0189-salir-de-la-app-con-sesion-o-cola.md)                                                                                                                                                                                         |

Si al escribir el informe algún criterio no tiene prueba en ninguna de estas tareas, se añade un Vitest en la tarea responsable, no un E2E aquí.

### Lo que va a la guía manual

Dos pantallas reales en Windows, macOS (Spaces y transición) y Linux X11/Wayland (`ses.wayland`), desconectar y reconectar el cable, audio por HDMI, escalas distintas, reposo con un evento largo en pausa, sesión de 30 min con 10 canciones y una separación en segundo plano, y la sensación visual de la cuenta (P3, P4, S7, AR2 cronometrado). Todo está en [Test-manuales/0.2.0/fase-4](../Test-manuales/0.2.0/fase-4-ventana-secundaria-y-cola.md), que **ejecuta el usuario** con la app empaquetada. El agente no hace verificación manual.

## Capturas

Solo las que exigen las specs UX para la revisión del diseñador: S18 (spec 02), P16 (spec 07), E8 (spec 06) y AR4 (spec 08), en `docs/ux/revision-fase-4/` con sus nombres y tamaños. Se generan con una spec _opt-in_ (`e2e/sesion-capturas.spec.ts`, saltada salvo con `SHINOBI_CAPTURAS_4=1`, como `temas-capturas.spec.ts`), fuera de la regresión del CI. Se crea `README.md` con la semilla usada, el equipo y el estado «tomadas».

## Informe

`docs/versiones/0.2.0/informe-fase-4.md`, con el formato de [informe-fase-3](../versiones/0.2.0/informe-fase-3.md):

- tareas;
- los criterios S1–S18, P1–P16, E1–E8 y AR1–AR4, cada uno con dónde se comprueba: E2E (`sesion-*.spec.ts`), Vitest (archivo) o guía manual (número de caso);
- enlace a la ejecución del CI en verde (Windows, macOS y Linux);
- resultado de la guía manual por equipo y sistema, copiado de su tabla «Ejecuciones», con las medidas que recoge (latencia percibida, desviación de la cuenta, memoria con las dos ventanas y cortes en 30 min);
- desviaciones;
- riesgos abiertos (Wayland, HDMI, CPU durante la separación y lo que la guía no haya podido comprobar) y preguntas.

Actualizar el estado de la fase en [plan-2](../versiones/0.2.0/plan-2.md) y en el [backlog](../versiones/0.2.0/backlog.md).

## Criterios de aceptación

- [ ] `e2e/sesion-flujo.spec.ts` con como mucho 4 pruebas, en verde en local y estable (dos ejecuciones seguidas).
- [ ] `npm run test:e2e:criticos`, `npm run typecheck`, `npm run lint` y `npm run format:check` en verde.
- [ ] **CI en verde** en Windows, macOS y Linux sobre el PR borrador de la fase (regresión completa).
- [ ] Las capturas de S18, P16, E8 y AR4 tomadas y su README actualizado.
- [ ] **La guía manual ejecutada por el usuario**, con al menos un equipo con dos pantallas reales por sistema; lo que no se pudo comprobar, anotado como riesgo.
- [ ] El informe escrito con cada criterio trazado, y el plan y el backlog actualizados.

## Notas de implementación

### Pruebas de integración y capturas (2026-11-20; falta el informe y la guía manual)

- `app/e2e/sesion-flujo.spec.ts`: 4 pruebas, ~20 s en total, estable en 3 pasadas. (1) roles y ventanas: la secundaria tiene `shinobiReproductor` y no `shinobi`, no tiene el foco, la principal queda silenciada y el reposo retenido y sigue operable (encola); (2) fin y cuenta: avance extremo a extremo con `transicion_s` = 2, fin de cola sin cerrar la ventana y añadir arranca la cuenta (los duplicados de `fin` ya los cubre `sesion-main.spec.ts`); (3) Esc no cierra, Ctrl + W → «Cerrar y conservar cola», la cola se conserva y `reanudar` vuelve en su segundo (± 1 s); (4) caída con `forcefullyCrashRenderer`: incidencia visible, cola conservada, reposo liberado y principal sin silenciar. Se quita el silencio de E2E de la principal al empezar para poder comprobar que la sesión lo restaura.
- No se comprueba que la secundaria esté dentro de la pantalla 2 simulada: con una sola pantalla real macOS la recoloca (x = 0). La colocación la cubre `ventanaSecundaria.test.ts`; con pantallas reales, la guía manual.
- `app/e2e/sesion-capturas.spec.ts` (opt-in, `SHINOBI_CAPTURAS_4=1`): guion corregido y ejecutado; las 40 capturas están en `docs/ux/revision-fase-4/` (ver su README: cómo se llega a `cuenta`, `espera` y `reanudada`, y cierre con `app.exit(0)` porque `app.close()` se cuelga con sesión abierta). Las de P16 a 1920x1080 quedan limitadas por la pantalla de esta Mac (macOS limita `setContentSize`; salen recortadas): para tomarlas completas hace falta un monitor de al menos 1080 px de alto. Sin defectos de la app nuevos. Detalle de pruebas: `app.close()` de Playwright se cuelga con una sesión o cola abiertas porque salir pide confirmación (comportamiento previsto, ADR 0017); `sesion-flujo.spec.ts` y `sesion-capturas.spec.ts` cierran ahora con `app.exit(0)`, y `sesion-flujo` vuelve a pasar (4/4).
- Defectos de código de features: ninguno encontrado.

### Informe y estado (2026-11-20)

- Informe escrito: [informe-fase-4](../versiones/0.2.0/informe-fase-4.md), con S1–S18, P1–P16, E1–E8 y AR1–AR4 trazados. CI en verde (run 44855351917, commit `b6ed411`: 6 trabajos; E2E en Ubuntu 187 correctos y 20 omitidos). Criterios sin evidencia: S17 y E5.
- Plan y backlog actualizados (fase 4: «Implementada»).
- **Estado «Hecha», pero el cierre formal de la fase espera a la guía manual**: la [guía](../Test-manuales/0.2.0/fase-4-ventana-secundaria-y-cola.md) no se ha ejecutado, así que el criterio «guía manual ejecutada por el usuario» y las medidas (latencia, desviación de la cuenta, memoria, cortes en 30 min) siguen pendientes. Falta además reconfirmar el verde del CI sobre el HEAD final de `alpha-2`.
