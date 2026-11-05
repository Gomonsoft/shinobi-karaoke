# 0057 — Alternativa al modelo Rápido con consentimiento explícito (primer arranque, API reutilizable y "Volver a Calidad")
- Estado: Pendiente
- Paso del pipeline: 0 (y base para 2)
- Depende de: 0056; interfaz definitiva: `preguntas/0019` (mientras tanto, diálogo provisional)
- ADRs: 0004 y 0009 (Revisiones 2026-11-05), 0006 (Revisiones: `rapido_aceptado`)
- Spec UX: docs/ux/01-primer-arranque.md (B4) y docs/ux/08-ajustes-y-acerca.md, pendientes de `preguntas/0019`
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
- [ ] **`volverACalidad()`** en el mismo servicio (lo usará Ajustes en la Fase 3):
  - descarga y verifica Calidad si falta, con progreso y cancelación;
  - fija `separacion.modo = 'calidad'` solo cuando el modelo está verificado; si falla, sigue en `rapido` y devuelve el error;
  - no borra Rápido ni el consentimiento.
  - Tests: éxito, fallo de verificación y cancelación.
- [ ] **Precondición de `aceptarYUsarRapido`**: solo se acepta si hay una oferta vigente, es decir, `ofrecerRapido` en el primer arranque o un trabajo de separación terminado en `MEMORIA_INSUFICIENTE`/`MODELO_NO_DISPONIBLE` (este segundo caso se conecta en la Fase 3). En otro caso devuelve `ARGUMENTOS_NO_VALIDOS`. Lleva test.
- [ ] **API IPC** `runtime.aceptarYUsarRapido(origen)` y `runtime.volverACalidad()`, validadas con Zod. La llamada es el consentimiento: **no existe** otra vía de IPC que descargue Rápido. Se comprueba con un test que la descarga genérica de modelos rechaza `rapido` sin `rapido_aceptado` (defensa de 0056).
- [ ] `estado()` del runtime expone `ofrecerRapido: boolean`. Vale `true` solo si la fase `modelo` terminó en error definitivo con Calidad por una de estas causas:
  - `VERIFICACION_FALLIDA` (tras el reintento automático);
  - `SERVICIO_NO_DISPONIBLE` en todas las URLs;
  - `SIN_ESPACIO` con espacio libre ≥ bytes de Rápido + 100 MB.
  Vale `false` con `SIN_CONEXION` y con cualquier error de otra fase. Tests unitarios por código.
- [ ] **Primer arranque, B4**:
  - con `ofrecerRapido`, botón secundario "Usar el modelo Rápido…" junto a "Reintentar", que abre el diálogo de consentimiento;
  - [Cancelar] vuelve a B4 sin cambios;
  - aceptar → `aceptarYUsarRapido('primer_arranque')` → progreso de la fase de modelo con el tamaño de Rápido → B3;
  - instalación `completa` con `modo: 'rapido'`;
  - el diálogo es accesible (foco atrapado, Esc = Cancelar, anuncio del resultado).
  - Texto **provisional** de `preguntas/0019`, en un único módulo de textos (`aviso-rapido`) reutilizable desde la vista de progreso en la Fase 3.
- [ ] La comprobación al arrancar (§6 de ADR 0009) acepta una instalación con solo Rápido si `modo === 'rapido'` y hay consentimiento: no se marca `dañada`.
- [ ] **Runtime falso**: escenario `fallo_modelo_calidad` (por `VERIFICACION_FALLIDA`) y otro con `SIN_CONEXION`.
- [ ] **E2E**:
  1. Con el escenario de fallo: B4 → "Usar el modelo Rápido…" → Cancelar → sigue B4; otra vez → aceptar → B3 → Biblioteca. `config.json` con `rapido_aceptado` y `modo: 'rapido'`.
  2. Con `SIN_CONEXION`: B4 no muestra la oferta.
- [ ] `THIRD_PARTY_NOTICES.md` y el diálogo de créditos siguen indicando la licencia no declarada de Rápido (sin cambios; solo comprobarlo).

## Notas de implementación
(las rellena el programador al terminar)
