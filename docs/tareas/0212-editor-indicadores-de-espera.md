# 0212 — Editor: sección «Indicadores de espera»

- Estado: Hecha
- Paso del pipeline: 4
- Depende de: [0202](0202-resolucion-de-apariencia-con-reemplazos-de-espera.md), [0203](0203-main-marcar-letra-lista-guardar-reemplazos-y-modalidad-en-la-sesion.md), [0209](0209-historial-del-editor-reemplazos-y-ajustar-silencios.md) y [0213](0213-pantalla-de-letra-fondo-en-movimiento-indicadores-y-sin-barrido.md) (para ver los indicadores en la vista previa y en el ejemplo). Se integra en `PanelEstilo.tsx` después de [0211](0211-editor-controles-de-degradado-y-movimiento.md).
- ADRs: [0018](../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md) §3, [0016](../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md#revisión-para-020--fase-5)
- Spec UX: [06 · IE · Indicadores de espera](../ux/06-editor.md#ie--indicadores-de-espera-feature-9) (IE1–IE7)

## Objetivo

Configurar los indicadores de espera de la canción o del tema, con herencia y cambio solo para la canción, y mostrar un ejemplo en la vista previa.

## Contrato

- **Componente nuevo** `vistas/editor/estilo/SeccionEspera.tsx`, entre «Letra» y el aviso de contraste. Comprende:
  - casillas Puntos, Barra y Cuenta 3·2·1;
  - «Antes de la primera línea», inactiva si no hay ningún indicador marcado;
  - «Silencio mínimo» como `spinbutton` de 1,0 a 60,0 s, con paso 0,5, Re Pág/Av Pág ±5 s y entrada con coma o punto redondeada a la décima. Fuera de rango se limita y muestra `edi.espera.umbral.rango`. Siempre editable;
  - resumen dinámico `edi.espera.resumen` (o `.ninguno`).
- **Modos**:
  - **D2**: los controles editan `estilo.espera` (acción `espera` de 0209).
  - **D1/D4**:
    - sin reemplazo: resumen corto y procedencia `edi.espera.origen.*` (de `procedenciaEspera`);
    - «Cambiar solo en esta canción» copia la espera efectiva a `reemplazos.espera`;
    - con reemplazo: controles editables, `edi.espera.propios` y «Usar los del tema» (`null`);
    - cada operación es un paso de deshacer y el foco se mueve según la spec.
  - **D3** (editar un tema): edita la espera del borrador del tema. Si la canción tiene espera propia, se muestra `edi.espera.d3.propios`.
- **«Ver un ejemplo»** (`vistas/editor/estilo/ejemploEspera.ts`, función pura más un reloj **local** de la vista previa, ADR 0018 §3):
  - construye en memoria una letra sintética a partir de la línea seleccionada y la siguiente, con un hueco de 6 s;
  - la vista previa la recorre una vez con la espera efectiva y la píldora `edi.espera.ejemplo.etiqueta`;
  - no suena audio, no mueve el cabezal y no entra en el historial;
  - se detiene con Esc, con cualquier tecla de transporte o al cambiar la selección;
  - pausa antes si estaba sonando;
  - anuncia el inicio y el fin;
  - respeta el movimiento reducido.
- **Anuncios**: `edi.espera.anuncio.propios` y los del ejemplo, en la región `aria-live` del editor.
- **Textos**: las claves `edi.espera.*`, en un bloque propio.

## Archivos

`vistas/editor/estilo/{SeccionEspera,ejemploEspera}.ts(x)` (nuevos), el montaje en `PanelEstilo.tsx`, la prop de ejemplo en la vista previa del editor y sus pruebas.

## Criterios de aceptación

- [x] IE1–IE6. IE1 en su parte de interfaz; la del render la cubren 0206 y 0213.
- [x] IE7 a 300, 360 y 480 px (solo por CSS y por el E2E existente de `temas-editor.spec.ts`; la comprobación visual queda para las capturas de 0218).
- [x] IE3, en el editor: el umbral de 6,0 s se refleja en la vista previa en un hueco de 5,9 s frente a uno de 6,0 s.

## Pruebas de feedback

- Unitarias:
  - `SeccionEspera.test.tsx`: D2, D1 sin y con reemplazo, D3 con aviso, `spinbutton` (teclado, coma y rango) e historial;
  - `ejemploEspera.test.ts`: la letra sintética da un hueco de 6 s con la espera efectiva y con la selección en la última línea.
- E2E: ninguna (IE4 y IE5 con `main` real los cubren las pruebas de 0202 y 0203 y la guía).
- Críticos: no.
- Manual (guía de la fase): sensación del ejemplo y legibilidad a 5 m.

## Notas de implementación

### Qué se hizo
- `vistas/editor/estilo/SeccionEspera.tsx`: casillas, «Antes de la primera línea» (inactiva sin indicadores), `spinbutton` «Silencio mínimo» (↑/↓ y [−]/[+] de 0,5 s, Re Pág/Av Pág de 5 s, coma o punto, redondeo a la décima, límite 1–60 s con `edi.espera.umbral.rango`), resumen, procedencia, «Cambiar solo en esta canción», «Usar los del tema», aviso de D3 y «Ver un ejemplo». El foco se mueve a la primera casilla o a «Cambiar solo…» tras cambiar de modo.
- `estilo/useEspera.ts`: `esperaVisible` (D3: la del borrador; resto: `esperaEfectiva` de 0215), `useControlEspera` (traduce a las acciones `espera` y `estilo_borrador` del historial, con los anuncios) y `useEjemploEspera` (reloj local de la vista previa; Esc, teclas de transporte, cambio de selección o empezar a sonar lo detienen; pausa antes si sonaba).
- `estilo/ejemploEspera.ts`: letra sintética de dos líneas con hueco de 6 s (la seleccionada y la siguiente; con la última, la anterior y ella).
- `PanelEstilo.tsx`: prop `espera?` y una línea para montar la sección entre «Letra» y el aviso de contraste. `Editor.tsx`: los hooks, `espera={controlEspera}` y la vista previa y la prueba a pantalla completa con el estilo con la espera efectiva (`estiloPrevia`), de modo que el reemplazo de la canción se ve también en la previa.
- Textos en bloque propio `estilo/textosEspera.ts` (`T_ESPERA`), no en `textos.ts`, para no chocar con 0214/0216.
- Pruebas: `SeccionEspera.test.tsx`, `ejemploEspera.test.ts`, `useEspera.test.ts`.

### Decisiones y desviaciones
- En el ejemplo el umbral se acota a 6 s (`min(umbral, 6 s)`) para que el hueco simulado siempre enseñe los indicadores aunque el silencio mínimo sea mayor.
- «Antes de la primera línea» no se simula en el ejemplo (el reloj empieza en la primera línea simulada).
- Una ráfaga de cambios del umbral en < 1 s es un paso (clave fija `espera.umbral` y la ventana del historial); cada casilla es un paso propio.
- Sin E2E propia (según la tarea). Se comprobó que `temas-editor.spec.ts` (panel Estilo a 300/360/480 px) y los críticos siguen pasando.

### A mano (guía de la fase)
- Sensación del ejemplo y legibilidad de la cuenta y la barra a 5 m.
- IE7 visual a 300, 360 y 480 px (la fila «Silencio mínimo» no se parte, sin scroll de página).
- IE5/IE4 con `main` real: editar en D3 con una canción con propios y otra sin ellos.
- Esc durante el ejemplo no debe volver a la Biblioteca (el oyente en captura lo consume).
