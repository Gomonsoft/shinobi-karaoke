# 0276 — Componente «ventana flotante» no modal

- Estado: Hecha
- Paso del pipeline: 4 (editor)
- Fase: 9 de 0.2.1 · Lote F (ventana del editor preciso), primera del lote
- Depende de: —
- ADRs: [0021](../adr/0021-sincronia-simplificada-y-editor-preciso-de-linea.md) §9 («Ventana flotante no modal»)
- Spec UX: [06 · Fase 9, «La ventana»](../ux/06-editor.md#la-ventana) (tabla de aspecto, mover, cambiar el tamaño, recordar, por debajo del mínimo, entrada) y «Foco»; criterios **P2**, **P3** y **P4** (parte del componente); [sistema visual · 0.2.1](../ux/sistema-visual.md#021--sincronía-editor-preciso-y-barra-de-carga-fases-8-y-9) (fila «Ventana flotante»)
- Tamaño: M

## Objetivo

Un componente genérico y probado de subventana tipo Adobe (sin contenido del editor preciso), para que 0278 solo rellene su interior.

## Archivos (solo estos)

- `app/src/renderer/src/componentes/VentanaFlotante.tsx`, `ventanaFlotante.module.css` y `VentanaFlotante.test.tsx` (nuevos)
- `app/src/renderer/src/componentes/geometriaVentana.ts` y su test (nuevos: funciones puras de posición inicial, acotado y teclado)

## Criterios de aceptación

- [ ] `role="dialog"`, `aria-modal="false"`, `aria-labelledby` al título; sin velo; por encima de los paneles y por debajo de diálogos modales, menús, popovers y toasts.
- [ ] Barra de título de 40 px con asa `grip-vertical` («Mover la ventana», `edi.preciso.mover`), título y una ranura de botones; asa de tamaño de 16 × 16 (objetivo 24 × 24, «Cambiar el tamaño de la ventana»).
- [ ] Mover arrastrando la barra (captura de puntero) y con flechas sobre el asa (16 px, Mayús 64 px, Inicio = posición inicial); cambiar el tamaño con el asa y con flechas (±16/64, Inicio = tamaño inicial); doble clic en la barra = posición y tamaño iniciales. Siempre entera dentro del área que recibe (`limites: DOMRect`), entre el mínimo y el máximo (área − 16 px por lado).
- [ ] Posición inicial según la spec (arriba + 12 px, junto al borde derecho de un elemento de referencia + 12 px, desplazada o centrada si no cabe, nunca sobre la cabecera); función pura `posicionInicial(area, referencia, tamano)`.
- [ ] Prop `preferencia` + `alCambiarPreferencia` (al soltar o tras una ráfaga de teclado); si la preferencia no cabe, se dibuja recolocada sin llamar a `alCambiarPreferencia`.
- [ ] Por debajo del mínimo de diseño: ancho del área − 16 px por lado, alto disponible, *scroll* interno, sin mover. No produce *scroll* de página (P4).
- [ ] **Foco**: Tab cicla dentro de la ventana; F6 / Mayús + F6 llaman a `alSalirDelFoco` / devuelven el foco al último elemento interno; un clic fuera no la cierra; marca su contenedor con `data-ventana-flotante` para que los atajos del editor la ignoren (ADR 0021 §9).
- [ ] Fundido de entrada de 120 ms, sin él con movimiento reducido.

## Pruebas de feedback

- Unitarias: `geometriaVentana.test.ts` (posición inicial, acotado, mínimo y máximo, teclado), `VentanaFlotante.test.tsx` (roles, Tab, F6, arrastre simulado, preferencia).
- E2E: ninguna (la cubre 0280).
- Críticos: no.
- Manual: guía de la fase 9 — mover y redimensionar es cómodo en 1366 × 768.

## Notas de implementación

Hecho. Archivos: `app/src/renderer/src/componentes/VentanaFlotante.tsx`, `ventanaFlotante.module.css`, `geometriaVentana.ts` y sus tests.

**API para 0279** (`<VentanaFlotante>` se pinta en un portal sobre `document.body`, `position: fixed`, z-index 20):
- `titulo` (contenido del `h2`), `botones` (ranura de la barra: Anterior, Siguiente, ✕; no arrastra), `children`.
- `limites: Area` (`{left, top, width, height}`; un `DOMRect` sirve): área del editor bajo la cabecera, en coordenadas de ventana. Si cambia, la ventana se reacota sola.
- `referencia?: Area | null`: la lista de líneas (se coloca a su derecha + 12 px).
- `preferencia?: Geometria | null` (`{x, y, ancho, alto}` con `x`/`y` **relativas a la esquina superior izquierda de `limites`**) y `alCambiarPreferencia(g)` (al soltar, tras ráfaga de teclado de 400 ms, o doble clic en la barra, que emite la geometría inicial). `preferencia = null` (p. ej. tras «Restablecer distribución») vuelve a inicial.
- `alSalirDelFoco()`: F6 con el foco dentro. F6 con el foco fuera (y sin diálogo modal) la componente devuelve el foco sola al último interno; `ref` (`VentanaFlotanteApi`): `enfocarUltimo()` y `elemento()`.
- Contenedor con `data-ventana-flotante` (`ATRIBUTO_VENTANA_FLOTANTE`); los atajos del editor deben ignorar eventos con `target.closest('[data-ventana-flotante]')` (los eventos React burbujean por el portal).
- Textos por defecto: «Mover la ventana», «Cambiar el tamaño de la ventana» (sobrescribibles por prop). No gestiona Esc salvo para cancelar un arrastre; el foco inicial y el cierre son del contenedor.
- Tamaños de diseño en `rem` (760 × 440 / 560 × 360 con `rem = 16`), leídos de la fuente raíz.

**Pruebas**: Vitest `VentanaFlotante.test.tsx` (11) y `geometriaVentana.test.ts` (8), pasan. prettier y eslint limpios; typecheck sin errores en estos archivos (hay errores ajenos de e2e por otros lotes).

**Manual**: mover y redimensionar es cómodo en 1366 × 768 y sin scroll de página a 560 px (guía de la fase 9).

**Deuda**: la preferencia usa `x`/`y` relativas al área; 0273 debe guardarlas tal cual (solo habla de px CSS).

