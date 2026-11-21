# 0238 — Diálogo de exportación: formulario, muestra y perfiles

- Estado: Hecha
- Paso del pipeline: 6
- Depende de: [0230](0230-contratos-compartidos-de-la-exportacion.md) (contra la API falsa); integración real tras [0237](0237-servicio-de-exportacion-e-ipc.md)
- ADRs: [0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md) §5, §6 y §11
- Spec UX: [10](../ux/10-exportacion.md) wireframes A, E y F, §«Formulario», §«Perfil no soportado frente a bloqueo por evento», §«Notas del formulario», microcopy `exp.*`; [sistema visual](../ux/sistema-visual.md#020--exportación-de-video-fase-6)

## Objetivo
El diálogo «Exportar video» en su estado de formulario, con formato, audio, proporción, resolución, FPS, destino, estimación, notas y muestra.

## Contrato
- `renderer/src/exportacion/dialogo/` (nuevo): `DialogoExportacion` (contenedor de estados; este tarea implementa A, E, F, «Cargando perfiles» y «Validando»), `Formulario`, `MuestraExportacion` (fotograma fijo con `PantallaLetra` estático y `MarcaDeAgua` escalada), `textos.ts` con las claves `exp.*`.
- **Formato**: control segmentado con los dos formatos de `FORMATOS` (ADR 0019 §5), con `exp.formato.pista`, popover `exp.formato.ayuda` y `exp.formato.noDisponible`. Al cambiar de formato pide `destinoPropuesto` con `desdeDestinoId` si el destino lo eligió el usuario (conserva carpeta y nombre; ver [0124](../preguntas/0124-destino-conservado-al-cambiar-de-formato.md) sobre `exp.anuncio.destino`).
- Perfiles no soportados con su motivo, cambio automático de FPS y proporción no disponible, según la spec. Sin candado de evento: con sesión activa solo la nota `exp.nota.sesion`.
- Destino con `destinoPropuesto`/`elegirDestino`; recordar opciones lo hace main al iniciar.
- Estimación con `exportacion.estimar` y aviso de espacio.

## Criterios de aceptación
- [x] V3–V10 y V30 de la spec 10 con la API falsa.
- [x] V23: con sesión activa, la nota `exp.nota.sesion` aparece y «Exportar» sigue disponible (V24 retirado).
- [x] Estado F con `RUNTIME_NO_DISPONIBLE` (acción «Reparar el motor de audio») y con `SIN_CODIFICADOR`.
- [x] A 1024 × 576 sin scroll horizontal (V29, parte del formulario).

## Pruebas de feedback
- Unitarias: Vitest + Testing Library de `DialogoExportacion` (A, E, F), `Formulario` (perfiles no soportados, cambio de FPS, notas en orden) y `MuestraExportacion`.
- E2E: ninguna.
- Críticos: no.
- Manual: nada (capturas en 0241).

## Notas de implementación

### Qué se hizo
- `renderer/src/exportacion/dialogo/`: `DialogoExportacion` (contenedor; en esta tarea solo enruta al formulario, 0239 añade B–D), `DialogoFormulario` (estados A, E, «Cargando perfiles», «Validando» y F), `Formulario` (presentacional), `useFormulario` (carga de canción, perfiles, opciones recordadas y destino; estimación; anuncios; `iniciar`), `modelo.ts` (reglas puras de perfiles no soportados, proporción equivalente, FPS, costoso, espacio), `MuestraExportacion` (`PantallaLetra` estático a la resolución real, reducido por `transform`, con marca de agua propia con los valores de la spec), `SelectorResolucion` (listbox en línea, enfocable con flechas, opciones no soportadas no elegibles), `textos.ts` (`exp.*` y tabla de errores, reutilizable por 0239) y `exportacion.module.css`.
- `ControlSegmentado` gana la prop opcional `describedBy` (el grupo «Formato» se describe con `exp.formato.pista`).
- `exportacion/pruebas.ts`: ayudante de pruebas (`instalarApiExportacion`, `cancionIpcDePrueba`) para 0239 y 0240.
- Pruebas: `modelo.test.ts` y `DialogoExportacion.test.tsx` (A, E, F, perfiles no soportados con cada motivo, FPS, WebM y destino conservado (0124), popover ⓘ, notas en orden, sesión, errores en el campo).

### Decisiones y desviaciones
- 0124 (provisional): al cambiar de formato con destino elegido se pide `destinoPropuesto({ cancionId, formato, desdeDestinoId })`; `exp.anuncio.destino` solo si main devuelve otra ruta (distinta sin extensión).
- Popover ⓘ inline (no el componente `Popover`): este ignora Esc si hay un diálogo modal abierto y su portal queda inerte dentro del `Dialogo`. Mismo motivo para el listbox de resoluciones (en línea, no en portal como `SelectorFuente`).
- «Guardar como» es un `input` de solo lectura con la ruta completa en `title`; el recorte «por el centro» queda como recorte al final (CSS no lo permite sin medir).
- Las dos columnas pasan a una al estrechar (`@container`, ≈ 41 rem de cuerpo): la spec fija 720 px de diálogo y 760 px de umbral, que se contradicen.
- `vozDisponible` sale de `pistas.voz` de la canción (el renderer no puede leer el archivo); main vuelve a comprobarlo en la instantánea.
- El estado F con `RUNTIME_NO_DISPONIBLE` se detecta por el código con que rechaza `exportacion.perfiles()`; «Reparar el motor de audio» cierra el diálogo y navega a `primer-arranque` (como `Progreso`). Con todos los perfiles `no_comprobado` se muestra `exp.sinPerfiles.noComprobado` sin botón de reparar.
- La nota «Lista incompleta» solo se muestra en canciones Lista (según la tabla de la spec).
- Tras una validación fallida no se vuelve a pedir el destino (se asume que `iniciar` no consume el `destinoId` si falla). Revisar con 0237.

- Corrección tras las capturas de la fase 6: una sola zona de scroll (`.cuerpo`); el popover ⓘ pasa de `position: absolute` a bloque en línea bajo la etiqueta «Formato» (con `scrollIntoView` al abrirlo); el aviso «ya existe», el error general y las notas van en `.notas`, `position: sticky; bottom: 0` dentro de la zona con scroll, así quedan visibles encima de los botones (el aviso «ya existe» deja de ir justo bajo «Guardar como»).

### Cómo probarlo
`cd app && npx vitest run --project renderer src/renderer/src/exportacion`. La apertura real del diálogo llega con 0240 (puntos de entrada) y la integración con main con 0237.

### Verificación manual (para la guía de `docs/Test-manuales/`)
- A 1024 × 576 y 1280 × 800: sin scroll horizontal, cabecera y botones visibles, muestra a la derecha (≥ 800 px) o encima (más estrecho).
- Muestra con un degradado con movimiento, una fuente grande y «Letra lista»: proporciones iguales a las del reproductor y marca abajo a la derecha.
- Popover ⓘ y listbox de resoluciones dentro del diálogo (clic, teclado, Esc).

### Deuda técnica
- La marca de agua de la muestra es propia de `MuestraExportacion`; cuando exista `MarcaDeAgua.tsx` (0235) conviene reutilizarla.
- Las capturas de la spec (V29) las hace 0241.
