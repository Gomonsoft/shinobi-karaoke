# 0090 — Contratos de la Fase 5: IPC del editor (`guardarTiempos`, `guardarEstilo`, `marcarLista`, `guardadoPendiente`), `LETRA_DESACTUALIZADA`, orden de paradas y API falsa del editor
- Estado: Hecha
- Paso del pipeline: 4 y 5
- Depende de: — (Fases 0–4 cerradas). **Es la primera tarea de la fase**: las tareas de main e interfaz (0091, 0103–0110) dependen de ella.
- ADRs: 0010 (§2, incluido "Guardado y debounce"), 0006 (escritor único, formato del estilo), 0008 (validación IPC con Zod)
- Spec UX: docs/ux/06-editor.md ("Guardado, borrador y lista", "Desplazamiento de toda la letra")
- Pregunta: `preguntas/0025` §3 y §4 (respondida)
- **Archivos compartidos que toca**: `app/src/shared/canales.ts`, `app/src/shared/ipc.ts`, `app/src/shared/errores.ts`, `app/src/shared/estilo.ts`, `app/src/preload/index.ts`, `app/src/main/ipc/handlers.ts`. Ninguna otra tarea de la fase toca `canales.ts`, `ipc.ts`, el preload ni `handlers.ts`: si hace falta un canal más, se añade aquí o se abre una pregunta.

## Contexto para quien implementa
- La app está en `app/`: Electron + React + TypeScript, con Zod 4 y Vitest. Contrato IPC único:
  - `app/src/shared/canales.ts`: solo nombres, sin dependencias, porque el preload con *sandbox* lo importa;
  - `app/src/shared/ipc.ts`: `CONTRATO` canal → `{ args: z.tuple([...]), res: esquema }` e interfaz `ApiShinobi`;
  - `app/src/preload/index.ts`: `invocar(canal, ...args)`;
  - `app/src/main/ipc/handlers.ts`: `envolver(canal, fn)` valida los argumentos con el contrato y traduce `ErrorBiblioteca` a `{ ok: false, error: { codigo, mensaje } }`.
  Copia el patrón de `letras.editarTexto` y `biblioteca.volverABorrador`.
- `cancion.json#letra` solo lo escribe `ServicioLetras` (`app/src/main/letras/servicio.ts`). `ServicioBiblioteca` (`app/src/main/biblioteca/servicio.ts`) ya tiene:
  - `actualizar(id, cambio, { debounceMs })`;
  - `marcarLista(id)`: lanza `ErrorBiblioteca('ARGUMENTOS_NO_VALIDOS', …)` si `puedeMarcarseLista` es falso;
  - `volverABorrador(id)`.
- `ResumenCancion` → `resumenParaRenderer(...)` en los handlers, como en `letras.guardar`.

## Objetivo
Dejar declarados, validados y enchufados los canales nuevos del editor, para que el main (0091) y la interfaz (0103+) trabajen en paralelo. También el código de error nuevo, la validación de orden de las paradas y una API falsa del editor para los tests del renderer.

## Criterios de aceptación
- [x] **Esquema `guardarTiemposSchema`** en `app/src/shared/letrasBusqueda.ts` (exportado también desde `shared/index.ts` si allí se reexporta `letrasBusqueda`):
  ```ts
  export const tiempoElementoSchema = z.strictObject({
    id: z.string().min(1).max(200),
    inicio_ms: z.number().int().min(0).nullable(),
    fin_ms: z.number().int().min(0).nullable(),
    palabras: z.array(palabraSchema).min(1).max(500).nullable()
  })
  export const OFFSET_MAXIMO_MS = 30_000
  export const guardarTiemposSchema = z.strictObject({
    cancionId: z.string().min(1).max(200),
    offset_ms: z.number().int().min(-OFFSET_MAXIMO_MS).max(OFFSET_MAXIMO_MS),
    tiempos: z.array(tiempoElementoSchema).max(MAX_ELEMENTOS_LETRA)
  })
  export type GuardarTiempos = z.infer<typeof guardarTiemposSchema>
  ```
  `palabraSchema` se importa de `./letra`. Los invariantes (inicios crecientes, etc.) **no** se validan aquí: los valida el main al combinar con la letra guardada (0091).
