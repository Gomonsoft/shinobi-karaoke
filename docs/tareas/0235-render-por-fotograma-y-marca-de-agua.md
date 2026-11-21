# 0235 — Render por índice de fotograma y marca de agua

- Estado: Pendiente
- Paso del pipeline: 6
- Depende de: [0230](0230-contratos-compartidos-de-la-exportacion.md), [0234](0234-ventana-offscreen-de-exportacion-y-rol.md); de la fase 5, [0204](0204-geometria-del-fondo-y-css-de-los-tres-degradados.md) (`geometriaFondoEn`), [0206](0206-derivacion-de-los-comodines-de-espera-en-el-fotograma.md) (`FotogramaLetra.espera`) y [0213](0213-pantalla-de-letra-fondo-en-movimiento-indicadores-y-sin-barrido.md) (`PantallaLetra` con fondo por fotograma y `barrido={false}`) ([ADR 0018](../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md) §2, §3 y §5). Toca el mismo `PantallaLetra.tsx` que 0213: empieza cuando 0213 esté integrada
- ADRs: [0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md) §2, [0011](../adr/0011-reproductor-pantalla-completa-y-reutilizacion-del-motor.md#revisión-para-020--fase-6), [0005](../adr/0005-letras-y-formato-de-sincronia.md#revisión-para-020--fase-6)
- Spec UX: [10](../ux/10-exportacion.md) §«Qué contiene el video» y §«Marca de agua»; [sistema visual](../ux/sistema-visual.md#020--exportación-de-video-fase-6)

## Objetivo

Que el mismo `PantallaLetra` pinte el fotograma `n` de forma determinista y que el anfitrión de exportación añada la marca de agua.

## Contrato

- `karaoke/PantallaLetra.tsx`: prop `tiempoFijoMs` (tiempo de audio). Con ella no hay `requestAnimationFrame`: en el mismo paso síncrono calcula `fotogramaEn(letra, tiempoFijoMs − offset_ms, ctx)`, aplica el barrido y escribe la geometría del fondo con `geometriaFondoEn(fondo, tiempoFijoMs, { estatico: false })`. Prop `movimiento: 'completo' | 'reducido'` explícita; el CSS de la entrada de línea deja de depender solo de la _media query_ (atributo de datos). Editor y reproductores no cambian de comportamiento.
- `karaoke/animacionesPorFotograma.ts`: controlador que, tras cada render, pausa las animaciones nuevas de `document.getAnimations()`, anota su fotograma de nacimiento y fija `currentTime = (n − n₀) × 1000 / fps`.
- `renderer/src/exportacion/`: `AppExportacion` lee `shinobiExportacion.inicial()`, espera `document.fonts.load` de la familia de la letra y de Atkinson Hyperlegible Next 700, monta `PantallaLetra` (`barrido={false}` con `letra_lista`, `movimiento='completo'`) y `MarcaDeAgua`; en cada `exportacion:fotograma` pinta, aplica el controlador, espera 2 × `requestAnimationFrame` y llama a `listo({ n })`. Expone en desarrollo el `FotogramaLetra` del último `n` para las pruebas.
- `MarcaDeAgua`: valores exactos de la spec 10 (posición, cuerpo `máx(14 px, 2,2 % del alto)`, píldora, opacidad 85 %), sin animación.

## Criterios de aceptación

- [ ] Para `n` muestreados (título, `●●●`/comodines, mitad de barrido, palabra a palabra, fin de línea, hueco, desplazamiento negativo y positivo), el modelo pintado coincide con `fotogramaEn(letra, n × 1000 / fps − offset)` (V17).
- [ ] Pintar el mismo `n` dos veces da el mismo DOM; pintar `n` sin pasar por `n − 1` da lo mismo que en orden (incluida la entrada de línea a mitad de sus 200 ms).
- [ ] Con «Letra lista» no hay capa de resaltado (V18). Con `prefers-reduced-motion` activo en el sistema, la entrada de línea y el fondo se mueven igual (`movimiento='completo'`).
- [ ] La marca de agua tiene la misma geometría relativa a 640 × 480 y a 3840 × 2160 y no se superpone a la franja de la letra (V19).

## Pruebas de feedback

- Unitarias: `PantallaLetra.test.tsx` (modo fotograma, sin `requestAnimationFrame`), `animacionesPorFotograma.test.ts` con animaciones falsas, `MarcaDeAgua.test.tsx`, `AppExportacion.test.tsx` contra la API falsa.
- E2E: ninguna propia (la cubre 0241).
- Críticos: no (no toca `main/`, `preload/` ni `shared/`), salvo que cambie el editor o el reproductor: entonces sí.
- Manual: calidad visual (M1) en la guía de la fase.

## Notas de implementación
