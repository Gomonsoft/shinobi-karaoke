# 0109 — Editor: "Marcar como lista", "Hecho", "Volver a borrador" y vuelta a la Biblioteca (resalte de 2 s, filtro y toasts)
- Estado: Pendiente
- Paso del pipeline: 5
- Depende de: 0090 (`biblioteca.marcarLista`), 0091, 0100 (`Popover`), 0103, 0104, 0105
- ADRs: 0006 (condiciones de "lista", `incompleta`), 0010 (§2; "Fuera de esta fase")
- Spec UX: docs/ux/06-editor.md ("Guardado, borrador y lista", "Volver a la Biblioteca tras Marcar como lista"; criterios 36–40); docs/ux/02-biblioteca.md ("Éxito tras marcar como lista", "Vuelta desde el editor", `bib.toast.lista`, `bib.dialogo.borrador`)
- Pregunta: `preguntas/0025` §1 (el toast `bib.toast.lista` sale **sin** [▶ Reproducir] hasta la Fase 6)
- Deuda que salda: resalte de 2 s y toast al volver del editor (0019/0020)
- Archivos:
  - crea `app/src/renderer/src/vistas/editor/BotonLista.tsx` (+ test) y `textos` en `textos.ts`;
  - **compartidos**: `app/src/renderer/src/navegacion/estado.ts` (el tipo `Vista` de la Biblioteca recibe `enfocar`) y `app/src/renderer/src/vistas/biblioteca/Biblioteca.tsx` (+ test);
  - en `Editor.tsx`, conectar el primario y el menú ⋯.
- Paralelizable con: 0106–0108.

## Contexto para quien implementa
- `motivosParaNoEstarLista(cancion)` y `puedeMarcarseLista` (`shared/derivados.ts`) dan los motivos `SIN_PISTAS` y `LINEAS_SIN_INICIO` (con los números de línea). El estado de la separación (en curso con %, en cola, pendiente o error) sale del resumen y de `useTrabajosVivos()`.
- `biblioteca.marcarLista(id)` (0090) valida de nuevo en el main. `biblioteca.volverABorrador(id)` ya existe.
- La guarda de salida y `vaciar()` son de 0104. El editor no navega sin vaciar.
- La Biblioteca guarda el filtro a nivel de módulo (`vistas/biblioteca/Biblioteca.tsx`, tarea 0020). Las tarjetas son enfocables. Los toasts se muestran con `mostrarToast` (`componentes/gestorToasts.ts`) y son globales.

## Criterios de aceptación
- [ ] **Vista**: `{ tipo: 'biblioteca'; enfocar?: { id: string; resaltar: boolean } }`. `claveVista` no cambia.
- [ ] **Biblioteca** con `enfocar`:
  - si el filtro de la sesión es *Borradores* y la canción ya es Lista, pasa a *Todas*;
  - la tarjeta se desplaza a la vista y recibe el foco;
  - con `resaltar`, borde de 2 px `exito` durante 2 s con 200 ms de fundido (sin fundido con `prefers-reduced-motion`);
  - el resto de la Biblioteca no cambia.
  Tests en `Biblioteca.test.tsx`.
- [ ] **Marcar como lista** (borrador):
  - disponible si la separación está completada, hay ≥ 1 línea y todas tienen inicio;
  - al pulsar: `vaciar()` → `marcarLista(id)` → `ir({ tipo: 'biblioteca', enfocar: { id, resaltar: true } })` + toast `bib.toast.lista` "«{título}» está lista para cantar." **sin acción** (Fase 6);
  - si `vaciar` o `marcarLista` fallan: toast de error con [Copiar detalles] y no navega.
- [ ] **No disponible**:
  - `aria-disabled="true"` y sigue siendo enfocable;
  - al pulsarlo o enfocarlo con el teclado, `Popover` `edi.falta.titulo` con un renglón por motivo:
    - `edi.falta.separando` con el % y "quedan unos {m} min" (si hay ETA);
    - `edi.falta.cola`;
    - `edi.falta.separar` con [Ir a Separación] (navega al paso `progreso`);
    - `edi.falta.lineas` con [Ir a la primera] / "[Ir a ella]" con 1, que selecciona la primera sin inicio, la desplaza a la vista y enfoca la lista;
  - se actualiza en vivo y se cierra con Esc o con un clic fuera.
- [ ] **Hecho** (Lista):
  - vuelve con `enfocar: { id, resaltar: false }`, sin toast;
  - si está incompleta, la **primera** pulsación de la visita abre el popover `edi.hecho.incompleta` (singular y plural) con [Sincronizar ahora] (cierra y selecciona la primera sin inicio) y [Salir igualmente]; la segunda sale directamente.
- [ ] **‹ Biblioteca y demás salidas siendo borrador**: si `cambiosEnVisita` (*reducer*) es `true`, toast `edi.toast.borrador` "Borrador guardado." al llegar a la Biblioteca; si no, ninguno. Se resuelve en la guarda de salida (0104) cuando el destino es la Biblioteca.
- [ ] **Volver a borrador…** (⋯, solo Lista):
  - diálogo `bib.dialogo.borrador` (reutiliza `DialogoConfirmar` de `vistas/biblioteca/DialogosCancion.tsx`);
  - al confirmar, `volverABorrador(id)` y se queda en el editor: la insignia pasa a Borrador y el primario a "Marcar como lista";
  - letra y estilo no cambian.
- [ ] Insignia `edi.lista.incompleta` en vivo al borrar tiempos en una Lista (ya llega por `resumen.incompleta` y `lineasSinSincronizar`).
- [ ] Tests:
  - con la API falsa, cada motivo del popover y sus acciones;
  - marcar lista → `llamadas` en orden `guardarTiempos` (si había pendiente) → `marcarLista` → navegación con `enfocar`;
  - Hecho en una incompleta (dos pulsaciones);
  - volver a borrador;
  - toast de borrador solo con cambios.

## Verificación
```bash
cd app
npm run lint && npm run typecheck && npm run format:check
npx vitest run src/renderer/src/vistas/editor src/renderer/src/vistas/biblioteca
```

## Notas de implementación
(las rellena el programador al terminar)
