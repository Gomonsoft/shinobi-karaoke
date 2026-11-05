# 0057 — Alternativa al modelo Rápido con consentimiento explícito (primer arranque, API reutilizable y "Volver a Calidad")
- Estado: Hecha
- Paso del pipeline: 0 (y base para 2)
- Depende de: 0056. Interfaz definitiva: `preguntas/0019` (respondida el 2026-11-05) y detalles técnicos en `preguntas/0021` (respondida)
- ADRs: 0004 y 0009 (Revisiones 2026-11-05), 0006 (Revisiones: `rapido_aceptado`)
- Spec UX: docs/ux/01-primer-arranque.md (B2–B4, "Diálogo de consentimiento del modelo Rápido", textos `rapido.*`, criterios 18–22) y docs/ux/08-ajustes-y-acerca.md (solo la API; la vista es la 0074)
- Nota del arquitecto (2026-11-05, tras `preguntas/0019` y `0021`): el diálogo ya **no es provisional**. Cambian la precondición (también "Rápido pendiente") y el estado expuesto (`rapidoPendiente`, `volverACalidad`).
- Cuándo: **al inicio de la Fase 3**, antes de las tareas de separación (oferta tras `MEMORIA_INSUFICIENTE`/`MODELO_NO_DISPONIBLE`) y de Ajustes ("Volver a Calidad"), que reutilizan su API

## Objetivo
Cuando Calidad no se puede preparar, ofrecer al usuario el modelo Rápido **bajo su responsabilidad**, con un aviso de que su licencia no está declarada (`preguntas/0012`). Sin consentimiento nunca se descarga ni se usa.

## Criterios de aceptación
- [ ] **Puerta única en main** (`main/runtime/servicio.ts`): `aceptarYUsarRapido({ origen: 'primer_arranque' | 'separacion' })`. No hay origen `ajustes`: **Rápido no es elegible desde Ajustes** (decisión del usuario, 2026-11-05). En este orden:
  1. escribe `separacion.rapido_aceptado` (ISO; se conserva la primera fecha si ya existía);
  2. descarga y verifica Rápido si no está en `modelos_descargados`, con progreso y cancelación (reutiliza 0033);
  3. fija `separacion.modo = 'rapido'` **solo** cuando el modelo está verificado.
  - Si la descarga falla o se cancela, el modo no cambia y el consentimiento se conserva.
  - Se registra en `registros/app.log` (origen y fecha).
- [ ] **`volverACalidad()`** en el mismo servicio (lo usa Ajustes, tarea 0074; `preguntas/0021` §2):
  - es una operación del runtime, no un trabajo de canción. `estado().volverACalidad` = `null` o `{ estado: 'descargando' | 'error', bytes, total, error }`, con progreso por el `alProgreso` del runtime, para que Ajustes se reenganche al volver a la vista;
  - solo una a la vez (una segunda llamada recibe la misma promesa); `runtime.cancelarVolverACalidad()` la cancela;
  - no cuenta para `trabajos.hayPendientes()` ni para el diálogo de cierre: al salir se aborta sin preguntar y se conserva el `.descarga`;
  - descarga y verifica Calidad si falta, con progreso y cancelación;
  - fija `separacion.modo = 'calidad'` solo cuando el modelo está verificado; si falla, sigue en `rapido` y devuelve el error;
  - no borra Rápido ni el consentimiento.
  - Tests: éxito, fallo de verificación y cancelación.
- [ ] **Precondición de `aceptarYUsarRapido`**: se acepta si hay una oferta vigente (`ofrecerRapido` en el primer arranque, o un trabajo de separación terminado en `MEMORIA_INSUFICIENTE`/`MODELO_NO_DISPONIBLE` con Calidad, que conecta la tarea 0066) **o si Rápido está pendiente** (`preguntas/0021` §1).
  - **Rápido pendiente**: `rapido_aceptado` no nulo, `modo === 'calidad'` y Rápido fuera de `modelos_descargados` (aceptó y la descarga no terminó). Se deriva de `config.json`, así que sobrevive a un reinicio.
  - En otro caso devuelve `ARGUMENTOS_NO_VALIDOS`.
  - Tests: sin oferta → rechazo; con Rápido pendiente → acepta sin escribir otra fecha; Rápido ya verificado y vuelta a Calidad → rechazo.
