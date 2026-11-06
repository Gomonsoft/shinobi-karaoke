# 0121 — Reproductor desde la Biblioteca y desde el toast «lista para cantar» (capa a nivel de App)
- Estado: Pendiente
- Paso del pipeline: 6
- Depende de: 0119 (y 0120 para los errores; se puede empezar con 0119 y cerrar cuando 0120 esté)
- ADRs: 0011 (§4 "Capa de la Biblioteca", §5)
- Spec UX: docs/ux/07-reproductor.md (§"Entrada" filas Biblioteca y toast, §"Salida"; criterios 1–4, 22, 25); docs/ux/02-biblioteca.md ("▶ Reproducir", "Vuelta desde el reproductor", criterio 3); docs/ux/06-editor.md (criterio 38: toast con [▶ Reproducir]); docs/ux/00-mapa-de-vistas.md (vista 7 superpuesta)
- Archivos:
  - crea `app/src/renderer/src/navegacion/reproductor.tsx` (contexto + anfitrión) y su test, y `app/src/renderer/src/vistas/reproductor/ReproductorBiblioteca.tsx`;
  - **compartidos**:
    - `app/src/renderer/src/App.tsx` (proveedor y capa);
    - `app/src/renderer/src/navegacion/estado.ts` (quitar la variante `reproductor` de `Vista`, de `VISTAS_SIN_BARRA`, `VISTAS_CON_ESC`, `TITULOS_VISTA` y `claveVista`);
    - `app/src/renderer/src/navegacion/useAtajosGlobales.ts` (quitar la rama `reproductor`);
    - `app/src/renderer/src/vistas/biblioteca/Biblioteca.tsx` (+ `Biblioteca.test.tsx`; `acciones.reproducir`);
    - `app/src/renderer/src/vistas/editor/BotonLista.tsx` (+ `BotonLista.test.tsx`; acción del toast).
- Paralelizable con: 0120, 0122 (0122 toca `Editor.tsx`, no `BotonLista.tsx`). Debe ir **antes** de 0122 si las dos tocan `estado.ts` (0122 no debería).

## Contexto para quien implementa
- Hoy "▶ Reproducir" (tarjeta, portada, Intro, menú ⋯) hace `ir({ tipo: 'reproductor', id })` y `App.tsx` dibuja un `Marcador`. La spec pide que el reproductor se abra **encima** de la Biblioteca, que se queda montada (filtro, búsqueda y desplazamiento intactos). Por eso deja de ser una vista y pasa a ser una capa (ADR 0011 §4).
- Tras "Marcar como lista", `BotonLista.tsx` navega a la Biblioteca y muestra `mostrarToast({ tipo: 'exito', mensaje: '«…» está lista para cantar.' })` sin acción. Un toast con `accion` es persistente (no se cierra solo), y el contenedor lo cierra al pulsar la acción (comprueba `Toasts.tsx`).
- Las tarjetas llevan `data-tarjeta="<id>"` (`TarjetaCancion.tsx`).

## Objetivo
Cantar desde la Biblioteca con un clic, y desde el toast de "lista", volviendo a la Biblioteca tal como estaba.

## Criterios de aceptación
- [ ] **Contexto** `navegacion/reproductor.tsx`:
  ```ts
  export interface ControlReproductor { abrir(cancionId: string): void; abierto: string | null }
  export const ReproductorContexto: React.Context<ControlReproductor | null>
  export function useReproductor(): ControlReproductor
  export function CapaReproductor(): JSX.Element | null   // la dibuja App
  ```
  `App.tsx` envuelve la aplicación con el proveedor y dibuja `<CapaReproductor />` después de `<Marco>` (dentro de los contextos de navegación, trabajos y biblioteca). Abrir mientras ya hay uno abierto no hace nada.
- [ ] **`ReproductorBiblioteca`** (lo dibuja la capa):
  - lee `biblioteca.obtener(id)` y `config.obtener()` en paralelo y crea `useVolumenCompartido(config.reproductor)`;
  - si la canción no existe o no está `lista`, cierra la capa y muestra el toast existente «No se pudo abrir la canción.»;
  - mientras lee, dibuja ya el fondo del estilo y el título si los tiene (resumen de `useBiblioteca`), para cumplir < 200 ms;
  - monta `Reproductor` con `origen: 'biblioteca'`, `modo: 'karaoke'`, `desdeMs: 0` y `lineasSinSincronizar` del resumen;
  - `alFallarPista` con `tipo === 'no_encontrada'` (de la pista principal **o de la voz**, criterio 19d) llama a `biblioteca.comprobarPistas(id)` (la tarjeta pasa a Dañada por el evento `evento:cancion`); los otros tipos no llaman a nada;
  - `alSalir`: cierra la capa y, tras desmontarse, enfoca `[data-tarjeta="<id>"]` si existe (sin desplazar más de lo necesario: `focus({ preventScroll: false })`, y sin cambiar filtro ni búsqueda). Sin toast.
- [ ] **Navegación**:
  - `acciones.reproducir` de la Biblioteca llama a `useReproductor().abrir(id)`;
  - se elimina `{ tipo: 'reproductor' }` de `Vista` y de las listas y funciones de `estado.ts` y `useAtajosGlobales.ts`;
  - se actualizan los tests que lo esperaban (`Biblioteca.test.tsx` línea ~150 y los de navegación).
- [ ] **Toast**: `BotonLista.tsx` añade al toast `accion: { etiqueta: 'Reproducir', alAccionar: () => abrir(id) }` (texto e icono ▶ según `bib.toast.lista` de `ux/02`). Al pulsarla, el toast se cierra y el reproductor se abre sobre la Biblioteca.
- [ ] **Teclado**: con la capa abierta, Esc solo lo trata el reproductor, y Ctrl/Cmd+N, Ctrl/Cmd+, y el menú no navegan (la capa es `aria-modal`; test en `useAtajosGlobales` o `App.test.tsx`).
- [ ] **Toasts**: los que llegan con el reproductor abierto aparecen al cerrarlo (lo hace `retenerToasts` en 0119; test de integración con la API falsa: un aviso de trabajo durante la capa aparece al salir).
- [ ] Tests de componente con la API falsa:
  - clic en Reproducir → capa abierta y `modoReproductor(true)`;
  - Esc → capa cerrada, `modoReproductor(false)`, foco en la tarjeta y búsqueda conservada;
  - error `no_encontrada` → `comprobarPistas` llamado.

## Verificación
```bash
cd app
npm run lint && npm run typecheck && npm run format:check && npm test
npm run build && export SHINOBI_UV="$(which uv)" && npx playwright test
```

## Notas de implementación
(las rellena el programador al terminar)
