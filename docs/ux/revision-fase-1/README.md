# Revisión visual y de UX — Fase 1 (tareas 0015–0020)

- Autor: disenador-ux · Fecha: 2026-11-04 · Rama: `fase-1-esqueleto`
- Specs de referencia: [02-biblioteca.md](../02-biblioteca.md), [00-mapa-de-vistas.md](../00-mapa-de-vistas.md), [sistema-visual.md](../sistema-visual.md)
- Pregunta derivada para el arquitecto: [docs/preguntas/0008](../../preguntas/0008-ajustes-ui-tras-revision-fase-1.md); además se responde [0007](../../preguntas/0007-textos-y-comportamientos-de-ui-no-definidos-fase-1.md) (textos del programador)

## Cómo se obtuvieron
Desde `app/`: `npm run semilla` (10 canciones de ejemplo en `.datos-dev`; ya existían) y `npm run build`. Un script Playwright temporal (fuera del repo, en el scratchpad de la sesión) lanzó `out/` con `_electron` igual que `app/e2e/*.spec.ts`, ajustó el tamaño con `BrowserWindow.setContentSize` y cerró la app con `app.close()`. La biblioteca vacía usa un directorio temporal con solo `config.json` (`instalacion.estado = "completa"`). Los diálogos se cerraron con **Cancelar**: la semilla no se modificó.

Notas:
- La pantalla del equipo limita la altura: lo pedido como **1280×800** sale a **1280×757** de área de contenido (la de 1024×640 es exacta). No afecta a los hallazgos.
- **Muestrario (`#/muestrario`) omitido**: solo se monta con `import.meta.env.DEV` (`App.tsx`, `main.tsx`); en la build compilada el hash se ignora y se ve la Biblioteca. Hace falta `npm run dev` para revisarlo.
- Capturas a 2× (Retina).

## Capturas
| Archivo | Qué muestra |
|---------|-------------|
| `01-biblioteca-1280x800.png` | Biblioteca con la semilla, 4 columnas |
| `01b-biblioteca-1280x800-scroll.png` | Final de la rejilla: error, interrumpido y las dos Dañadas |
| `02-biblioteca-1024x640.png` | 3 columnas a 1024 px |
| `03-filtro-borradores.png` | Filtro *Borradores* |
| `04-busqueda-sin-resultados.png` | Búsqueda «zzz» sin resultados (filtro Todas) |
| `04b-filtro-mas-busqueda-sin-resultados.png` | Filtro *Listas* + búsqueda «borrador» sin resultados |
| `05-menu-acciones-lista.png` | Menú ⋯ de una Lista (**recortado**, ver B1) |
| `05b-menu-acciones-borrador.png` | Menú ⋯ de un Borrador (recortado) |
| `05c-menu-acciones-danada.png` | Menú ⋯ de una Dañada (recortado) |
| `05d-menu-lista-sin-recorte-DIAGNOSTICO.png` | Mismo menú con `overflow: visible` inyectado solo para la captura (no es la app real): lista completa de ítems y foco en «Eliminar…» |
| `05e-menu-danada-borde-inferior-DIAGNOSTICO.png` | Menú de la última fila con el mismo parche: queda pegado al borde inferior |
| `06-dialogo-eliminar.png` | Diálogo «¿Eliminar…?» (abierto con Supr) |
| `06b-dialogo-volver-a-borrador.png` | Diálogo «¿Volver a borrador?» |
| `06c-dialogo-editar-datos.png` | Diálogo «Editar datos» |
| `07-foco-teclado.png` | Foco de teclado tras tabular (botón «Añadir canción») |
| `07b-foco-tarjeta.png` | Foco visible en una tarjeta (anillo oro) |
| `07c-foco-dentro-tarjeta.png` | Tab desde la tarjeta: la rejilla es un solo punto de tabulación; aparece «Saltar al contenido» |
| `08-biblioteca-vacia-1280x800.png` / `08b-biblioteca-vacia-1024x640.png` | Estado vacío |

## Hallazgos

### Bloqueante
**B1. El menú ⋯ queda recortado por la tarjeta** (`05`, `05b`, `05c`). Solo se ven 2–3 ítems; «Volver a borrador», «Mostrar en la carpeta» y **«Eliminar…»** no se ven ni se pueden pulsar con el ratón (con teclado sí llegan, pero a ciegas). En las Dañadas solo asoma «Mostrar en la carpeta».
- Spec: 02 §"Componentes" (menú por estado); sistema-visual §6 «Menú contextual».
- Causa probable: `.tarjeta { overflow: hidden }` en `app/src/renderer/src/vistas/biblioteca/biblioteca.module.css` (l. 19) y el menú `position: absolute` dentro de la tarjeta (`componentes/componentes.module.css` `.menu`, `componentes/MenuContextual.tsx`).
- Arreglo esperado: el menú no debe depender del recorte de su contenedor (portal a `body` con posición calculada, o quitar el `overflow` de la tarjeta y recortar solo la portada). Además **debe abrirse hacia arriba** si no cabe debajo (`05e`: en la última fila llega al borde de la ventana; con una fila más se saldría). Mismo problema potencial con el tooltip (deuda ya anotada en 0016).

