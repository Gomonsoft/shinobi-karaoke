# 0015 — Sistema visual base: tokens, tipografía de interfaz, iconos y foco
- Estado: Pendiente
- Paso del pipeline: — (transversal)
- Depende de: 0002
- ADRs: 0002, 0007
- Spec UX: docs/ux/sistema-visual.md §1–§5 y §7

## Objetivo
Trasladar los tokens del sistema visual a CSS para que todas las vistas usen los mismos colores, tipografía, espaciado y foco.

## Criterios de aceptación
- [ ] `renderer/src/estilos/tokens.css` con variables CSS para **todos** los tokens de §2 (superficies, texto, acento, estados y sus fondos tenues), §3 (escala tipográfica `t-*` en `rem`), §4 (espaciado `e-1…e-8`, radios, elevación, duraciones de transición). Los nombres siguen los de la spec (`--fondo-0`, `--texto-1`, `--acento`, `--t-cuerpo`…).
- [ ] `base.css`: *reset* mínimo, `body` con `fondo-0`/`texto-1`/`t-cuerpo`, `font-variant-numeric: tabular-nums` en la clase de tiempos (`.t-tiempo`), anillo de foco de §7 solo con `:focus-visible` (y la variante doble para fondos arbitrarios), `prefers-reduced-motion` según §4, enlace "Saltar al contenido".
- [ ] **Atkinson Hyperlegible Next** 400/600/700 en WOFF2 dentro de `app/resources/fonts/atkinson-hyperlegible-next/` con su `OFL.txt` (descargada del repositorio oficial, sin modificar ni renombrar), declarada con `@font-face` (`font-display: block` para evitar saltos) y pila de respaldo de §3. Sin peticiones de red.
- [ ] `lucide-react` instalado; componente `Icono` (20 px por defecto, `currentColor`, `aria-hidden` salvo que reciba etiqueta).
- [ ] `THIRD_PARTY_NOTICES.md` actualizado con Atkinson Hyperlegible Next (OFL 1.1, *Reserved Font Name* si lo tiene) y Lucide (ISC).
- [ ] Página de desarrollo "Muestrario" (solo en `npm run dev`) con paleta, escala tipográfica y foco, para revisión visual del diseñador.
- [ ] Test que comprueba que cada token listado en una tabla de referencia existe en `tokens.css` (evita olvidos al sincronizar con la spec).

## Notas de implementación
(las rellena el programador al terminar)