- [ ] **API IPC** `runtime.aceptarYUsarRapido(origen)` y `runtime.volverACalidad()`, validadas con Zod. La llamada es el consentimiento: **no existe** otra vía de IPC que descargue Rápido. Se comprueba con un test que la descarga genérica de modelos rechaza `rapido` sin `rapido_aceptado` (defensa de 0056).
- [ ] `estado()` del runtime expone `rapidoPendiente: boolean` y `ofrecerRapido: boolean`. `ofrecerRapido` vale `false` siempre que `rapidoPendiente` sea `true`, y en otro caso vale `true` solo si la fase `modelo` terminó en error definitivo con Calidad por una de estas causas:
  - `VERIFICACION_FALLIDA` (tras el reintento automático);
  - `SERVICIO_NO_DISPONIBLE` en todas las URLs;
  - `SIN_ESPACIO` con espacio libre ≥ bytes de Rápido + 100 MB.
  Vale `false` con `SIN_CONEXION` y con cualquier error de otra fase. Tests unitarios por código.
- [ ] **Primer arranque, B2–B4** (`ux/01`, criterios 18–22):
  - con `ofrecerRapido`, el banner de B4 añade `rapido.oferta` (o `rapido.oferta.espacio` con `SIN_ESPACIO`) y el botón secundario "Usar el modelo Rápido…" junto a "Reintentar", que es primario y tiene el foco inicial. `pa.error.verificacion` y `pa.error.servidor.todos` según `ux/01`;
  - **diálogo `aviso-rapido`**: módulo único y reutilizable desde la vista de progreso (0068), con los textos definitivos `rapido.*`:
    - motivo según el origen (`rapido.motivo.preparar` / `.memoria` / `.descarga`), `rapido.cuerpo`, recuadro `aviso` con las tres viñetas y `rapido.alcance`;
    - enlace a "Créditos y licencias de terceros", que se abre encima y devuelve el foco al enlace;
    - botones [Cancelar] (foco inicial) y [Usar el modelo Rápido]. Pulsar el segundo **es** el consentimiento.
    - Cancelar, Esc o cerrar no guardan ni descargan nada y devuelven el foco al botón de la oferta;
  - aceptar → `aceptarYUsarRapido('primer_arranque')` → B2 con `pa.fase.modelo.rapido`, "X MB de 59 MB" y `pa.modo.rapido.aceptado` → B3 con `pa.listo.modelo` y `pa.listo.rapido`. La instalación queda `completa` con `modo: 'rapido'`;
  - si la descarga de Rápido falla, B4 muestra el error sin oferta (`rapidoPendiente`). "Reintentar" llama otra vez a `aceptarYUsarRapido('primer_arranque')` sin diálogo (criterio 21);
  - lectores de pantalla: el banner con la oferta se anuncia completo una vez, el diálogo tiene `aria-describedby` y al aceptar se anuncia `rapido.anuncio.descargando` (criterio 22).
- [ ] La comprobación al arrancar (§6 de ADR 0009) acepta una instalación con solo Rápido si `modo === 'rapido'` y hay consentimiento: no se marca `dañada`.
- [ ] **Runtime falso**: escenario `fallo_modelo_calidad` (por `VERIFICACION_FALLIDA`) y otro con `SIN_CONEXION`.
- [ ] **E2E**:
  1. Con el escenario de fallo: B4 → "Usar el modelo Rápido…" → Cancelar → sigue B4; otra vez → aceptar → B3 → Biblioteca. `config.json` con `rapido_aceptado` y `modo: 'rapido'`.
  1b. Con fallo también de la descarga de Rápido: B4 sin oferta → "Reintentar" → B3 sin volver a mostrar el diálogo.
  2. Con `SIN_CONEXION`: B4 no muestra la oferta.
- [ ] `THIRD_PARTY_NOTICES.md` y el diálogo de créditos siguen indicando la licencia no declarada de Rápido (sin cambios; solo comprobarlo).

