# 0083 — Main: guardar la letra, editar su texto e importar `.lrc`/`.txt` (persistencia y paso `letra`)
- Estado: Hecha
- Paso del pipeline: 3
- Depende de: 0077, 0078, 0079
- ADRs: 0005 (Revisión 2026-11-05: importación y codificaciones), 0006 (Revisión 2026-11-05: la letra en `cancion.json`, regla de `pasos.letra`, escritor único), 0009 §8
- Spec UX: docs/ux/05-letra.md ("Usar esta letra", "Importar archivo", "Edición en C", criterios 5, 9–11, 15, 16, 19)
- Preguntas: `preguntas/0022` §2, §4 y §9; `preguntas/0023` §2
- Cuándo: en paralelo con 0081 y 0082 y con la interfaz.

## Objetivo
Servicio `app/src/main/letras/servicio.ts` y handlers de `letras.guardar`, `letras.editarTexto` y `letras.leerArchivo`. Es el único punto que escribe `cancion.json#letra` y `pasos.letra`.

## Criterios de aceptación
- [ ] **`guardar`**:
  - `normalizarLetra` con ids nuevos (0078) y validación con `letraSchema`;
  - `letra = { origen, lrclib_id, offset_ms: 0, lineas }`;
  - `pasos.letra = estadoPasoLetra(letra)` (0077) con `actualizado` al momento;
  - una sola escritura con `BibliotecaServicio.actualizar`, que emite `evento:cancion`.
  Se acepta con la separación en curso (ADR 0004/0005), con la descarga de la fuente en curso, en `borrador` y en `lista`: una `lista` sigue `lista`, e `incompleta` se deriva. Si la canción no existe o está dañada → `ARGUMENTOS_NO_VALIDOS`; guardar una letra no exige que el audio esté listo. La confirmación de sustituir es de la interfaz (0085): se pide siempre que la canción ya tenga ≥ 1 línea (`0022` §4); el main no la exige.
- [ ] **`editarTexto`**:
  - `aplicarTextoEditado` (0079) sobre la letra **guardada en ese momento**, así que dos llamadas seguidas se aplican en orden;
  - escritura con *debounce* de 1 s (`debounceMs` de `actualizar`, ADR 0006);
  - si el resultado es idéntico, no escribe.
  Con cero líneas: en `borrador`, se guarda y `pasos.letra` pasa a `pendiente`; en `lista`, se rechaza con `ARGUMENTOS_NO_VALIDOS` sin escribir (`preguntas/0022` §2, definitivo; la interfaz muestra `let.error.listaSinLineas`).
- [ ] **`leerArchivo`**:
  - diálogo nativo (`dialog.showOpenDialog`, un archivo, filtro "Letra (.lrc, .txt)"), con el mismo doble que 0046: `SHINOBI_DIALOGO_PRUEBAS`, solo sin empaquetar (`dialogoConDoblePruebas`);
  - más de 512 KB → `ARCHIVO_SIN_LETRA`;
  - **codificación**: BOM UTF-8 o UTF-16 LE/BE; si no, UTF-8 estricto (`TextDecoder` con `fatal: true`); si falla, Windows-1252;
  - detección con `esLrc` sin mirar la extensión; `lrcALetra` o `textoPlanoALetra`;
  - cero líneas, archivo binario (bytes NUL) o error de lectura → `ARCHIVO_SIN_LETRA`.
  Devuelve `{ cancelado: false, nombre, lineas, sincronia, ignoradas }` sin escribir nada, donde `ignoradas` es el recuento de `lrcALetra` (renglones con texto sin marca de tiempo; 0 para texto plano), para el aviso `let.importar.ignoradas` (`preguntas/0023` §2). La ruta no sale al renderer, solo el nombre.
  Si al empezar esta tarea `archivoLetraLeidoSchema` (`shared/letrasBusqueda.ts`, 0077) aún no tiene `ignoradas: z.number().int().nonnegative()`, se añade aquí, junto con la API falsa del renderer.
- [ ] **Escritor único**: ninguna otra ruta del main modifica `letra` ni `pasos.letra`. La sustitución de la fuente (0042/0049) la sigue conservando, y un test lo comprueba con una letra real en `cancion.json`. Como `tareas/0042` y `0049` mencionan `letra.json`, se corrige `app/src/main/fuente/archivo.test.ts`: el test que escribe un `letra.json` aparte pasa a comprobar el campo `letra` de `cancion.json` (ADR 0006, Revisión 2026-11-05).
- [ ] **Concurrencia con la separación**: guardar una letra mientras `separacion` está `en_curso` no pisa `pasos.separacion.progreso` ni el resultado. Hay un test con el servicio de separación y su separador falso escribiendo a la vez.
- [ ] Tests (Vitest, directorio de datos temporal):
  - guardar desde LRCLIB, manual y archivo → `cancion.json` válido, `pasos.letra = completado`, evento emitido;
  - sustituir una letra con sincronía;
  - editar conservando ids y tiempos;
  - edición a cero líneas en `borrador` y en `lista`;
  - archivos en UTF-8 con BOM, UTF-16 LE, Windows-1252 (`canción` con `ó` = 0xF3), binario, vacío y demasiado grande;
  - un `.txt` que es LRC;
  - un LRC con 2 renglones de texto sin marca → `ignoradas: 2`; un texto plano → `ignoradas: 0`;
  - diálogo cancelado.

## Notas de implementación
- `app/src/main/letras/servicio.ts` (`ServicioLetras`: `guardar`, `editarTexto`, `leerArchivo`; también `decodificarTextoLetra`) y `index.ts`. Cableado mínimo en `main/index.ts` (`letras` de `registrarIpc`, con el doble de diálogo `dialogoConDoblePruebas`). `letras.buscar` queda como rechazo `ERROR_INTERNO` hasta que 0082 lo conecte.
- Todo se escribe con `ServicioBiblioteca.actualizar` (`letra` + `pasos.letra` por `estadoPasoLetra`); el cambio solo toca esos campos, así que no pisa el progreso de la separación. `editarTexto` calcula de forma síncrona sobre la letra del índice (dos llamadas seguidas se aplican en orden), con `debounceMs` 1000 (configurable en el constructor para tests) y sin escribir si las líneas no cambian; sin letra previa parte de una letra `manual` vacía. Con cero líneas: `borrador` se guarda (`pendiente`), `lista` → `ARGUMENTOS_NO_VALIDOS`.
- `archivoLetraLeidoSchema.ignoradas` ya existía (0077). `archivo.test.ts` (0042/0049) ahora comprueba el campo `letra` de `cancion.json`.
- Corrección detectada al probar el artefacto Windows (2026-11-07): `guardar` ya permite guardar mientras YouTube descarga. La vista Letra mantiene el paso Editor inactivo con un indicador de espera hasta que termina la fuente. Prueba añadida para conservar `pasos.fuente` y completar `pasos.letra` durante la descarga.
- Probar: `npx vitest run src/main/letras src/main/fuente/archivo.test.ts`.
- Deuda: ninguna conocida; los errores de lint/format de `renderer/vistas/letra/` son de 0084. Un test de `src/renderer` ajeno falla en la suite completa (no de esta tarea).
