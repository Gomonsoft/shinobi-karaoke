# 0112 — Contratos compartidos de la Fase 6: canales `ventana.*`, `biblioteca.comprobarPistas`, voz guía en `config.reproductor` y API falsas
- Estado: Hecha
- Paso del pipeline: 6
- Depende de: — (Fase 5 cerrada). **Primera de la fase.**
- ADRs: 0011 (§1, §2, §3 "Configuración", §5), 0008 (punto 4: Zod + remitente), 0006
- Spec UX: docs/ux/07-reproductor.md (§"Datos que usa", volumen, voz guía)
- Preguntas: 0030 (usuario: voz guía), 0031 (respondida)
- Archivos:
  - **compartidos**: `app/src/shared/canales.ts`, `app/src/shared/ipc.ts`, `app/src/shared/config.ts`, `app/src/preload/index.ts`, `app/src/main/ipc/handlers.ts` (+ su test), `app/src/renderer/src/env.d.ts` si declara `ApiShinobi`;
  - API falsas de los tests: `app/src/renderer/src/vistas/biblioteca/fixturesApi.ts`, `app/src/renderer/src/vistas/editor/fixturesApi.ts` (y cualquier otro objeto que implemente `ApiShinobi` entero y deje de compilar: `App.test.tsx`, `PrimerArranque.test.tsx`, `Ajustes.test.tsx`, `AcercaDe.test.tsx`, `letra/fixturesApi.ts`).
- Paralelizable con: 0115, 0116, 0117, 0118, 0124. **Antes de** 0113, 0114, 0119–0122.

## Contexto para quien implementa
- Contrato IPC: nombres en `shared/canales.ts` (sin dependencias; lo importa el preload con sandbox) y esquemas Zod + tipos en `shared/ipc.ts` (`CONTRATO[canal] = { args, res }`, interfaz `ApiShinobi`). Los *handlers* (`main/ipc/handlers.ts`) envuelven cada canal con `envolver` (valida argumentos, comprueba el remitente y traduce errores a `{ codigo, mensaje }`). Las dependencias de los handlers son interfaces (`BibliotecaIpc`, `RuntimeIpc`, …) dentro de `DependenciasIpc`; los eventos se difunden con `difundir(canal, carga)` y el preload se suscribe con `suscribir(canal, cb)`.
- Sigue el patrón de la tarea 0090 (contratos de la Fase 5) para todo lo que no se diga aquí.

## Objetivo
Dejar fijados todos los contratos que comparten las tareas de la fase, para que main e interfaz avancen en paralelo con la API falsa.

## Criterios de aceptación
- [ ] **Canales** (`CANALES`):
  ```ts
  ventana: {
    modoReproductor: 'ventana:modoReproductor',          // (activo: boolean) => void
    fijarPantallaCompleta: 'ventana:fijarPantallaCompleta', // (activa: boolean) => void
    estaEnPantallaCompleta: 'ventana:estaEnPantallaCompleta', // () => boolean
    evitarReposo: 'ventana:evitarReposo'                  // (activo: boolean) => void
  },
  biblioteca: { …, comprobarPistas: 'biblioteca:comprobarPistas' }, // (id) => ResumenCancionIpc | null
  eventos: { …, pantallaCompleta: 'ventana:pantallaCompleta' }      // carga: boolean
  ```
- [ ] **`CONTRATO`** (`shared/ipc.ts`): `ventana.*` con `args: z.tuple([z.boolean()])` (o `vacio` para `estaEnPantallaCompleta`) y `res: z.void()` / `z.boolean()`; `biblioteca.comprobarPistas` con `args: unId` y `res: resumenCancionSchema.nullable()` (el esquema de resumen que ya usan `listar`/`marcarLista`).
- [ ] **`ApiShinobi`**:
  ```ts
  biblioteca: { …
    /** Vuelve a comprobar las pistas de la canción (reproductor, 0120/0121): puede pasarla a Dañada. */
    comprobarPistas(id: string): Promise<ResumenCancionIpc | null>
  }
  ventana: {
    /** true: recuerda el estado de la ventana y pasa a pantalla completa; false: restaura el estado recordado. */
    modoReproductor(activo: boolean): Promise<void>
    /** F / ⛶ dentro del reproductor. */
    fijarPantallaCompleta(activa: boolean): Promise<void>
    estaEnPantallaCompleta(): Promise<boolean>
    /** Mantiene la pantalla encendida mientras suena (powerSaveBlocker). */
    evitarReposo(activo: boolean): Promise<void>
    /** Cambios reales de pantalla completa (también menú, F11 o botón verde). */
    alCambiarPantallaCompleta(cb: (activa: boolean) => void): () => void
  }
  ```