- [x] **Canales** en `canales.ts`, con comentario de una línea que cite 0090:
  - `letras.guardarTiempos: 'letras:guardarTiempos'`;
  - `biblioteca.guardarEstilo: 'biblioteca:guardarEstilo'`;
  - `biblioteca.marcarLista: 'biblioteca:marcarLista'`;
  - `app.guardadoPendiente: 'app:guardadoPendiente'`: el editor avisa de que tiene cambios sin escribir (cierre de la ventana, ADR 0010 §2).
- [x] **`CONTRATO`** en `ipc.ts`:
  - `letras.guardarTiempos`: `args: z.tuple([guardarTiemposSchema])`, `res: resumenCancionSchema`;
  - `biblioteca.guardarEstilo`: `args: z.tuple([idCancionSchema, estiloSchema])`, `res: resumenCancionSchema`;
  - `biblioteca.marcarLista`: `args: unId`, `res: resumenCancionSchema`;
  - `app.guardadoPendiente`: `args: z.tuple([z.boolean()])`, `res: z.void()`.
- [x] **`ApiShinobi`** con JSDoc:
  - `letras.guardarTiempos(peticion: GuardarTiempos): Promise<ResumenCancionIpc>`: "Sustituye tiempos y desplazamiento sin tocar el texto; LETRA_DESACTUALIZADA si la letra cambió";
  - `biblioteca.guardarEstilo(id: string, estilo: Estilo): Promise<ResumenCancionIpc>`: "Escribe al momento; el debounce lo hace el editor";
  - `biblioteca.marcarLista(id: string): Promise<ResumenCancionIpc>`;
  - `app.guardadoPendiente(pendiente: boolean): Promise<void>`.
  Y los cuatro métodos en el preload.
- [x] **Errores** (`shared/errores.ts`): `'LETRA_DESACTUALIZADA'` en `CODIGOS_ERROR` y en `CODIGOS_SOLO_MAIN`, con su explicación en el comentario: "la letra guardada ya no tiene los mismos elementos que envía el editor (0090/0091); el editor recarga". Si hay un test que compara `CODIGOS_ERROR` con `worker/shinobi_worker/errores.py` descontando `CODIGOS_SOLO_MAIN`, debe seguir pasando sin tocar el worker.
- [x] **Estilo** (`shared/estilo.ts`, deuda de 0006): `fondoDegradado` añade `.refine` o `superRefine` con el mensaje "Las paradas del degradado deben ir en orden de posición": exige que `paradas[i].posicion >= paradas[i-1].posicion`. Tests en `shared/estilo.test.ts`:
  - acepta `[0, 1]`, `[0, 1/3, 2/3, 1]` y `[0, 0.5, 0.5, 1]`;
  - rechaza `[1, 0]`.
  Además, la semilla (`main/biblioteca/semilla.ts`, `estiloVariado`) y las fixtures de `shared/__fixtures__` siguen validando: lo comprueban los tests que ya existen.
- [x] **Handlers** (`main/ipc/handlers.ts`):
  - `BibliotecaIpc` añade `guardarEstilo(id: string, estilo: Estilo): Promise<ResumenCancion>` y `marcarLista(id: string): Promise<ResumenCancion>`;
  - `LetrasIpc` añade `guardarTiempos(peticion: GuardarTiempos): Promise<ResumenCancion>`.
  `app.guardadoPendiente` llama a una dependencia nueva y opcional `DependenciasIpc.fijarGuardadoPendiente?(pendiente: boolean): void`, que 0104 conecta con el control de cierre; mientras tanto no hace nada. Los canales de biblioteca y letras se registran con `envolver` y devuelven `resumenParaRenderer(...)`. Sin servicio de letras, `letras.guardarTiempos` responde `ERROR_INTERNO`, como los demás canales `letras.*`.
