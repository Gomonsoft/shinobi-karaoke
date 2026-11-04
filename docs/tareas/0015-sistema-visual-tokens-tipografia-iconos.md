# 0015 — Sistema visual base: tokens, tipografía de interfaz, iconos y foco
- Estado: Hecha
- Paso del pipeline: — (transversal)
- Depende de: 0002
- ADRs: 0002, 0007
- Spec UX: docs/ux/sistema-visual.md §1–§5 y §7

## Objetivo
Trasladar los tokens del sistema visual a CSS para que todas las vistas usen los mismos colores, tipografía, espaciado y foco.

## Criterios de aceptación
- [x] `renderer/src/estilos/tokens.css` con variables CSS para **todos** los tokens de §2 (superficies, texto, acento, estados y sus fondos tenues), §3 (escala tipográfica `t-*` en `rem`), §4 (espaciado `e-1…e-8`, radios, elevación, duraciones de transición). Los nombres siguen los de la spec (`--fondo-0`, `--texto-1`, `--acento`, `--t-cuerpo`…).
- [x] `base.css`: *reset* mínimo, `body` con `fondo-0`/`texto-1`/`t-cuerpo`, `font-variant-numeric: tabular-nums` en la clase de tiempos (`.t-tiempo`), anillo de foco de §7 solo con `:focus-visible` (y la variante doble para fondos arbitrarios), `prefers-reduced-motion` según §4, enlace "Saltar al contenido".
- [x] **Atkinson Hyperlegible Next** 400/600/700 en WOFF2 dentro de `app/resources/fonts/atkinson-hyperlegible-next/` con su `OFL.txt` (descargada del repositorio oficial, sin modificar ni renombrar), declarada con `@font-face` (`font-display: block` para evitar saltos) y pila de respaldo de §3. Sin peticiones de red.
- [x] `lucide-react` instalado; componente `Icono` (20 px por defecto, `currentColor`, `aria-hidden` salvo que reciba etiqueta).
- [x] `THIRD_PARTY_NOTICES.md` actualizado con Atkinson Hyperlegible Next (OFL 1.1, *Reserved Font Name* si lo tiene) y Lucide (ISC).
- [x] Página de desarrollo "Muestrario" (solo en `npm run dev`) con paleta, escala tipográfica y foco, para revisión visual del diseñador.
- [x] Test que comprueba que cada token listado en una tabla de referencia existe en `tokens.css` (evita olvidos al sincronizar con la spec).

## Notas de implementación
- **Qué se hizo**: tokens CSS completos de §2-§4 (`--fondo-0`, `--texto-1`, `--acento`, `--t-cuerpo` + `-lh`/`-peso`, `--e-1…8`, `--r-*`, `--elevacion`, duraciones), base con reset, clases `t-*` (incl. `.t-tiempo` tabular), foco `:focus-visible` (+ `.foco-doble`), `.saltar-al-contenido` y `prefers-reduced-motion`; Atkinson Hyperlegible Next 400/600/700 WOFF2 oficiales (googlefonts/atkinson-hyperlegible-next, `fonts/webfonts`) con `OFL.txt` (sin Reserved Font Name), `font-display: block`; `lucide-react` + `Icono`; avisos en `THIRD_PARTY_NOTICES.md`; Muestrario en `#/muestrario` solo con `import.meta.env.DEV` (lazy; no entra al bundle de producción).
- **Archivos clave**: `app/src/renderer/src/estilos/{tokens,base,fuentes,muestrario}.css`, `estilos/tokens.test.ts`, `componentes/Icono.tsx`, `vistas/Muestrario.tsx`, `App.tsx` (enlace de salto), `app/resources/fonts/atkinson-hyperlegible-next/`.
- **Cómo probarlo** (desde `app/`): `npm run lint`, `typecheck`, `test`, `test:e2e`; `npm run dev` y abrir la ventana con `#/muestrario` en la URL (revisión visual del diseñador).
- **Decisiones menores**: las fuentes se referencian por ruta relativa a `app/resources/` y Vite las empaqueta con hash (sin red). `Icono` usa trazo 1,75. Tokens extra no listados en la spec: `--fondo-3-hover` (#33384C, de §6), `--fuente-*`, `--margen-vista`, `--alto-boton*`, `--objetivo-minimo`. `body` tiene `min-width: 1024px` (tamaño mínimo de ventana §4).
- **Deuda técnica**: el Muestrario no se ha revisado en una ventana interactiva (solo build/tests); botones/campos del Muestrario son provisionales (los componentes reales llegan con cada vista); las otras familias de la letra (pregunta 0004) quedan para la fase del editor.