- [ ] **Handlers**: `DependenciasIpc` gana
  ```ts
  ventana?: VentanaIpc
  export interface VentanaIpc {
    modoReproductor(activo: boolean): void
    fijarPantallaCompleta(activa: boolean): void
    estaEnPantallaCompleta(): boolean
    evitarReposo(activo: boolean): void
    suscribir(cb: (activa: boolean) => void): () => void
  }
  ```
  y `BibliotecaIpc` gana `comprobarPistas(id: string): Promise<ResumenCancion | null>`. Sin `ventana`, los canales `ventana.*` responden sin hacer nada (`estaEnPantallaCompleta` → `false`), para que los tests de handlers existentes no cambien. El evento `ventana:pantallaCompleta` se difunde suscribiéndose a `ventana.suscribir` al registrar los handlers. `comprobarPistas` aún no existe en `ServicioBiblioteca` (llega en 0114): para que compile, añade en `ServicioBiblioteca` un método provisional que devuelva `this.obtenerResumen(id)` con un `// TODO 0114`.
- [ ] **Config** (`shared/config.ts`, lectura tolerante, **sin** cambiar `VERSION_ESQUEMA_CONFIG`):
  ```ts
  const reproductorSchema = z.object({
    volumen: z.number().min(0).max(1).default(0.8),
    silenciado: z.boolean().default(false),
    /** Voz guía (pregunta 0030): volumen propio, aplicado antes del volumen general. */
    voz_guia: z.number().min(0).max(1).default(VOLUMEN_VOZ_PREDETERMINADO),
    voz_guia_silenciada: z.boolean().default(VOZ_SILENCIADA_PREDETERMINADA)
  }).prefault({})
  export const VOLUMEN_VOZ_PREDETERMINADO = 0.3
  export const VOZ_SILENCIADA_PREDETERMINADA = true
  ```
  `configParcialRendererSchema.reproductor` acepta también `voz_guia` y `voz_guia_silenciada` opcionales. Test: un `config.json` sin esos campos se lee con los valores por defecto, y uno con `voz_guia: 2` cae en la recuperación tolerante que ya exista para valores fuera de rango (comprueba qué hace hoy con `volumen: 2` y haz lo mismo).
  Nombres y valores por defecto de `ux/07` §"Datos que usa" (30 % y silenciada).
- [ ] **Preload**: expone `biblioteca.comprobarPistas` y `ventana.*` (incluida `alCambiarPantallaCompleta` con `suscribir`). Sin exponer `ipcRenderer`.
- [ ] **API falsas**: las de biblioteca y editor implementan `ventana` (estado en memoria: `modoReproductor(true)` pone `pantallaCompleta = true` y avisa a los suscriptores; `false` lo devuelve al valor previo; `evitarReposo` guarda el último valor en `api.__reposo` o similar, consultable por los tests) y `comprobarPistas` (devuelve el resumen de la canción, con `danada: true` si el test lo prepara). Los tests de componentes de las tareas siguientes usan estas API falsas.
- [ ] Test de handlers: validación de argumentos (`modoReproductor('si')` → `ARGUMENTOS_NO_VALIDOS`), remitente no válido rechazado, y difusión del evento `ventana:pantallaCompleta`.

## Verificación
```bash
cd app
npm run lint && npm run typecheck && npm run format:check && npm test
npm run build && export SHINOBI_UV="$(which uv)" && npx playwright test
```

## Notas de implementación
- Main valida las cuatro operaciones de ventana con Zod y el control de remitente. El preload expone solo operaciones tipadas y una suscripción que elimina el evento de Electron.
- `comprobarPistas` devuelve un resumen seguro o `null`. La revisión de archivos en disco corresponde a 0114.
- Una configuración anterior obtiene 30 % para la voz guía y comienza silenciada. Un valor inválido sigue la misma recuperación que el volumen general: se usa la copia de seguridad válida o se aparta el archivo y se escriben los valores de fábrica.
- Los dobles de Biblioteca y Editor exponen pantalla completa simulada y el estado de reposo. El Editor conserva los campos de voz al cambiar su volumen hasta que 0118 unifique el hook.
- Lint, tipos, formato y build en verde. En Vitest pasaron 1711 pruebas y se omitieron 12; la prueba del editor que pulsaba S antes de habilitar el botón se estabilizó y pasó en su suite (8 de 8). Playwright pasó 78 pruebas con 2 omitidas y la prueba del puente IPC pasó tras actualizar su lista de espacios de nombres.