- [x] **`ServicioBiblioteca.guardarEstilo(id, estilo)`** en `main/biblioteca/servicio.ts`:
  ```ts
  /** Autoguardado del estilo desde el editor (0090, ADR 0010 §2). */
  guardarEstilo(id: string, estilo: Estilo): Promise<ResumenCancion> {
    return this.actualizar(id, { estilo })
  }
  ```
  Escribe sin *debounce*: el *debounce* lo hace el editor (ADR 0010 §2). Test: el estilo queda en `cancion.json` y sale el evento `cancion`. Una canción inexistente o dañada da `ARGUMENTOS_NO_VALIDOS`, igual que `actualizar`.
- [x] **`ServicioLetras.guardarTiempos`**: solo un *stub* en esta tarea, que 0091 sustituye. Para que compile:
  ```ts
  async guardarTiempos(_p: GuardarTiempos): Promise<ResumenCancion> {
    throw new ErrorBiblioteca('ERROR_INTERNO', 'guardarTiempos: pendiente de 0091')
  }
  ```
  Si 0091 ya está hecha al empezar, no se toca.
- [x] **`main/index.ts`**: si `registrarIpc` recibe la biblioteca por una interfaz y hace falta pasar algo más, se cablea. Lo normal es que no haya que tocarlo.
- [x] **Tests de handlers** (`main/ipc/handlers.test.ts`):
  - validación: `offset_ms` fuera de ±30000, `tiempos` con un campo extra y estilo con `#FFF` → `ARGUMENTOS_NO_VALIDOS`;
  - éxito de los tres canales con dobles;
  - `marcarLista` propaga `ARGUMENTOS_NO_VALIDOS` del servicio.
- [x] **API falsa del editor** para los tests del renderer: `app/src/renderer/src/vistas/editor/fixturesApi.ts`. Sigue el estilo de `vistas/letra/fixturesApi.ts`.
  - `apiEditorFalsa(opciones)` devuelve `{ api: ApiShinobi parcial, llamadas: Array<{ metodo, args }>, emitirCambio(resumen), fallar(metodo, codigo, veces?) }` e implementa:
    - `biblioteca.listar`, `obtener`, `guardarEstilo`, `marcarLista` y `volverABorrador`;
    - `letras.guardarTiempos`, que aplica de verdad los tiempos sobre su copia y responde `LETRA_DESACTUALIZADA` si los ids no coinciden;
    - `config.obtener` y `config.actualizar`;
    - `app.guardadoPendiente` (solo registra la llamada);
    - `alCambiarCancion`, `trabajos.listar`, `trabajos.alCambiar` y `trabajos.alProgreso`.
  - Fixtures de `Cancion`, letras **inventadas** y duración de 30 s:
    - `cancionSinSincronizar()`: 6 líneas y una pausa, sin tiempos, pistas listas;
    - `cancionSincronizadaLrclib()`: origen `lrclib`, todas con inicio;
    - `cancionConPalabras()`: una línea con `palabras` y otra seguida de una pausa con inicio;
    - `cancionSeparando()`: `pasos.separacion.estado = 'en_curso'`, `progreso: 0.42`, `pistas: null`;
    - `cancionLista()`;
    - `cancionListaIncompleta()`.
  - Todas validan con `cancionSchema`, y un test lo comprueba.

## Verificación
```bash
cd app
npm run lint && npm run typecheck && npm run format:check
npx vitest run src/shared src/main/ipc src/main/biblioteca src/renderer/src/vistas/editor
```

## Notas de implementación
- Los cuatro canales del editor están tipados, validados en main y conectados en el preload. `guardarEstilo` escribe al momento y emite el resumen de la canción.
- `LETRA_DESACTUALIZADA` es exclusivo de main. Zod valida el orden no decreciente de las paradas del degradado.
- El doble `apiEditorFalsa` tiene seis canciones inventadas de 30 s, permite simular escrituras y fallos y emite cambios de biblioteca.
- Queda para la 0091 la escritura de tiempos. La 0104 conecta la señal de guardado pendiente con el cierre.
- Verificado con lint, TypeScript, formato, Vitest (1541 pasadas, 12 omitidas), build y Playwright (69 pasadas, 2 omitidas). Las suites que lanzan Electron o el worker se ejecutaron fuera del sandbox.
