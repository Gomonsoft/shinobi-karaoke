# 0158 — Transporte en dos filas y panel angosto

- Estado: Hecha
- Paso del pipeline: 4
- Depende de: spec de la subfase 2.1 (puede ir en paralelo con 0154, 0155, 0156 y 0157; ver «Coordinación»)
- ADRs: [0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md)
- Specs: [Editor, subfase 2.1](../ux/06-editor.md#subfase-21--layout-adaptable-y-paneles) («Dock inferior», «Panel angosto», «Microcopy»)
- Plan: [Subfase 2.1, punto 2](../versiones/0.2.0/plan-2.md#subfase-21--estabilización-del-editor) · [Reporte](../versiones/0.2.0/reporte-editor-fase-2.md)

## Objetivo

- **Transporte** siempre en dos filas desde 1024 px, sin partirse:
  - Fila 1: ⏮ · ▶/❚❚ · tiempo · barra de tiempo flexible (mínimo 240 px) · Velocidad · volumen.
  - Fila 2: Escuchar · hueco · «Sincronizar al ritmo (S)» · primario.
  - «Cargando audio…» sustituye al tiempo.
  - Filas de 36 px. En compacto (`@media (max-height: 799.98px)`), controles de 32 px y relleno de 4 px.
- **Desplazamiento de toda la letra** en una sola fila con el título una única vez: `role="group"` con `aria-labelledby` al `h3`, campo sin etiqueta visible con el nombre `edi.offset.campo` y `aria-describedby` a la ayuda, y Restablecer como botón icono `rotate-ccw` de 36 × 36 (`edi.offset.restablecer`, inactivo con 0). Los mensajes de error y de límite van debajo, sin mover la fila.
- Regla del panel entre 300 y 480 px: ningún encabezado se repite como etiqueta visible, y las filas de Inicio, Fin y desplazamiento no se parten.

## Coordinación (evitar choques)

- Mover las reglas del transporte (`.transporte`, `.transporteFila`, `.transporteAcciones`, `.grupoTransporte`, `.volumen`, `.barraTiempo`, `.ticks` y las *media queries* que las afectan) de `editor.module.css` a un `transporte.module.css` nuevo. `BannerSincronizar.tsx` usa `.transporteFila`: actualizar su importación (solo esa línea).
- Conservar de momento `position: sticky` en `.transporte`. Lo retira 0157 al crear el dock.
- En `editor.module.css` solo se tocan el bloque del transporte (que se borra) y `.desplazamiento`/`.ajustesTiempo`. 0157 se encarga de las reglas de layout. Quien integre en segundo lugar resuelve un conflicto de *hunks* distintos.
- Nada en `Editor.tsx`. Si hiciera falta una prop nueva, que sea opcional con un valor por defecto compatible.

## Archivos

- `app/src/renderer/src/vistas/editor/Transporte.tsx`, `transporte.module.css` (nuevo), `Transporte.test.tsx` (nuevo).
- `app/src/renderer/src/vistas/editor/PanelSincronia.tsx`, `PanelSincronia.test.tsx`. Hoy el título se repite porque `CampoTiempo` recibe `etiqueta={E.offsetTitulo}` y lo pinta como etiqueta visible.
- `app/src/renderer/src/vistas/editor/CampoTiempo.tsx`, `CampoTiempo.test.tsx`: opción para dar nombre accesible sin etiqueta visible (`etiquetaOculta` o `aria-label`) y `aria-describedby`. Inicio y Fin conservan su etiqueta visible.
- `app/src/renderer/src/vistas/editor/BannerSincronizar.tsx` (importación del estilo).
- `app/src/renderer/src/vistas/editor/editor.module.css` (solo los bloques indicados).
- `app/src/renderer/src/vistas/editor/textos.ts`: añadir `edi.offset.campo` y `edi.offset.restablecer` en un bloque propio.

## Criterios de aceptación

- [ ] Vitest: el transporte tiene exactamente dos filas con los controles en el orden de la spec. «Cargando audio…» ocupa el lugar del tiempo sin añadir fila.
- [ ] Vitest: «Desplazamiento de toda la letra» aparece una sola vez en el DOM del panel. El grupo tiene `role="group"` y `aria-labelledby` al `h3`. El campo tiene el nombre `Segundos de desplazamiento` y la descripción `edi.offset.ayuda`. Restablecer está inactivo con 0 y deja el valor en 0, por la misma operación `fijarDesplazamiento(0)` de hoy.
- [ ] E2E (en `e2e/editor-layout.spec.ts` si 0157 ya está integrada; si no, un caso en un spec nuevo `e2e/editor-panel.spec.ts`): a 1024 y 1280 px de ancho, las dos filas del transporte tienen todos sus controles con el mismo `top` por fila, la barra de tiempo mide ≥ 240 px y los cuatro controles del desplazamiento comparten `top`. El criterio 20 a 300, 360 y 480 px se verifica en 0162, cuando ya existan los divisores.
- [ ] Atajos `,` `.` `S` `Espacio` y el resto del transporte sin cambios (`editor.spec.ts` en verde).

## Verificación

Desde `app/`: `npm test -- src/renderer/src/vistas/editor`, `npm run lint`, `npm run typecheck` y `npm run test:e2e -- e2e/editor.spec.ts` más el spec del caso nuevo.

## Notas de implementación

- Hecho: `transporte.module.css` (nuevo, con las reglas movidas de `editor.module.css`; controles de 32 px en compacto con `--alto-boton`), `Transporte.tsx` en dos filas fijas (fila 1: ⏮, ▶/❚❚, tiempo o «Cargando audio…», barra de tiempo de mínimo 15 rem, Velocidad y volumen; fila 2: Escuchar, hueco, «Sincronizar al ritmo (S)» y primario), prop opcional `sincronizando` en lugar de `bannerSync` (el banner lo coloca el dock en 0157). `PanelSincronia.tsx`: `role="group"` con `aria-labelledby` al `h3`, campo sin etiqueta visible (`edi.offset.campo`) con `aria-describedby` a la ayuda, fila única −0,1 s · campo de 5,5 rem · +0,1 s · Restablecer como `BotonIcono` `rotate-ccw` (`edi.offset.restablecer`, inactivo con 0; misma operación `fijarDesplazamiento(0)`). Los errores del campo se superponen bajo la fila (`position: absolute` + margen reservado con `:has`) para no moverla.
- `CampoTiempo` (`etiquetaOculta`, `describedBy`) y `CampoTexto`/`Envoltorio` en `componentes/Campos.tsx` (`etiquetaOculta`; el `aria-describedby` externo se suma al del propio campo). `textos.ts`: `offsetCampo` y `offsetRestablecer` en un bloque propio.
- Desviación de coordinación: `BannerSincronizar.tsx` ya no usa `.transporteFila`, sino `.filaBanner`, definida junto a `.bannerSync` en `editor.module.css` (más simple que importar otro módulo para una fila con salto de línea). Se tocó `Editor.tsx` (0157 ya lo reescribía) para pasar `sincronizando`.
- Pruebas: `Transporte.test.tsx` (3), `PanelSincronia.test.tsx` (+2), `CampoTiempo.test.tsx` (+1), y los casos de 1024 y 1280 px en `e2e/editor-layout.spec.ts`. El criterio 20 a 300, 360 y 480 px queda para 0162.
