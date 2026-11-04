# 0027 — Ajustes de la Biblioteca tras la revisión visual de la Fase 1
- Estado: Hecha
- Paso del pipeline: — (raíz) y 5
- Depende de: 0019, 0020 (y 0026 para el separador del menú)
- ADRs: 0006
- Spec UX: docs/ux/02-biblioteca.md (§"Microcopy" y "Línea de paso", revisión 2026-11-04), docs/ux/sistema-visual.md §6, docs/preguntas/0007 (respuesta) y docs/preguntas/0008 (I1–I4, M1, M3), capturas `docs/ux/revision-fase-1/`

## Objetivo
Aplicar los cambios no bloqueantes que pidió el diseñador UX tras ver la Biblioteca en una ventana real. Ningún cambio de datos ni de IPC.

## Criterios de aceptación
- [x] **I1** — Dañada por JSON: el título visible y el de `bib.aria.tarjeta` es `bib.danada.sintitulo` («Canción sin nombre»), no el nombre de la carpeta (`tarjeta.ts`). El nombre de la carpeta sigue disponible para «Mostrar en la carpeta».
- [x] **I2** — Línea de paso (`tarjeta.ts`, `lineaDeBorrador`/`lineaDeTrabajo`): un paso `pendiente` persistido **sin trabajo vivo** muestra `bib.paso.falta.*` («Falta separar las pistas» / «Falta preparar el audio») en `texto-2`, sin icono y con «Continuar». «En cola para separar» / «En cola para descargar» (`bib.paso.cola.descarga`) y las líneas ⟳ en `info` solo con trabajo vivo (icono `clock` para en cola).
- [x] **I3** — Sin resultados (`Biblioteca.tsx`): con texto y filtro *Listas*/*Borradores*, `bib.sinresultados.listas` / `.borradores` + botones fantasma «Borrar búsqueda» y «Ver todas» (cambia a *Todas* sin borrar el texto); *Borradores* vacío sin texto: `bib.sinborradores`. «Borrar búsqueda» solo con texto.
- [x] **I4** — Textos: `bib.arrastrar.noadmitido` («Ese tipo de archivo no se puede usar. Prueba con un archivo de audio o de vídeo.», `useArrastrarArchivo.ts`); `bib.eta` («quedan unos {n} min» · «queda alrededor de 1 min» · «queda menos de 1 min», `textoEta`); etiqueta «Álbum (opcional)» en Editar datos. Textos copiados de `ux/02`, no reescritos.
- [x] **Miniatura de YouTube** (0007 §5): se muestra si el estilo de la canción es igual al predeterminado de fábrica (`ESTILO_PREDETERMINADO`) **o** al `config.estilo_predeterminado` vigente (comparación estructural en una función pura de `tarjeta.ts`, con test; la config se lee una vez y se actualiza con `alCambiarConfig`).
- [x] **M1** — Acción principal pegada al pie: `.cuerpo { flex: 1 }` y `.accion { margin-top: auto }` (`biblioteca.module.css`), de modo que los botones de una fila quedan alineados con títulos/líneas de distinta altura.
- [x] **M3** — Separador de 1 px (`--borde`) antes de «Eliminar…»: prop de ítem `separadorAntes` en `MenuContextual` (sin `role` interactivo; `role="separator"`), usado en los tres menús por estado.
- [x] Tests de componente actualizados para cada punto (I1 con `aria`, I2 con y sin trabajo vivo, I3 con los tres filtros, ETA en los tres tramos, miniatura con los dos predeterminados); E2E de `biblioteca.spec.ts` actualizado (título «Canción sin nombre» en la dañada por JSON).

## Notas de implementación
- Hecho: I1 (`tituloDeTarjeta` en `tarjeta.ts`, usado en tarjeta, aria, menú y diálogos; sin línea de artista si está vacío), I2 (`Falta preparar el audio` / `Falta separar las pistas` sin trabajo vivo; `En cola para descargar` solo con trabajo vivo), I3 (`textoSinResultados` + «Borrar búsqueda» / «Ver todas»), I4 (ETA, `bib.arrastrar.noadmitido`, «Álbum (opcional)»), miniatura con predeterminado de fábrica o vigente (`usaMiniatura(r, estiloUsuario)`; `useEstiloPredeterminado` en `Biblioteca.tsx` lee `config.obtener` una vez y `alCambiarConfig`), M1 (`.cuerpo { flex: 1 }`, `.accion { margin-top: auto }`), M3 (`separadorAntes` en `MenuContextual`, `role="separator"`).
- Archivos clave: `app/src/renderer/src/vistas/biblioteca/{tarjeta.ts,TarjetaCancion.tsx,Biblioteca.tsx,biblioteca.module.css,fixturesApi.ts}`, `componentes/MenuContextual.tsx`, `navegacion/useArrastrarArchivo.ts`.
- Probar: `npm run lint && npm run typecheck && npm run format:check && npm test && npm run test:e2e` en `app/`.
- Estado verificación: lint, format y vitest (536) en verde; E2E de biblioteca en verde. Fallos ajenos a esta tarea (tarea 0021 en curso): `e2e/seguridad.spec.ts` (E2E y errores de typecheck TS7017 en ese archivo).
- Deuda: un paso `en_curso` persistido sin trabajo vivo sigue mostrando ⟳ (la spec solo cubre `pendiente`).
