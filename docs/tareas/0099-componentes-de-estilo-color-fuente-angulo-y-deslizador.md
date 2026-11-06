# 0099 — Componentes base: selector de color, selector de fuente, dial de ángulo y deslizador
- Estado: Pendiente
- Paso del pipeline: 4
- Depende de: — (**puede empezar ya**); usa los *tokens* y componentes de 0015/0016
- ADRs: 0006 (fuentes incluidas), 0007 (sin librerías de UI)
- Spec UX: docs/ux/sistema-visual.md §6 (Selector de color, Selector de fuente, Control segmentado) y §8 (sugeridos); docs/ux/06-editor.md (panel D, "Volumen", criterios 28, 29, 43)
- Archivos: crea en `app/src/renderer/src/componentes/` `SelectorColor.tsx`, `SelectorFuente.tsx`, `DialAngulo.tsx` y `Deslizador.tsx`, con sus tests y estilos en `componentes.module.css`; añade ejemplos en `vistas/Muestrario.tsx`. **No toca archivos compartidos de IPC ni App.tsx.** `componentes.module.css` y `Muestrario.tsx` también los toca 0100: coordinad el orden o resolved el conflicto, que es solo de añadir.
- Paralelizable con: todas salvo 0100 (mismos archivos de estilo y muestrario; se puede ir en paralelo con cuidado).

## Contexto para quien implementa
- Componentes existentes que conviene copiar en estilo y API: `ControlSegmentado.tsx`, `Campos.tsx` (`CampoTexto` con etiqueta, ayuda y error con `aria-describedby`), `Tooltip.tsx` y `MenuContextual.tsx` (portal, volteo y teclado).
- Fuentes de karaoke: `FUENTES_REGISTRO` en `app/src/shared/fuentes.ts`, con `familia` y `peso`. Las `@font-face` ya están instaladas en el renderer.
- Un `<select>` nativo no muestra cada opción con su fuente en todas las plataformas: por eso el selector de fuente es un *listbox* propio.

## Criterios de aceptación
- [ ] **`SelectorColor`**:
  ```ts
  interface Props { etiqueta: string; valor: string; sugeridos: readonly string[]
    alCambiar(hex: string, origen: 'hex' | 'nativo' | 'sugerido'): void; id?: string }
  ```
  - muestra de 32 × 32 px que abre el `<input type="color">` nativo (oculto, asociado);
  - campo hex con validación `^#[0-9A-Fa-f]{6}$`: un valor inválido muestra borde `error` y "Usa el formato #RRGGBB.", y **no** llama a `alCambiar`; Esc restaura el valor;
  - 8 muestras sugeridas como `radiogroup` con nombre accesible = hex;
  - durante el arrastre del selector nativo (`input`) llama a `alCambiar` en cada evento (el *reducer* agrupa los cambios en un paso).
- [ ] **`SelectorFuente`**:
  - botón que abre un *listbox* en portal (como `MenuContextual`);
  - cada opción muestra su nombre y "¿Cantamos? Ñandú" en su propia `font-family` y `font-weight`;
  - teclado: ↑/↓, Inicio/Fin, búsqueda por letra, Intro y Esc;
  - `aria-activedescendant`;
  - `alCambiar(familia)`.
- [ ] **`DialAngulo`**:
  - campo numérico 0–359 (fuera de rango se ajusta con módulo 360) y dial circular arrastrable con `role="slider"`, `aria-valuemin=0`, `aria-valuemax=359`, `aria-valuenow`;
  - ←/→ ±15° y Mayús ±1°;
  - `alCambiar(grados, { arrastrando: boolean })`.
- [ ] **`Deslizador`**: `input type="range"` con estilo del sistema y `aria-valuetext` configurable; ↑/↓ y ←/→ ±5 %; lo usan el volumen (0–1) y la barra de tiempo del editor.
- [ ] Todos:
  - foco visible (§7);
  - objetivos ≥ 32 px;
  - sin dependencias nuevas;
  - tests con Testing Library: teclado, valor inválido, nombres accesibles, y que el selector de fuente aplica la familia a cada opción.

## Verificación
```bash
cd app
npm run lint && npm run typecheck && npm run format:check
npx vitest run src/renderer/src/componentes
npm run dev   # #/muestrario
```

## Notas de implementación
(las rellena el programador al terminar)
