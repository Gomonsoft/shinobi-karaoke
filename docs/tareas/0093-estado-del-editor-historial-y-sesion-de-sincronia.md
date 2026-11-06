# 0093 — Interfaz (puro): estado del editor, deshacer/rehacer y sesión de "Sincronizar al ritmo"
- Estado: Hecha
- Paso del pipeline: 4
- Depende de: 0092
- ADRs: 0010 (§3)
- Spec UX: docs/ux/06-editor.md ("Modo Sincronizar al ritmo", "Ajuste fino", "Deshacer y rehacer", "Estilo"; criterios 13–17, 23, 27)
- Archivos: crea `app/src/renderer/src/vistas/editor/estado.ts` y `estado.test.ts`. **No toca archivos compartidos.**
- Paralelizable con: 0090, 0091, 0094–0102.

## Contexto para quien implementa
- Las operaciones de tiempos están en `app/src/shared/letras/tiempos.ts` (0092). Son puras, trabajan con **tiempo guardado** y devuelven `ResultadoTiempos = { letra, cambiado, limite, palabrasDescartadas, finesAutomaticos }`.
- Mientras el editor está abierto, guarda en local la `Letra` y el `Estilo` (`app/src/shared/estilo.ts`). La vista (0104) envía al main la última instantánea.
- El historial es **de la visita**: no se persiste y se vacía al salir del editor.
- Sin dependencias nuevas: un *reducer* puro para `useReducer`.

## Objetivo
Un *reducer* puro con el estado editable, el historial y la sesión de sincronía. La vista solo despacha acciones y reacciona a los avisos: tooltip de límite, toasts de palabras y fines, y saltos de reproducción.

## Criterios de aceptación
- [x] Tipos y API:
  ```ts
  export interface Instantanea { letra: Letra; estilo: Estilo }
  export interface EntradaHistorial { antes: Instantanea; clave: string; en: number; sesionSync: number | null; marcaId?: string }
  export type Aviso =
    | { tipo: 'limite'; limite: Limite; id: string | null }
    | { tipo: 'consecuencias'; palabrasDescartadas: string[]; finesAutomaticos: string[] } // toasts con [Deshacer]
  export interface EstadoEditor {
    actual: Instantanea
    pasado: EntradaHistorial[]          // máx. 200; se descarta la más antigua
    futuro: Instantanea[]
    seleccion: string | null
    sync: { activo: boolean; sesion: number; siguiente: string | null }
    aviso: (Aviso & { n: number }) | null // n crece en cada aviso (para re-dispararlo)
    version: number                      // crece con cada cambio de `actual`
    cambiosEnVisita: boolean              // hubo algún cambio (para edi.toast.borrador)
  }
  export type AccionEditor =
    | { tipo: 'cargar'; instantanea: Instantanea; seleccion: string | null }
    | { tipo: 'seleccionar'; id: string | null } | { tipo: 'mover_seleccion'; sentido: -1 | 1 }
    | { tipo: 'ajustar_inicio'; deltaMs: number; ahora: number }
    | { tipo: 'ajustar_fin'; deltaMs: number; duracionMs: number; ahora: number }
    | { tipo: 'fijar_inicio'; ms: number; ahora: number } | { tipo: 'fijar_fin'; ms: number; duracionMs: number; ahora: number }
    | { tipo: 'fin_automatico'; ahora: number } | { tipo: 'borrar_tiempos'; ahora: number }
    | { tipo: 'desplazar'; deltaMs: number; ahora: number } | { tipo: 'fijar_desplazamiento'; ms: number; ahora: number }
    | { tipo: 'estilo'; estilo: Estilo; clave: string; ahora: number }   // clave: 'fondo.tipo', 'fondo.angulo', 'fondo.parada.1', 'letra.color', …
    | { tipo: 'entrar_sync'; desdeId: string | null } | { tipo: 'salir_sync' }
    | { tipo: 'sync_siguiente'; id: string }                            // clic en una fila durante el modo
    | { tipo: 'marcar'; ms: number; ahora: number }                     // ms = tiempo guardado
    | { tipo: 'fin_al_soltar'; id: string; ms: number; duracionMs: number }
    | { tipo: 'deshacer_marca' }
    | { tipo: 'deshacer' } | { tipo: 'rehacer' }
  export function estadoInicial(i: Instantanea, seleccion: string | null): EstadoEditor
  export function reducirEditor(e: EstadoEditor, a: AccionEditor): EstadoEditor
  /** Última marca de la sesión actual (para habilitar Deshacer y rebobinar): id y tiempo guardado de la marca. */
  export function ultimaMarcaDeSesion(e: EstadoEditor): { id: string; ms: number } | null
  export const puedeDeshacer = (e: EstadoEditor) => boolean; export const puedeRehacer = (e: EstadoEditor) => boolean
  ```
