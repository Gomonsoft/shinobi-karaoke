# 0213 — Pantalla de letra: fondo en movimiento, indicadores de espera y modo sin barrido

- Estado: Pendiente
- Paso del pipeline: 4–6
- Depende de: [0204](0204-geometria-del-fondo-y-css-de-los-tres-degradados.md), [0206](0206-derivacion-de-los-comodines-de-espera-en-el-fotograma.md)
- ADRs: [0018](../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md) §2, §3 y §5, [0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md#revisión-para-020--fase-5), [0011](../adr/0011-reproductor-pantalla-completa-y-reutilizacion-del-motor.md#revisión-para-020--fase-5)
- Spec UX: [07 · Fase 5](../ux/07-reproductor.md#fase-5-de-020--estilo-espera-y-letra-lista) (R1–R3, R5–R12) y [sistema visual · fase 5](../ux/sistema-visual.md#020--estilo-espera-y-letra-lista-fase-5)

## Objetivo

Que el render compartido (vista previa del editor, reproductor local, secundaria y, en la fase 6, la exportación) pinte el fondo en movimiento ligado al reloj, la barra y la cuenta en sus posiciones reservadas, y el modo sin barrido.

## Contrato

- **Props nuevas de `PantallaLetra`**:
  - `barrido: boolean`, por defecto `true`;
  - `fondoEstatico: boolean`, por defecto `false`;
  - `espera` llega ya en el contexto del render desde el estilo (0206).
- **Fondo**:
  - si `normalizarEstilo(estilo).fondo.movimiento` existe y no se da ninguno de estos casos: `fondoEstatico`, `prefers-reduced-motion: reduce` u ocultación del documento;
  - entonces, en el **mismo** `requestAnimationFrame` que escribe el barrido, se escriben `--k-fondo` (o las variables de geometría) con `fondoCssEn(fondo, tAudioMs, …)` de 0204;
  - el tiempo es el **de audio**, sin `offset_ms`, y procede de la función de tiempo que ya recibe el componente (si hoy recibe tiempo de letra, se añade la de audio o el `offset`);
  - sin movimiento, el CSS es el de siempre (G2);
  - sin animaciones CSS y sin temporizadores.
- **Indicadores**, siguiendo el sistema visual:
  - barra con ancho `40 % × (1 − fraccion)`, centrada, grosor `max(4px, 0.8vh)` y centro a `45 % − 0,9 × S`;
  - cuenta con tamaño `S`, centrada al 45 % y entrada con fundido y escala de 150 ms (sin ellos con movimiento reducido);
  - puntos como hoy;
  - color `color_resaltado`, o `letra.color` si `barrido === false`;
  - con posicionamiento absoluto en capas reservadas: **ninguna caja de línea cambia** (R5);
  - `aria-hidden`.
- **Anuncio**: un único `rep.espera.aria` por hueco entre versos de 2 s o más, cuando cambia `espera.clave` (al empezar o al buscar dentro). Nunca en la primera entrada ni en pausa. Se hace en una región `aria-live` que ya exista en el contenedor o que reciba el componente.
- **Sin barrido** (`barrido={false}`): no se monta la capa de resaltado ni se resalta por palabra. Tampoco en `fotogramaEstatico`. Transición entre líneas sin cambios.
- **Escritura por fotograma**: solo variables CSS. React no se vuelve a renderizar en cada fotograma, salvo los cambios de dígito o de estado de la espera, igual que hoy con los puntos.

## Archivos

`karaoke/PantallaLetra.tsx`, `karaoke/pantallaLetra.module.css` y sus pruebas. Si hace falta, un *hook* `karaoke/useMovimientoReducido.ts` compartido (mover el de `vistas/reproductor/sesion/` y reexportarlo).

## Criterios de aceptación

- [ ] R5: con 0, 1, 2 y 3 indicadores, las cajas de la línea actual y de la siguiente tienen las mismas coordenadas.
- [ ] R6: con 1000 px de ancho, la barra mide 400, 200 y 0 px (± 1 px).
- [ ] R7, R8, R10 y R11 en el componente.
- [ ] R12: con `barrido={false}` no existe la capa de resaltado y los indicadores tienen el color de la letra.
- [ ] R2 y R3 en el componente: con movimiento, la variable de fondo cambia entre dos tiempos. En pausa no cambia. Con `matchMedia` reducido o `fondoEstatico`, es la de la fase 0.
- [ ] G2: un estilo de 0.1.0 produce el mismo `--k-fondo` que antes.

## Pruebas de feedback

- Unitarias: `PantallaLetra.test.tsx` con reloj simulado (geometría de cajas en jsdom con las dimensiones simuladas que ya usan sus pruebas, colores, anuncios y movimiento reducido).
- E2E: ninguna propia. El E2E de [0219](0219-integracion-guia-manual-e-informe-de-la-fase-5.md) comprueba G6 (la misma geometría en editor y reproductor a t = 12,3 s) y R3 con movimiento reducido emulado.
- Críticos: sí (el reproductor forma parte del flujo principal).
- Manual (guía de la fase): legibilidad de la cuenta y la barra a 5 m en una TV y un proyector, fluidez en un equipo modesto con la secundaria y que el movimiento no maree.

## Notas de implementación