### Importante
**I1. Título de una Dañada ilegible = UUID** (`01b`: «5eed0000-0000-4000-80…»). La spec decía «título tomado del nombre de la carpeta», pero las carpetas se llaman por id (ADR 0006): no le dice nada al usuario. **Spec corregida**: `bib.danada.sintitulo` = «Canción sin nombre» (ver 02). Archivo probable: `vistas/biblioteca/tarjeta.ts` (`datosDeTarjeta`).

**I2. «En cola para separar» sin trabajo real** (`01`, tarjeta «Borrador recién creado»: icono reloj en `info`). Se deriva de un paso `pendiente` persistido, no de un trabajo en cola; el usuario cree que algo va a pasar solo y no pasa. Igual con «Preparando el audio…» para una fuente `pendiente` sin trabajo. El color `info` se reserva a trabajos vivos (sistema-visual §2.3). **Spec corregida**: sin trabajo vivo → «Falta separar las pistas» / «Falta preparar el audio» en `texto-2`, sin icono, con «Continuar». Archivo probable: `vistas/biblioteca/tarjeta.ts` (`lineaDeBorrador`).

**I3. Sin resultados con un filtro activo no menciona el filtro** (`04b`: filtro *Listas* + «borrador» → «No hay canciones que coincidan con «borrador».», aunque hay 5 borradores que coinciden). **Spec corregida**: `bib.sinresultados.listas` / `.borradores` + botón «Ver todas» además de «Borrar búsqueda». Archivo probable: `vistas/biblioteca/Biblioteca.tsx`.

**I4. Textos propios del programador a corregir** (detalle en 02 §"Microcopy", aprobados o corregidos): filtro *Borradores* vacío, archivo arrastrado no admitido, tiempo restante «queda 1 min aprox.», fuente en cola «En cola», etiqueta «Álbum». Archivos: `Biblioteca.tsx`, `navegacion/useArrastrarArchivo.ts`, `tarjeta.ts` (`textoEta`, `lineaDeTrabajo`), `DialogosCancion.tsx`.

### Menor
**M1. Botones de acción no alineados entre tarjetas de una fila** (`01`: «Reproducir» de la lista incompleta y «Continuar» quedan más abajo que los de al lado; huecos vacíos al pie de las tarjetas más cortas). La acción principal debe ir pegada al pie: `.cuerpo { flex: 1 }` y `.accion { margin-top: auto }` en `biblioteca.module.css`.

**M2. El tooltip del ⋯ se queda visible con el menú abierto** (`05d`: «Más acciones de «Canción lista»» encima de la tarjeta vecina). Al abrir el menú el tooltip debe ocultarse. `componentes/MenuContextual.tsx` / `Tooltip`.

**M3. «Eliminar…» no está separado del resto** (`05d`). Añadir un separador (1 px `borde`) antes de los ítems destructivos. Spec actualizada (sistema-visual §6). `MenuContextual.tsx`.

**M4. «Cancelar» de los diálogos usa botón secundario, no fantasma** (`06`, `06b`, `06c`). Se **acepta** lo implementado (más fácil de ver y de pulsar junto a un destructivo); sistema-visual actualizado. Sin cambio de código.

**M5. Primario rojo del diálogo y «Añadir canción» de la barra visibles a la vez** (`06b`, `06c`). El de la barra queda tras el velo y no compite; se **acepta** y se aclara la regla en sistema-visual. Sin cambio de código.

**M6. Icono de «En cola»: reloj en vez de ⏸** (`01`). Se **acepta** el reloj (se lee mejor como «espera» que la pausa, que sugiere algo detenido por el usuario); spec actualizada. Sin cambio de código.

## Qué está bien
- **Identidad**: fondo oscuro, rojo hanko solo en el primario, oro solo en el foco. Jerarquía clara: título de vista, filtros, rejilla.
- **Rejilla**: 4 columnas a 1280 px y 3 a 1024 px, separación 24 px, portada 16:9 con el estilo de cada canción (fondos y fuentes de karaoke se ven bien, incluida la condensada y la cursiva gruesa).
- **Insignias** con icono + texto y colores correctos: Lista (`exito`), Borrador (`aviso`), Error y Dañada (`error`). La lista incompleta mantiene «✓ Lista» + aviso ⚠ y «Reproducir» (criterio 2b). Error e Interrumpido con su línea y «Reintentar».
- **Dañada**: portada `fondo-2` con alerta, líneas de la spec («Faltan las pistas separadas», «No se puede abrir esta canción»).
- **Botón redondo ▶ de 48 px** sobre la portada al pasar el ratón o enfocar, en `acento`.
- **Foco**: anillo oro visible en tarjeta, campo de búsqueda, botones, ítems de menú y diálogos; la rejilla es un solo punto de tabulación; «Saltar al contenido» aparece al tabular. El diálogo de eliminar abre con el foco en **Cancelar** (opción segura).
- **Diálogos**: textos literales de la spec; «Eliminar» con estilo destructivo (`error-tenue` + borde `error`); 480 px, acciones a la derecha.
- **Estado vacío**: fiel a la spec (icono, `t-display`, cuerpo, un único primario —el de la barra se oculta— y nota de formatos), centrado y legible a 1024 px.
- **Filtros** con recuento y búsqueda con ✕ para vaciar; recuentos correctos (las Dañadas solo en *Todas*, decisión aprobada).