- [x] **Reglas**:
  - Las acciones de tiempos actúan sobre `seleccion`, que debe ser una línea; sin ella no hacen nada.
  - **Durante el modo** (`sync.activo`) se ignoran: `ajustar_*`, `fijar_*`, `fin_automatico`, `borrar_tiempos`, `mover_seleccion` y `estilo` (criterio 18). El desplazamiento sí funciona.
  - Un resultado con `limite` produce `aviso = { tipo: 'limite', … }`. Uno con `palabrasDescartadas` o `finesAutomaticos` no vacíos produce `aviso = { tipo: 'consecuencias', … }`. Ambos incrementan `n`.
  - Solo `cambiado: true` cambia `actual`, añade entrada, vacía `futuro`, sube `version` y pone `cambiosEnVisita = true`.
  - **Agrupación** (criterio 27 y `ux/06` "Deshacer y rehacer": un arrastre o una ráfaga sobre el mismo valor en < 1 s es un solo paso). Si la acción tiene la misma `clave` que la última entrada, `ahora − en < 1000` y ninguna de las dos es una marca, no se añade entrada: se actualizan `actual` y el `en` de la entrada. Claves:
    - `inicio:<id>`, `fin:<id>`, `desplazamiento`;
    - `estilo:<clave>`;
    - `borrar:<id>`, `finauto:<id>` y `fijar…`: estas tres nunca se agrupan (llevan un sufijo único).
  - `entrar_sync`:
    - `activo = true`, `sesion + 1`;
    - `siguiente = desdeId ?? seleccion ?? primeraSinInicio ?? primera línea`;
    - `seleccion = siguiente`.
  - `sync_siguiente`: cambia `siguiente` y `seleccion`; no crea entrada.
  - `marcar`:
    - `marcarInicioLinea(letra, siguiente, ms)`;
    - "demasiado pronto" → solo `aviso`;
    - si cambia: entrada con `sesionSync = sesion` y `marcaId = siguiente`. `siguiente` y `seleccion` avanzan con `lineaVecina(…, 1)`, o `siguiente = null` tras la última (la vista muestra `edi.sync.fin`).
  - `fin_al_soltar`:
    - `fijarFin` sobre `id`; si da `fin_siguiente`, se reintenta con `ms = tope`, porque el fin se limita al siguiente elemento con tiempo (criterio 15);
    - **no crea entrada**: si la última entrada es la marca de ese `id`, la reutiliza, así que deshacer quita marca y fin juntos;
    - si no hay esa entrada, no hace nada.
  - `deshacer_marca`:
    - si la última entrada es una marca de la sesión actual → `deshacer`, y además `siguiente = seleccion = marcaId`;
    - si no, no hace nada.
    La vista lee antes `ultimaMarcaDeSesion` para saltar a `marca − 3 s`.
  - `deshacer` / `rehacer`: estándar. Suben `version`, no tocan `sync.activo` y conservan la `seleccion` si la línea sigue existiendo.
  - `salir_sync`: `activo = false` y `seleccion = siguiente ?? seleccion`.
  - `cargar`: estado nuevo y sin historial (al entrar y tras `LETRA_DESACTUALIZADA`).
- [x] Puro: no llama a `Date.now()` (el tiempo llega en `ahora`) y no muta (test con congelado).
- [x] Tests:
  - sesión de 6 líneas con una pausa: marcar todas, `deshacer_marca` ×2 y remarcar;
  - marca + fin al soltar → un solo deshacer quita ambos;
  - fin al soltar más allá del siguiente → fijado en el tope;
  - "demasiado pronto";
  - acciones bloqueadas durante el modo;
  - ráfaga de 5 `ajustar_inicio` en 800 ms → 1 entrada; con 1,2 s de pausa → 2 entradas;
  - 3 cambios de color en 600 ms → 1 entrada;
  - historial limitado a 200;
  - rehacer;
  - `cambiosEnVisita`;
  - aviso de consecuencias al descartar palabras.

## Verificación
```bash
cd app
npm run lint && npm run typecheck && npm run format:check
npx vitest run src/renderer/src/vistas/editor/estado.test.ts
```

## Notas de implementación

- El reducer conserva instantáneas e historial de hasta 200 pasos, agrupa ráfagas, conserva la identidad de marcas al rehacer y permite unir la marca con su fin.
- Las pruebas cubren sesiones, límites, historial, avisos y entradas congeladas. Verificación completa del bloque 2 en verde (1625 Vitest y 69 E2E).
