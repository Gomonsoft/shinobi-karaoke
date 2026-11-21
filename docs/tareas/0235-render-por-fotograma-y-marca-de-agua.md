# 0235 — Render por índice de fotograma y marca de agua

- Estado: Hecha
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

- [x] Para `n` muestreados (título, `●●●`/comodines, mitad de barrido, palabra a palabra, fin de línea, hueco, desplazamiento negativo y positivo), el modelo pintado coincide con `fotogramaEn(letra, n × 1000 / fps − offset)` (V17).
- [x] Pintar el mismo `n` dos veces da el mismo DOM; pintar `n` sin pasar por `n − 1` da lo mismo que en orden (incluida la entrada de línea a mitad de sus 200 ms).
- [x] Con «Letra lista» no hay capa de resaltado (V18). Con `prefers-reduced-motion` activo en el sistema, la entrada de línea y el fondo se mueven igual (`movimiento='completo'`).
- [x] La marca de agua tiene la misma geometría relativa a 640 × 480 y a 3840 × 2160 y no se superpone a la franja de la letra (V19).

## Pruebas de feedback

- Unitarias: `PantallaLetra.test.tsx` (modo fotograma, sin `requestAnimationFrame`), `animacionesPorFotograma.test.ts` con animaciones falsas, `MarcaDeAgua.test.tsx`, `AppExportacion.test.tsx` contra la API falsa.
- E2E: ninguna propia (la cubre 0241).
- Críticos: no (no toca `main/`, `preload/` ni `shared/`), salvo que cambie el editor o el reproductor: entonces sí.
- Manual: calidad visual (M1) en la guía de la fase.

## Notas de implementación

Qué se hizo:
- `PantallaLetra`: props `tiempoFijoMs` y `movimiento`. Con tiempo fijo no hay `requestAnimationFrame` ni estado: el fotograma sale de `fotogramaEn(letra, t − offset_ms, …)` en el propio render y un `useLayoutEffect` escribe el fondo (`fondoCssEn`), la variable de espera (se quita si no hay hueco, para que no quede un valor del fotograma anterior) y el barrido. La entrada de línea y el número de espera llevan `data-nace-ms` (tiempo de audio en que nacen) y el CSS ya no usa la _media query_ sino `data-movimiento` en la raíz. El editor y el reproductor no cambian (el hook de sistema sigue dando `movimiento` por defecto).
- `karaoke/animacionesPorFotograma.ts`: `fijarAnimaciones(tAudioMs)` pausa las animaciones de `document.getAnimations()` y fija `currentTime = tAudio − nace`. **Desviación del contrato**: en lugar de «n − n₀ del fotograma de nacimiento observado» usa el nacimiento anotado desde el modelo (`data-nace-ms`), porque así pintar `n` sin pasar por `n − 1` da exactamente lo mismo (criterio del contrato) y es equivalente a `(n − n₀) × 1000 / fps` en la secuencia normal.
- `renderer/src/exportacion/`: `AppExportacion` (escucha antes de pedir `inicial`, espera `document.fonts.load` de la familia de la letra y de Atkinson 700, monta `PantallaLetra` con `movimiento="completo"` y `barrido` salvo `letra_lista`, pinta con `flushSync`, aplica el controlador, espera 2 `requestAnimationFrame` y llama a `listo`; en desarrollo expone `window.__fotogramaExportacion`), `MarcaDeAgua` (valores de la spec 10: `3cqh`, `máx(14px, 2.2cqh)`, relleno `.35em .7em`, `rgb(0 0 0 / 50%)`, opacidad 85 %) y `exportacion.module.css`; `main.tsx` sustituye al provisional de 0234.
- Cambios de 0234 hechos aquí al medir con la ventana real: `capturar()` ahora asienta el cuadro con doble captura (ver [pregunta 0127](../preguntas/0127-captura-offscreen-con-cuadro-obsoleto.md)) y la spec `exportacion-captura` usa una instantánea real con fondo rojo.

Comprobado en Electron (ventana real): entrada de línea a 2000 ms en `matrix(0.7,…)` y avanzando por fotograma; mismo DOM para `n = 62` pintado en secuencia, saltando desde 5 o repetido; marca de agua a 640 × 480 (`right 97,75 %`, `bottom 97 %`, `top 92 %`) y a 3840 × 2160 (`right 98,3 %`, `bottom 97 %`, `top 93,3 %`): mismos 3 % del alto en ambos márgenes.

Archivos clave: `app/src/renderer/src/karaoke/PantallaLetra.tsx`, `karaoke/animacionesPorFotograma.ts`, `app/src/renderer/src/exportacion/*`, `karaoke/pantallaLetra.module.css`.

Cómo probarlo: `npx vitest run src/renderer/src/karaoke src/renderer/src/exportacion`; la verificación visual (M1) va en la guía de la fase.

Pendiente / deuda: la comparación del DOM con `fotogramaEn` para los casos muestreados (V17) y V18/V19 en Electron la cubre 0241; aquí solo hay pruebas unitarias y la comprobación manual de arriba. `window.__fotogramaExportacion` solo existe en desarrollo (`import.meta.env.DEV`), no en la build.

