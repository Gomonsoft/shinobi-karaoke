# 0008 — Ajustes de interfaz tras la revisión visual de la Fase 1
- De: disenador-ux
- Para: arquitecto
- Estado: Respondida
- Bloquea: sí, solo B1 (el menú ⋯ no se puede usar con el ratón); el resto no

## Contexto
Primera revisión de la interfaz a ojo (app compilada con la semilla, capturas en [docs/ux/revision-fase-1/](../ux/revision-fase-1/README.md)). Las specs ya están actualizadas (`ux/02` §"Microcopy" y "Línea de paso", `ux/sistema-visual.md` §6). Lo que sigue necesita cambio de código; se pide convertirlo en tareas. Las referencias de archivo son orientativas.

## Pregunta
¿Puedes crear las tareas para estos cambios (o decir si alguno no es viable)?

**Bloqueante**
1. **B1 — Menú ⋯ recortado por la tarjeta** (capturas `05`, `05b`, `05c`). `.tarjeta { overflow: hidden }` (`vistas/biblioteca/biblioteca.module.css`) recorta el menú `position: absolute` (`componentes/MenuContextual.tsx`, `.menu` en `componentes.module.css`): «Volver a borrador», «Mostrar en la carpeta» y «Eliminar…» no se ven. Pedido: el menú se pinta por encima de todo (portal o similar), **se abre hacia arriba si no cabe debajo** (`05e`) y oculta el tooltip de su disparador al abrirse (`05d`). Criterio: con la ventana a 1024×640, en la primera y en la última fila, todos los ítems del menú se ven enteros y se pueden pulsar. Conviene un E2E que compruebe `toBeVisible()` + que el ítem está dentro del viewport.

**Importante**
2. **I1 — Dañada con `cancion.json` ilegible muestra el UUID como título** (`01b`). Usar `bib.danada.sintitulo` = «Canción sin nombre» (también en `bib.aria.tarjeta`). `vistas/biblioteca/tarjeta.ts`.
3. **I2 — Línea de paso sin trabajo vivo** (`01`, «Borrador recién creado»). Un paso `pendiente` persistido sin trabajo en el gestor: «Falta separar las pistas» / «Falta preparar el audio» (`texto-2`, sin icono, botón Continuar). «En cola para separar» / «En cola para descargar» y los ⟳ en `info` solo con trabajo vivo; icono de «en cola» = `clock` (ya lo es). `tarjeta.ts` (`lineaDeBorrador`, `lineaDeTrabajo`).
4. **I3 — Sin resultados con filtro activo** (`04b`). Con texto y filtro *Listas*/*Borradores*: `bib.sinresultados.listas` / `.borradores` + botones fantasma «Borrar búsqueda» y «Ver todas» (pasa a *Todas* sin borrar el texto). *Borradores* vacío sin texto: `bib.sinborradores`. `vistas/biblioteca/Biblioteca.tsx`.
5. **I4 — Textos corregidos** (ver 0007 y `ux/02`): `bib.arrastrar.noadmitido` (`navegacion/useArrastrarArchivo.ts`), `bib.eta` «quedan unos {n} min · queda alrededor de 1 min · queda menos de 1 min» (`tarjeta.ts`, `textoEta`), «En cola para descargar» para la fuente en cola, etiqueta «Álbum (opcional)» (`DialogosCancion.tsx`).
6. **Miniatura de YouTube** (0007 §5): mostrarla si el estilo es igual al predeterminado de fábrica **o** al predeterminado vigente del usuario. `TarjetaCancion.tsx`.

**Menor**
7. **M1 — Acción principal pegada al pie de la tarjeta** para que los botones de una fila queden alineados (`01`): `.cuerpo { flex: 1 }`, `.accion { margin-top: auto }` en `biblioteca.module.css`.
8. **M3 — Separador antes de «Eliminar…»** en el menú (1 px `borde`; sistema-visual §6). `MenuContextual.tsx` (p. ej. ítem `separadorAntes`).

Sin cambio de código (aceptado en la spec): «Cancelar» secundario en diálogos, primario del diálogo junto al de la barra tras el velo, icono reloj para «en cola».

Pendiente de revisar en otra pasada: el **Muestrario** (solo en `npm run dev`), el indicador de actividad con trabajos reales y la lista de carga (esqueletos).

## Opción provisional tomada (si no bloquea)
Ninguna para B1 (el menú es usable solo con teclado). Para el resto, lo implementado sigue valiendo hasta que se hagan las tareas.

## Respuesta
**Respondida por el arquitecto (2026-11-04).** Todo es viable sin cambios de datos, IPC ni ADR. Dos tareas:

- **[0026](../tareas/0026-menu-contextual-en-portal-y-con-volteo.md) — B1, prioritaria y pequeña**: el menú se pinta en un portal con `position: fixed` calculada desde el disparador, se voltea hacia arriba si no cabe, se cierra al desplazar o redimensionar y oculta el tooltip del disparador. **No** se quita el `overflow: hidden` de la tarjeta (lo necesita la portada). E2E a 1024×640 en la primera y la última fila, con cada ítem dentro del viewport.
- **[0027](../tareas/0027-ajustes-de-biblioteca-tras-revision-visual.md) — I1–I4, miniatura, M1 y M3**: textos copiados de `ux/02`; la miniatura se compara con el predeterminado de fábrica **o** con el vigente del usuario (función pura; la config se lee con `config.obtener()`/`alCambiarConfig`, que ya existen). El separador M3 depende de 0026 porque toca el mismo componente.

La revisión pendiente (Muestrario, indicador con trabajos reales, esqueletos de carga) queda anotada en el backlog como deuda de la Fase 1/Fase 3.
