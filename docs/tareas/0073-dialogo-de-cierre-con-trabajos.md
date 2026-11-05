# 0073 — Diálogo de cierre con trabajos pendientes
- Estado: Hecha
- Paso del pipeline: transversal
- Depende de: 0014, 0036 (Hechas: `trabajos.hayPendientes()` y la solicitud de cierre de `main/cierre.ts`)
- ADRs: 0004 (Cierre de la app durante un trabajo)
- Spec UX: docs/ux/04-progreso-pipeline.md §3 ("Cerrar la app con trabajos activos o en cola", criterio 12; `cierre.*`)
- Cuándo: **en cualquier momento** de la Fase 3 (no depende de las demás); lo usa el E2E de 0075

## Objetivo
`cierre.ts` ya pide confirmación con una instalación en curso. Hay que ampliarlo a los trabajos de la cola, como prevé su propio comentario.

## Criterios de aceptación
- [x] `hayAlgoEnCurso()` incluye `trabajos.hayPendientes()` (en curso o en cola, en las dos colas). Las consultas interactivas (`info-youtube`, vista previa de archivo) no cuentan, ni "Volver a Calidad" de Ajustes: al salir se aborta sin preguntar y se conserva el `.descarga` (`preguntas/0021` §2).
- [x] El renderer, ante `app:solicitudCierre` con trabajos, muestra el diálogo modal:
  - `cierre.titulo` y `cierre.cuerpo`, con `{n}` y una lista breve de los títulos de las canciones (máx. 3 + "y {k} más");
  - [Seguir trabajando] (primario, con el foco) y [Cerrar de todos modos] (destructivo);
  - Esc = Seguir trabajando.
  Durante la instalación del runtime se mantiene el diálogo actual.
- [x] Al confirmar: `cancelarTodos()` y salida. Los pasos quedan `interrumpido`, sin procesos hijos vivos (lo que ya hace 0014/0021), y se borran los `pistas.tmp/` (0065).
- [x] Al reabrir, las canciones afectadas muestran "Interrumpido" con "Reintentar" (tarjeta y vista), sin reintento automático.
- [x] Tests: unitarios de `cierre.ts` con trabajos (en curso, solo en cola, ninguno) y de componente del diálogo (texto, foco, Esc, lista breve).

## Notas de implementación
- `app/src/main/cierre.ts`: nueva `hayAlgoEnCurso({instalando, hayTrabajos})`. `main/index.ts` la usa con `runtime.servicio.instalando()` y `gestorTrabajos.hayPendientes()` (solo la cola; `info-youtube`, vista previa de archivo y "Volver a Calidad" no pasan por el gestor y no cuentan). `pausar` ahora pausa el runtime y cancela cada trabajo con motivo `cierre` (quedan `interrumpido`, sin procesos hijos; `alDescartar` borra los `pistas.tmp/`). No usa `cancelarTodos()` para no dejar el gestor "cerrando" si en macOS solo se cierra la ventana; `before-quit` ya llama a `cancelarTodos()` al salir.
- Renderer: `navegacion/DialogoCierre.tsx` (montado en `App.tsx`) + `textosCierre.ts` (`cierre.*`, singular/plural y lista de hasta 3 títulos + "y {k} más"). Al recibir `app:solicitudCierre` consulta `trabajos.listar()` y los títulos en `biblioteca.listar()`; sin trabajos confirma al instante. En `primer-arranque` no actúa: lo sigue gestionando `PrimerArranque` (diálogo de la instalación). Foco en "Seguir trabajando"; Esc = seguir.
- "Interrumpido" + "Reintentar" al reabrir ya lo daban 0014/0021 (tarjeta y vista); sin reintento automático.
- Tests: `cierre.test.ts` (en curso, solo en cola, ninguno, instalación) y `DialogoCierre.test.tsx` (texto, foco, Esc, lista breve, confirmar, sin trabajos, primer arranque).
- Deuda: sin E2E propio (lo cubre 0075); no se pudo ejecutar Playwright por errores ajenos en `shared/` en curso (export duplicado `MODELOS_SEPARACION`).
- Mantenimiento: el E2E `importar-youtube.spec.ts` ("cerrar la app durante la descarga…") daba timeout de 90 s porque `app.close()` con un trabajo en curso ahora muestra el diálogo de cierre y frena la salida (comportamiento deseado, ux/04 §3). Arreglo solo en el test: lanza `app.close()` sin esperar, pulsa "Cerrar de todos modos" en el diálogo y espera el cierre; después comprueba "Interrumpido" al reabrir. Sin cambios en la app. Revisados los demás E2E: ninguno más cierra la app con trabajos activos.
