# 0175 — Ajustes › Temas: predeterminado, lista de temas y avisos del catálogo

- Estado: Pendiente
- Paso del pipeline: 4 y 5
- Depende de: [0169](0169-base-de-temas-en-el-renderer.md) (en paralelo con 0170–0174)
- ADRs: [0016](../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md) §1, §6 (A1, B1, C1), §8, §9
- Specs: [Ajustes · Fase 3](../ux/08-ajustes-y-acerca.md#fase-3-de-020--temas-y-biblioteca) (A1–A11, A7b, A7c, A13–A15), [0055](../preguntas/0055-textos-de-predeterminado-anterior-y-ajustes-de-la-fase-3.md), [0052](../preguntas/0052-predeterminado-y-canciones-que-dependen-de-el.md), [0054](../preguntas/0054-detalles-de-interfaz-de-temas-y-biblioteca.md) §5–§6, [0056](../preguntas/0056-destino-respaldo-y-canciones-pendientes.md) §2 (A15)

## Objetivo

Sección «Temas» entre «Separación de voz» y «Acerca de»: selector de predeterminado con usos y confirmación de impacto (cambiar y quitar), lista «Tus temas» con muestra, usos, grupos y menú ⋯ (usar como predeterminado, renombrar, duplicar, eliminar), nota de edición, estados (cargando, vacío, sin predeterminado, apartado, solo lectura, borrado pendiente con [Terminar de eliminar] y [Cancelar el borrado], referencias que faltan) y regreso a la vista de origen.

## Contrato

- **Navegación** (dueña de `navegacion/estado.ts`): Ajustes recuerda su origen (Biblioteca o editor de la canción `id`, con la pestaña Estilo) y una sección inicial opcional («temas»). «‹ Volver…» y Esc regresan al origen (`aj.volver.biblioteca`/`aj.volver.editor`). Lo usan ⚙, Ctrl/Cmd + , y «Administrar temas…».
- **Predeterminado**: `previsualizar({ tipo: "predeterminado", temaId })`; si `afectadas` es 0 se ejecuta sin diálogo (`predeterminadoUsos` permite saberlo antes, pero la autoridad es el impacto); si no, `DialogoImpactoTema` de 0169 con:
  - `aj.temas.dialogo.predet` hacia un tema, con la variante «sin anterior» si el catálogo no tiene predeterminado (canciones con el estilo incluido sin base) y la nota de C1;
  - `aj.temas.dialogo.ninguno` hacia «Ninguno…» (efecto `fija_base`). Al confirmar: `aj.temas.ninguno.quitando` y, con más de 5 canciones, `aj.temas.ninguno.progreso` (`temas:progreso` de la ficha). **Éxito**: cierra, selector en «Ninguno…», toast `aj.temas.toast.predet` (variante ninguno) y foco en el selector. **Fallo** (main se detiene sin escribir el catálogo): el diálogo de 0169 muestra la «Lista de canciones tras un fallo a mitad» (`ListaFalloAMitad`, [0056](../preguntas/0056-destino-respaldo-y-canciones-pendientes.md)) con `aj.temas.ninguno.parcial` (título de la que falló, «Faltan {f}» y su variante f = 1, nombre del predeterminado), filas `error` y `pendiente`, `tema.parcial.notaPendientes` y foco en [Reintentar] (nueva previsualización, que solo cuenta las que faltan); [Cerrar] devuelve el foco al selector, que sigue en el tema. Esta tarea no pinta la lista: solo pasa `{anterior}` y gestiona el foco al cerrar.
  - Un fallo de una sola escritura del catálogo (A1) deja el selector en el valor anterior y muestra `tema.toast.error` con [Reintentar].
- **Usos y grupos**: de `CatalogoIpc` (`usos.total`, `grupos`, `predeterminadoUsos`); el renderer no los calcula.
- **Textos**: `aj.temas.origen.anterior` es la constante `tema.origen.anterior` de `renderer/src/temas/textos.ts`. Las claves `aj.temas.ninguno.quitando`, `.progreso` y `.parcial` las define 0169 junto al diálogo. `aj.temas.apartado.cerrar`, `aj.temas.faltan` y el resto de `aj.temas.*` van en `vistas/ajustes/textos.ts`. Desaparecen las marcas «provisional».
- **Avisos**: `apartado` → `aj.temas.apartado` con [Abrir carpeta de datos] (`sistema.abrirCarpetaDatos`) y ✕ (nombre accesible `aj.temas.apartado.cerrar`): oculta el aviso en el momento, llama a `temas.descartarAvisoApartado()` y deja el foco en el `h2` «Temas» (`tabindex="-1"`). Si la llamada falla, sigue oculto en esta sesión, sin toast, y vuelve al reiniciar; `soloLectura` → `aj.temas.soloLectura`, lista sin ⋯ y selector inactivo; `referenciasFaltantes > 0` → `aj.temas.faltan` con singular y plural (el texto no menciona grupos); `borradoPendiente` → `aj.temas.pendiente` en la fila, con `temas.reanudarBorrado` (abre `DialogoEliminarTema` en progreso, que sigue `temas:progreso` con `ficha: null` y, si vuelve a fallar, muestra `tema.eliminar.parcial` con la lista del intento nuevo) y `temas.cancelarBorrado`. `aj.temas.pendiente` sigue usando «faltan {k} de {n}» con `borradoPendiente.restantes`/`total` del catálogo (no cambia con 0056).
- Lista con *roving tabindex*, menú con tecla Menú o Mayús + F10, foco tras duplicar, renombrar y eliminar según la spec; `aj.temas.anuncio.predetBorrado` al borrar el predeterminado.

## Archivos

- `app/src/renderer/src/vistas/ajustes/TemasAjustes.tsx`, `ListaTemas.tsx`, `TemasAjustes.test.tsx` (nuevos).
- `app/src/renderer/src/vistas/ajustes/Ajustes.tsx`, `Ajustes.test.tsx`, `ajustes.module.css`, `textos.ts`, `modelo.ts`.
- `app/src/renderer/src/navegacion/estado.ts`, `useAtajosGlobales.ts` y sus pruebas; `App.tsx` si monta la navegación.

## Criterios de aceptación

- [ ] A1–A2: la sección aparece en su sitio con selector, usos y lista; cambiar el predeterminado con canciones afectadas pide confirmación con recuento y desglose (foco en «Cancelar») y sin ellas se aplica directamente; persiste al reabrir (con el doble).
- [ ] Quitar el predeterminado muestra `aj.temas.dialogo.ninguno` con el número de canciones que lo conservarán; tras confirmar, el selector queda en «Ninguno…» con `aj.temas.predet.azar`, toast de la variante ninguno y foco en el selector.
- [ ] A13 (con el doble): con «Noche ninja» predeterminado y 3 canciones que lo siguen, «Ninguno…» muestra el diálogo con 3 y foco en «Cancelar»; tras confirmar, los resúmenes devueltos tienen procedencia `predeterminado_anterior` (la verificación visual de portada y editor es de 0176).
- [ ] A14: hacia otro tema, el diálogo no cuenta las de base fijada (`aleatorio`, `predeterminado_anterior`, `incluido`); desde «Ninguno…», la variante «sin anterior» si hay canciones con estilo incluido sin base, y sin diálogo si no hay ninguna.
- [ ] A15: con un fallo programado en la 2.ª de 4, `aj.temas.ninguno.parcial` nombra la 2.ª y dice «Faltan 3 canciones»; la lista tiene 3 filas (la 2.ª con ✕ y [Copiar detalles]; la 3.ª y la 4.ª con «Pendiente» en `texto-3` y sin [Copiar detalles]), la nota `tema.parcial.notaPendientes` y el foco en [Reintentar]; el selector sigue en «Noche ninja»; [Reintentar] previsualiza y confirma solo las 3 que faltan y termina con el selector en «Ninguno…»; con 8 canciones, `aj.temas.ninguno.progreso` avanza.
- [ ] A9/T19 desde Ajustes: [Terminar de eliminar] con un fallo programado en ese intento muestra `tema.eliminar.parcial` con la canción que falló y «Faltan {f}» de ese intento (no del primero).
- [ ] A4: eliminar el predeterminado desde ⋯ incluye la frase de canciones nuevas; tras confirmar, el selector pasa a «Ninguno…», se anuncia `aj.temas.anuncio.predetBorrado` y el foco va a la fila siguiente.
- [ ] A6: renombrar y duplicar usan los diálogos de 0169 y dejan el foco en la fila correspondiente.
- [ ] A7–A9: estados apartado, solo lectura (sin acciones que escriban), referencias que faltan (singular con 1, plural con 2, sin mencionar grupos) y borrado pendiente (terminar y cancelar) según la spec.
- [ ] A7c: el aviso apartado sigue al salir y volver a Ajustes; ✕ (nombre «Cerrar aviso») lo oculta, deja el foco en «Temas» y llama una vez a `descartarAvisoApartado`; con la llamada fallida programada, sigue oculto en la sesión y sin toast.
- [ ] A10: abierta desde el editor (⚙, Ctrl/Cmd + , o «Administrar temas…»), «‹ Volver al editor» y Esc regresan al editor de esa canción con la pestaña Estilo; desde la Biblioteca, a la Biblioteca.
- [ ] A11: operable con teclado; el foco nunca queda en `body` tras eliminar.

## Notas de implementación
