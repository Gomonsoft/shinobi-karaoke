# 0104 — Guardado del editor: autoguardado con *debounce*, vaciado al salir, diálogo si falla y cierre de la ventana
- Estado: Pendiente
- Paso del pipeline: 5
- Depende de: 0090 (canales), 0092 (`aPeticionTiempos`)
- ADRs: 0010 (§2 "Guardado y *debounce*" y "Cerrar la ventana"), 0006, 0008
- Spec UX: docs/ux/06-editor.md ("Guardado, borrador y lista": Autoguardado, Fallo al guardar, Salir del editor; `edi.dialogo.salir`, `edi.toast.errorguardar`; criterios 34, 35)
- Pregunta: `preguntas/0025` §4 (respondida)
- Archivos:
  - crea `app/src/renderer/src/vistas/editor/guardado.ts` (lógica pura con temporizadores inyectables), `useGuardadoEditor.ts` y sus tests, y `app/src/renderer/src/navegacion/salida.ts` (registro de guardas de salida y de vaciado);
  - **compartidos**: `app/src/renderer/src/App.tsx` (`navegar` pasa por la guarda), `app/src/renderer/src/navegacion/estado.ts` (tipo `Navegacion`), `app/src/renderer/src/navegacion/DialogoCierre.tsx` (vaciar antes de confirmar), `app/src/main/index.ts` y `app/src/main/cierre.ts` (guardado pendiente como "algo en curso").
- Paralelizable con: 0103 y las de dominio. **Antes de 0105** (la vista la usa).

## Contexto para quien implementa
- Canales (0090):
  - `letras.guardarTiempos({ cancionId, offset_ms, tiempos })`;
  - `biblioteca.guardarEstilo(id, estilo)`;
  - `app.guardadoPendiente(boolean)`.
  Los dos primeros escriben **al momento** en el main; el *debounce* lo hace el renderer (ADR 0010 §2). `letras.guardarTiempos` puede responder `LETRA_DESACTUALIZADA`.
- La navegación (`App.tsx`) es un `useState<Vista>` con `ir` en un contexto (`navegacion/estado.ts`). Todas las salidas pasan por ese `ir`: ‹ Biblioteca, logotipo, Esc global (`useAtajosGlobales`), stepper, Ctrl/Cmd+N y +, del menú, y los toasts de avisos (`useAvisosTrabajos`).
- Cierre de la ventana (`main/cierre.ts`, 0036/0073):
  - si `hayAlgoEnCurso()`, el main cancela el `close` y envía `app:solicitudCierre`;
  - `DialogoCierre.tsx` responde con `app.confirmarCierre()` (al momento si no hay trabajos, o tras preguntar si los hay).

## Objetivo
Que ningún cambio del editor se pierda al salir por cualquier vía ni al cerrar la ventana, con un indicador fiable y reintentos.

## Criterios de aceptación
- [ ] **`guardado.ts`**: clase `GuardadoEditor`:
  ```ts
  new GuardadoEditor({ cancionId, api: { guardarTiempos, guardarEstilo }, debounceMs = 1000, maxEsperaMs = 2000, reintentoMs = 5000,
    temporizador?: { setTimeout, clearTimeout }, alEstado(e: { estado: 'guardado' | 'guardando' | 'error'; error?: ErrorIpc }): void,
    alDesactualizada(): void })
  cambiarLetra(letra: Letra): void     // marca pendiente la parte de tiempos
  cambiarEstilo(estilo: Estilo): void  // marca pendiente el estilo
  vaciar(): Promise<boolean>           // envía YA lo pendiente y espera; true si todo quedó escrito
  hayPendiente(): boolean
  destruir(): void
  ```
  - envía tras `debounceMs` sin cambios, o como mucho a `maxEsperaMs` del primer cambio pendiente;
  - cada envío lleva la **última** instantánea; tiempos y estilo se envían a la vez si ambos están pendientes;
  - nunca hay dos envíos del mismo tipo en vuelo: si llega un cambio durante el envío, se reenvía al terminar;
  - estado `guardando` mientras haya algo pendiente o en vuelo, y `guardado` cuando no;
  - si falla: `error`, reintento cada `reintentoMs` con la última instantánea y un solo aviso por racha (el toast lo muestra el hook);
  - con `LETRA_DESACTUALIZADA` no reintenta: llama a `alDesactualizada()` y descarta los tiempos pendientes (el estilo se sigue guardando);
  - `vaciar` con un fallo → `false`.
- [ ] **`useGuardadoEditor(cancionId, titulo)`**:
  - envuelve la clase y expone `{ estado, cambiarLetra, cambiarEstilo, vaciar }`;
  - muestra el toast `edi.toast.errorguardar` "No se pudieron guardar los cambios de «{título}». Lo seguimos intentando." con [Copiar detalles] (copia `codigo: mensaje`) una vez por racha;
  - llama a `window.shinobi.app.guardadoPendiente(true|false)` cuando cambia `hayPendiente() || error`;
  - registra la guarda de salida y el vaciado de cierre (siguientes puntos) y los quita al desmontar.
- [ ] **Guarda de salida** (`navegacion/salida.ts` + `App.tsx` + `estado.ts`):
  - `Navegacion` añade `registrarGuardaSalida(fn: (destino: Vista) => Promise<boolean>): () => void`;
  - el `navegar` de `App` espera a la guarda registrada (si la hay) antes de cambiar de vista; con `false` no navega;
  - la guarda del editor llama a `vaciar()`. Si `true`, navega. Si `false`, muestra el diálogo `edi.dialogo.salir` (título "No se pudieron guardar los últimos cambios.", texto "Si sales ahora, perderás lo que has cambiado en los últimos segundos.", [Quedarme en el editor] con el foco inicial y [Salir sin guardarlos] destructivo), y solo navega con el segundo;
  - no se piden otras confirmaciones.
- [ ] **Cierre de la ventana**:
  - `salida.ts` exporta `registrarVaciadoAlCerrar(fn: () => Promise<boolean>)` y `vaciarAlCerrar(topeMs = 2000): Promise<void>` (espera al vaciado o al tope, lo que llegue antes);
  - `DialogoCierre.tsx` llama a `await vaciarAlCerrar()` justo antes de cada `app.confirmarCierre()`;
  - en el main, `DependenciasIpc.fijarGuardadoPendiente` (0090) guarda un booleano, y `hayAlgoEnCurso` del control de cierre lo incluye (`main/index.ts`).
  Así una ventana con cambios pendientes y sin trabajos pide `solicitudCierre`, el renderer vacía (≤ 2 s) y confirma. Con trabajos se ve antes el diálogo de 0073.
  - Test en `cierre.test.ts`: con guardado pendiente, `alCerrarVentana` cancela el evento y pide confirmación.
- [ ] Tests de `guardado.ts` con temporizadores falsos:
  - *debounce* de 1 s;
  - espera máxima de 2 s con cambios continuos;
  - última instantánea gana;
  - fallo, reintento a los 5 s y recuperación;
  - `LETRA_DESACTUALIZADA`;
  - `vaciar` con y sin fallo;
  - un cambio en vuelo se reenvía.
- [ ] Test de `App`/navegación: con una guarda que devuelve `false`, `ir` no cambia la vista; con `true`, sí.

## Verificación
```bash
cd app
npm run lint && npm run typecheck && npm run format:check
npx vitest run src/renderer/src/vistas/editor src/renderer/src/navegacion src/renderer/src/App.test.tsx src/main/cierre.test.ts
```

## Notas de implementación
(las rellena el programador al terminar)
