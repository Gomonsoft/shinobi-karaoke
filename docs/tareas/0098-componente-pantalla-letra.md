# 0098 — Karaoke: componente `PantallaLetra` (render DOM/CSS compartido por vista previa y reproductor)
- Estado: Pendiente
- Paso del pipeline: 4 y 6
- Depende de: 0096
- ADRs: 0010 (§4), 0006 (estilo → CSS), 0005
- Spec UX: docs/ux/sistema-visual.md §7 (foco doble sobre fondos de canción) y §10 (toda la tabla); docs/ux/06-editor.md ("Vista previa", criterios 28 (< 100 ms) y 33); docs/ux/07-reproductor.md
- Archivos: crea `app/src/renderer/src/karaoke/PantallaLetra.tsx`, `pantallaLetra.module.css` y `PantallaLetra.test.tsx`; amplía `karaoke/estiloCss.ts` (ya tiene `fondoCss`). Muestra un ejemplo en `vistas/Muestrario.tsx` (solo desarrollo). **No toca archivos compartidos.**
- Paralelizable con: 0090–0097, 0099–0102.

## Contexto para quien implementa
- `fotogramaEn` y `fotogramaEstatico` (0096) dicen qué dibujar.
- Las 8 fuentes de karaoke están cargadas por `@font-face` desde `estilos/fuentesIncluidas.ts`. La familia es `estilo.letra.fuente.familia` y su peso, el del registro `FUENTES_REGISTRO` de `shared/fuentes.ts` (un solo peso por familia).
- El mismo componente dibuja la vista previa 16:9 del editor y, en la Fase 6, la pantalla completa: los tamaños de §10 son relativos **al alto del área**, así que se usan unidades de contenedor (`container-type: size`, `cqh` y `cqw`).

## Objetivo
Dibujar la letra con el estilo de la canción y los valores fijos de §10, a 60 fps, sin re-renderizar React por fotograma.

## Criterios de aceptación
- [ ] Props:
  ```ts
  interface PantallaLetraProps {
    letra: Letra; estilo: Estilo; duracionMs: number; titulo: string; artista: string
    /** Reproduciendo: devuelve el tiempo de AUDIO actual (ms); el componente resta letra.offset_ms. */
    obtenerTiempoAudio?: () => number
    /** En pausa: muestra fotogramaEstatico(letra, idEstatico). Se ignora si `reproduciendo`. */
    idEstatico?: string | null
    reproduciendo: boolean
    cuentaAtras?: 3 | 2 | 1 | null   // números grandes (ux/06 wireframe E): t-display × 2 en letra.color con la sombra de §10
    etiqueta?: string                 // p. ej. edi.probar.original (Fase 6), píldora de §10 "Aviso sobre el fondo"
    className?: string
  }
  ```
- [ ] Render:
  - fondo con `fondoCss(estilo.fondo)`;
  - línea actual centrada al 45 % del alto, con tamaño `clamp(32px, 7.5cqh, 140px)`;
  - siguiente al 70 % del tamaño, debajo, separada 0,6 × el tamaño actual, mismo color y sin transparencia;
  - interlínea 1,2, ancho máximo 88 % y `text-wrap: balance`;
  - si ocupa más de 2 renglones, el tamaño baja en pasos del 5 % hasta un mínimo del 75 % (con `ResizeObserver` y la altura medida); si ni así cabe, se permite un tercer renglón (se anota en las notas);
  - sombra `0 0.04em 0.12em rgba(0,0,0,0.55)`, sin contorno;
  - barrido de izquierda a derecha con `color_resaltado`, mediante una capa superpuesta recortada (`clip-path: inset(0 calc(100% - var(--progreso)) 0 0)`) o `background-clip: text`, por línea o por palabra;
  - la siguiente sube a la posición actual en 200 ms, de forma instantánea con `prefers-reduced-motion` (el barrido **no** se desactiva);
  - pantalla de título (título al tamaño actual, artista al 50 %) e indicador `●●●` en `color_resaltado`.
- [ ] **Bucle**: con `reproduciendo`, un `requestAnimationFrame` llama a `obtenerTiempoAudio()`, calcula `fotogramaEn` y solo actualiza variables CSS (`--progreso`, el progreso de cada palabra) y el texto cuando cambia `claveTransicion`. Sin `reproduciendo`, no hay bucle. Un cambio de `estilo`, `letra` o `idEstatico` se pinta en el siguiente fotograma (< 100 ms).
- [ ] Accesibilidad: el área es `aria-hidden="true"` (la descripción la pone quien la usa, `edi.previa.aria`) y admite el anillo de foco doble de §7 si se hace enfocable.
- [ ] `estiloCss.ts` añade `variablesEstilo(estilo): Record<string, string>` (`--k-color`, `--k-resaltado`, `--k-fuente`, `--k-peso`, `--k-fondo`) con test.
- [ ] Tests (jsdom, con `requestAnimationFrame` falso):
  - en pausa muestra la línea seleccionada a mitad;
  - con un reloj simulado, el texto cambia de línea y `--progreso` avanza;
  - la fuente y los colores salen del estilo;
  - con `matchMedia('(prefers-reduced-motion: reduce)')` no hay clase de transición;
  - al desmontar se cancela el `requestAnimationFrame`.
- [ ] Revisión visual en el Muestrario (`npm run dev` → `#/muestrario`): las 8 fuentes y una línea larga que se parte en 2 renglones. Se adjunta una captura en las notas.

## Verificación
```bash
cd app
npm run lint && npm run typecheck && npm run format:check
npx vitest run src/renderer/src/karaoke
npm run dev   # #/muestrario
```

## Notas de implementación
(las rellena el programador al terminar)
