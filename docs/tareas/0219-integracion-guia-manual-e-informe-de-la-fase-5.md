# 0219 — Pruebas de integración, guía manual e informe de la fase 5

- Estado: Hecha (E2E, guías manuales e [informe](../versiones/0.2.0/informe-fase-5.md) escritos; el **cierre formal espera a que el usuario ejecute las guías** y la calibración de «Ajustar los silencios», y a que 0100 y 0110 se respondan o se acepten)
- Paso del pipeline: 4–6
- Depende de: [0200](0200-esquema-del-estilo-ampliado-y-normalizacion.md)–[0218](0218-capturas-de-revision-de-la-fase-5.md)
- ADRs: [0018](../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md)
- Spec UX: [06](../ux/06-editor.md#fase-5-de-020--estilo-espera-y-letra-lista), [07](../ux/07-reproductor.md#fase-5-de-020--estilo-espera-y-letra-lista) y [02](../ux/02-biblioteca.md#fase-5-de-020--estilo-espera-y-letra-lista)

## Objetivo

Cerrar la fase: integración real entre procesos con un E2E mínimo, CI en verde, guía manual ejecutada por el usuario e informe.

## Contrato

- **`e2e/fase5.spec.ts`**, secundaria, con **4 pruebas como máximo**, sin red y con datos inventados:
  1. **Letra lista de punta a punta**: marcar en el editor con el diálogo y «No volver a mostrar» → la Biblioteca enfoca la tarjeta con la insignia → «Reproducir» → no existe la capa de resaltado → al reabrir el editor, la vista previa tiene barrido. Cubre LL3, LL4, LB1, LB3 y R12.
  2. **Letra lista en la sesión**: encolar la canción y reproducirla en la secundaria sin barrido; cambiarla a Lista en mitad de la reproducción no afecta a la que suena. Cubre R13. Reutiliza las utilidades de `sesion-flujo`.
  3. **Misma fase en editor y reproductor**: con un estilo cónico en movimiento, buscar t = 12,3 s en la vista previa y en el reproductor y comparar `--k-fondo`. Cubre G6, R1 y R2.
  4. **Movimiento reducido** (`emulateMedia({ reducedMotion: 'reduce' })`): fase 0 en la vista previa y el reproductor, `edi.fondo.mov.reducido` visible y sin el botón «Detener». Cubre G8 y R3.

  G2 (píxel a píxel con 0.1.0) se compara aquí si es estable. Si no, pasa a la guía manual.

- **CI**: PR borrador de la fase con `ci.yml` en verde. El agente `qa` clasifica los fallos.
- **Guía manual** (la escribe `qa` en `docs/Test-manuales/0.2.0/`). Casos que debe incluir:
  - G4: cónico de dos colores muy distintos, sin costura visible;
  - G12: fondo en movimiento a 1920 × 1080 fluido en un equipo modesto, sin retrasar el barrido;
  - sensación de las velocidades Lenta, Media y Rápida en una TV a 5 m, y que no maree;
  - legibilidad de la cuenta y la barra a 5 m en una TV de 55" y en un proyector, con degradados claros y oscuros, también en movimiento;
  - movimiento fluido en la secundaria de un equipo modesto con dos pantallas;
  - que una Letra lista se lea bien sin barrido en una canción rápida;
  - que el aviso de Letra lista se entienda a la primera, y que «No volver a mostrar» sobreviva a reiniciar la app (LL3);
  - movimiento reducido del sistema operativo (macOS, Windows y GNOME): fondo quieto y números sin animación (R3, R10);
  - **AS9 y calibración**: ejecutar `npm run calibrar:silencios` ([0210](0210-herramienta-de-calibracion-del-ajuste-de-silencios.md)) con las 6 canciones sincronizadas a mano; anotar cuántos fines difieren más de 200 ms y la combinación recomendada; comprobar «Ajustar los silencios» en una de ellas y deshacerlo;
  - abrir con 0.1.0 una canción guardada por 0.2.0 con cónico, espera y Letra lista: se ve como lineal estática con puntos y como Lista.
- **Informe** `docs/versiones/0.2.0/informe-fase-5.md` con el resultado del CI, de la guía y de las capturas. Si la calibración lo pide, el arquitecto actualiza `PARAMETROS_SILENCIOS` y el ADR 0018.

## Archivos

`app/e2e/fase5.spec.ts` (nuevo), la fila del inventario en `docs/pruebas.md` y el informe. La guía la escribe `qa`.

## Criterios de aceptación

- [x] `fase5.spec.ts` pasa en el CI (193 E2E en verde en Ubuntu, run 44858445678; los E2E solo corren en Ubuntu).
- [ ] Guía manual ejecutada por el usuario, con los resultados anotados.
- [ ] Preguntas [0100](../preguntas/0100-decisiones-provisionales-de-la-fase-5.md) y [0110](../preguntas/0110-decisiones-provisionales-de-ux-de-la-fase-5.md) respondidas, o con su opción provisional aceptada en el informe.
- [x] Informe con el estado de cada criterio G, IE, LL, AS, R y LB ([informe-fase-5.md](../versiones/0.2.0/informe-fase-5.md)).

## Pruebas de feedback

- E2E: `fase5.spec.ts`, que se ejecuta durante esta tarea, y los críticos.
- Manual: la guía de arriba.

## Notas de implementación

### Spec E2E (programador, 2026-11-20)

- `app/e2e/fase5.spec.ts`, 4 pruebas, sin red, estable en 2 pasadas (~18 s) y con `@critico` en verde:
  1. Letra lista de punta a punta: editor → «Marcar como letra lista» con «No volver a mostrar» → Biblioteca con `[data-resaltada]` e insignia → «Reproducir» sin `[data-barrido]` → al reabrir el editor, la vista previa sí tiene barrido (LL3, LL4, LB1, LB3, R12).
  2. Sesión con secundaria real: la Letra lista suena sin `[data-barrido]`. Cambiarla a Lista durante la sesión **se rechaza** (`EDICION_BLOQUEADA`, `sinSesion()` de `marcarLista`), así que no cambia nada: la prueba afirma ese rechazo y que `cancion.json` conserva `letra_lista` (R13). Sin barrido en origen `sesion` (solo cableado, sin test).
  3. `--k-fondo` idéntico a 12,3 s en la vista previa del editor y en «Probar a pantalla completa» con un cónico en movimiento, y distinto de la fase 0 (G6, R1, R2).
  4. Movimiento reducido emulado: fase 0 en vista previa y reproductor tras buscar 12,3 s, nota `edi.fondo.mov.reducido` visible y sin el botón «Detener el movimiento del fondo» (G8, R3).
- La prueba de sesión se cierra con `salirSinConfirmar`.
- G2 (píxel a píxel con 0.1.0) no se compara: pasa a la guía manual.
- Fila del inventario añadida a `docs/pruebas.md`.
- Pendiente: CI en verde del PR borrador, guía manual de `qa` (casos en el Contrato), informe y preguntas 0100/0110.

### Guías e informe (qa, 2026-11-20)

- Guías: `docs/Test-manuales/0.2.0/fase-5-estilo-espera-y-letra-lista.md` (ahora con el caso 18, «Criterios sin prueba automática») y `fase-5-calibracion-de-silencios.md`. **Ninguna se ha ejecutado.**
- Informe: `docs/versiones/0.2.0/informe-fase-5.md`. Sin evidencia automática: G9, IE7 y LB6; AS9 pendiente de la calibración; «Ajustar los silencios» sigue **sin calibrar**.
- Correcciones de la guía: el texto de la ayuda de la insignia es «por líneas» (no «por línea»).
