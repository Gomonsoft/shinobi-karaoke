# 0100 — Componentes base: popover con acciones y deuda de 0016 (diálogo `inert`, tooltip en los bordes, búsqueda por letra en menús)
- Estado: Pendiente
- Paso del pipeline: 4
- Depende de: — (**puede empezar ya**)
- ADRs: 0007
- Spec UX: docs/ux/sistema-visual.md §6 ("Acciones no disponibles", Tooltip, Menú contextual, Diálogo modal); docs/ux/06-editor.md ("Marcar como lista no disponible", `edi.hecho.incompleta`, tooltips de límite de 2 s; criterios 37, 39)
- Archivos: crea `app/src/renderer/src/componentes/Popover.tsx` y su test; modifica `Dialogo.tsx`, `Tooltip.tsx` y `MenuContextual.tsx` (con sus tests), y `componentes.module.css` y `vistas/Muestrario.tsx` (también los toca 0099: solo se añaden cosas). **No toca archivos compartidos de IPC ni App.tsx.**
- Paralelizable con: todas (con cuidado con 0099).

## Contexto para quien implementa
Deuda anotada en `docs/backlog.md` (Fase 1, "Componentes (0016)") y asignada a la Fase 5:
- el diálogo no marca el resto de la app como `inert`;
- el tooltip no se reposiciona en los bordes de la ventana;
- el menú no tiene búsqueda por letra.

El editor necesita además un **popover no modal con acciones**: el de "Para marcarla como lista falta:", el de `edi.hecho.incompleta` y el tooltip de límite que se muestra 2 s.

## Criterios de aceptación
- [ ] **`Popover`**:
  ```ts
  interface PopoverProps { abierto: boolean; ancla: RefObject<HTMLElement>; alCerrar(): void
    titulo?: string; children: ReactNode; etiqueta: string /* aria-label si no hay título */ }
  ```
  - en portal, colocado bajo o sobre el ancla con volteo (reutiliza `calcularPosicionMenu` o una función equivalente probada);
  - `role="dialog"` **sin** `aria-modal` (no bloquea el resto);
  - el contenido es enfocable;
  - Esc o un clic fuera → `alCerrar` y el foco vuelve al ancla (Esc con `preventDefault`, para que no lo trate el atajo global);
  - se anuncia con `aria-live` al abrir si el uso lo pide (prop `anunciar`).
- [ ] **`Tooltip`**:
  - prop `forzar` con duración opcional: `forzar={{ ms: 2000, clave }}` muestra el tooltip 2 s y vuelve a mostrarse con cada `clave` nueva (para los tooltips de límite del editor);
  - se reposiciona para no salirse de la ventana (izquierda, derecha y volteo arriba/abajo), con una función pura probada.
- [ ] **`Dialogo`**: al abrir, `inert` en los hermanos del portal raíz (el contenedor de la app); al cerrar se restaura. Con diálogos anidados, solo el superior queda activo. Test: un botón de la app no recibe el foco con Tab mientras el diálogo está abierto.
- [ ] **`MenuContextual`**: búsqueda por letra (*type-ahead*): pulsar una letra enfoca el siguiente ítem que empieza por ella, sin distinguir mayúsculas ni tildes.
- [ ] Los tests existentes de componentes siguen pasando; los E2E `menu-contextual.spec.ts` y `biblioteca-acciones.spec.ts` siguen en verde.

## Verificación
```bash
cd app
npm run lint && npm run typecheck && npm run format:check
npx vitest run src/renderer/src/componentes
export SHINOBI_UV=$(which uv)
npm run build && npx playwright test e2e/menu-contextual.spec.ts e2e/biblioteca-acciones.spec.ts
```

## Notas de implementación
(las rellena el programador al terminar)