## Notas de implementación
**Qué se hizo**
- `main/runtime/servicio.ts`: puerta única `aceptarYUsarRapido(origen)`, `volverACalidad()` y `cancelarVolverACalidad()`; `estado()` gana `rapidoPendiente`, `ofrecerRapido` y `volverACalidad`; `requisitos()` gana `bytesRapido` y `rapidoDescargado` (opcionales, para el tamaño del aviso).
  - `aceptarYUsarRapido`: precondición = Rápido pendiente, o `ofrecerRapido` (origen `primer_arranque`), o `deps.ofertaSeparacionVigente?.()` (origen `separacion`; **lo conecta la tarea 0066**, por defecto `false`). Si no, `ARGUMENTOS_NO_VALIDOS`. Escribe `rapido_aceptado` (conserva la primera fecha), lo registra en `app.log` (origen y fecha), descarga y solo entonces fija `modo = 'rapido'`. Dos llamadas comparten promesa. `pausar()` y `cerrar()` abortan la descarga suelta.
  - Con la instalación sin completar (primer arranque) usa `gestor.instalar({ modelo: 'rapido' })`: así B2 muestra la fase de modelo con su progreso, el estado pasa por `en_curso` y la instalación queda `completa` con `modo: 'rapido'`. Con la instalación completa (separación) usa `gestor.descargarModelo('rapido', señal, alProgreso)` y emite eventos por `alProgreso` (que ahora reenvía también los del gestor).
  - `volverACalidad`: operación del runtime, no cuenta para `instalando()` ni para el diálogo de cierre; progreso por `alProgreso`, estado en `estado().volverACalidad` (`descargando`/`error`, se queda en `error` hasta el siguiente intento); falla o se cancela sin cambiar el modo; no borra Rápido ni el consentimiento. `index.ts` llama a `servicio.cerrar()` al salir (aborta sin preguntar; queda el `.descarga`).
- `main/runtime/gestor.ts`: `instalar({ modelo })` (la fase de modelo descarga ese modelo, progreso y totales con su tamaño, y fija el modo al final; exige consentimiento) y `descargarModelo(id, señal, alProgreso)`. La comprobación de arranque ya aceptaba solo Rápido con `modo` y consentimiento (test nuevo en `arranque.test.ts`).
- IPC: canales `runtime:aceptarYUsarRapido` (Zod: `primer_arranque | separacion`, sin `ajustes`), `runtime:volverACalidad` y `runtime:cancelarVolverACalidad` (canales.ts, ipc.ts, handlers, preload). Test: no hay otra vía IPC que descargue Rápido.
- Runtime falso: `fallo.modelo` (`calidad | rapido`) limita el fallo de la fase de modelo a un modelo; el escenario "fallo del modelo Calidad" es `{ fase: 'modelo', modelo: 'calidad', codigo: 'VERIFICACION_FALLIDA', veces: 'siempre' }`, y el de `SIN_CONEXION` se escribe igual con ese código.
- Renderer: módulo reutilizable `vistas/aviso-rapido/` (`DialogoAvisoRapido`, textos `rapido.*`; prop `motivo` `preparar | memoria | descarga` y `bytes` = `null` si ya está descargado). `Dialogo` gana `descripcionId` (`aria-describedby`) y `ancho`. B4: oferta + botón secundario, Reintentar primario con el foco. Aceptar → `aceptarYUsarRapido('primer_arranque')` → B2 (`pa.fase.modelo.rapido`, `pa.modo.rapido.aceptado`, anuncio `rapido.anuncio.descargando`) → B3 con `pa.listo.rapido`. Con `rapidoPendiente`, "Reintentar" y "Continuar la preparación" llaman a `aceptarYUsarRapido('primer_arranque')` sin diálogo. Textos `pa.error.verificacion` y `pa.error.servidor.todos` (fase de modelo) según la spec.
- `THIRD_PARTY_NOTICES.md` y el diálogo de créditos ya indican la licencia no declarada de Rápido (comprobado, sin cambios).

**Cómo probarlo**: `npm run lint && npm run typecheck && npx prettier --check . && npx vitest run && npm run test:e2e` (con `SHINOBI_UV`). E2E nuevos 9, 10 y 11 en `e2e/primer-arranque.spec.ts` (criterios 18–22 y 1/1b/2 de esta tarea).

**Notas / deuda**
- El enlace "Ver créditos y licencias de terceros" es un `<button>` con aspecto de enlace (patrón de la app para "Ver detalles"); abre `DialogoTextoLegal('terceros')` encima y el foco vuelve a él.
- La oferta de la separación (origen `separacion`, motivos `memoria` y `descarga`) y la lectura de `ofertaSeparacionVigente` quedan para 0066/0068; el diálogo y la API ya están listos.
- Tras reiniciar con la separación en `error` y `rapidoPendiente` (preguntas/0021 §1), el botón "Usar el modelo Rápido" sin diálogo es de 0066/0068; aquí solo se resuelve el primer arranque.
- Si la fase de modelo de Calidad falla y el usuario cierra la app sin aceptar, al reabrir B5 "Continuar" sigue con Calidad (no hay Rápido pendiente); la oferta reaparece solo tras un nuevo fallo.
- E2E completos: 38 pasan; `importar-youtube › cerrar la app durante la descarga` agotó el tiempo una vez en la ejecución completa y pasa en solitario (ajeno a esta tarea).
- `tsc -p tsconfig.web.json` falla hoy solo por `vistas/progreso/*` (tarea 0068, otro programador).
