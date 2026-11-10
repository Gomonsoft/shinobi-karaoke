# 0054 — Detalles de interfaz de temas y biblioteca agrupada (fase 3)

- De: arquitecto
- Para: disenador-ux
- Estado: Respondida
- Bloquea: no. Se necesita antes del desglose de tareas de la fase 3.

## Contexto

El [ADR 0016](../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md) fija el catálogo, la resolución y los contratos. La [spec del editor, fase 3](../ux/06-editor.md#fase-3-de-020--temas-y-biblioteca) ya resuelve la procedencia, la confirmación obsoleta, el borrado interrumpido en el diálogo y el borrador de «Editar tema». Quedan los puntos siguientes, que dependen de la interfaz. Entre paréntesis va la opción provisional del ADR.

**Viabilidad pedida en la spec 06**: avisar al cerrar la ventana con un borrador de tema es viable sin cambios en main. El renderer declara `app.guardadoPendiente(true)` mientras el borrador tenga cambios, y main espera a `app.confirmarCierre()` sin plazo propio (ADR 0016 §10). Un cierre forzado pierde el borrador.

## Preguntas

1. **Tema inicial.** Al migrar se crea un tema a partir de `config.estilo_predeterminado` y se marca como predeterminado. ¿Qué nombre visible lleva? Hay dos casos: el estilo de fábrica y uno cambiado por el usuario. (Provisional: «Shinobi» y «Mi estilo».) Si se quieren más temas de serie, es una decisión de producto para el usuario.
2. **Nombres duplicados.** La spec propone nombres únicos añadiendo « 2», « 3»… Main además **rechaza** un nombre repetido según la clave de identidad (ignora mayúsculas y espacios, conserva tildes) con `TEMA_NOMBRE_DUPLICADO`, también al renombrar. Falta el texto de ese error en el diálogo de nombre.
3. **Portada con miniatura.** La regla actual ([spec 02](../ux/02-biblioteca.md), criterio 15) compara el estilo con el predeterminado. (Provisional: miniatura si la canción **hereda** cualquier nivel, o si es «Tema personalizado» con el estilo de fábrica o igual al `config.estilo_predeterminado` heredado, que es el caso de las migradas.)
4. **Nombre visible de un grupo.** «QUEEN», «Queen» y «queen  » comparten clave. ¿Qué variante muestra el encabezado? (Provisional: la de la canción modificada más recientemente.)
5. **Borrado pendiente al arrancar.** Si la app se cerró a mitad de un borrado, el tema sigue «en borrado» y main no reanuda solo (ADR 0016 §8). ¿Dónde se ofrecen «Reintentar» y «Cancelar el borrado» fuera del diálogo original: en «Administrar temas», en Ajustes o con un aviso al abrir?
6. **Catálogo en solo lectura.** Si `temas.json` viene de una versión más nueva, los temas no se ofrecen y las canciones con tema muestran su respaldo (`TEMAS_SOLO_LECTURA`). Falta el mensaje.
7. **Editar datos.** Cambiar artista o álbum puede cambiar la apariencia heredada. ¿Se avisa en el diálogo o basta con el resultado visible?
8. **Lote y canciones dañadas por pistas.** Main admite aplicar un tema a cualquier canción con `cancion.json` válido, incluidas las dañadas por pistas. ¿Se pueden seleccionar en Biblioteca?

## Respuesta

Diseñador UX, 2026-11-09. Recogido en las specs [02](../ux/02-biblioteca.md#fase-3-de-020--temas-y-biblioteca), [06](../ux/06-editor.md#fase-3-de-020--temas-y-biblioteca) y [08](../ux/08-ajustes-y-acerca.md#fase-3-de-020--temas-y-biblioteca).

1. **Tema inicial.** Se acepta lo provisional: **«Shinobi»** si `config.estilo_predeterminado` es el estilo de fábrica y **«Mi estilo»** si el usuario lo cambió. Sin más temas de serie (no se pregunta al usuario: no hay propuesta de producto que lo pida). Spec 08, «Migración desde 0.1.0», criterio A7b.
2. **Nombres duplicados.** `TEMA_NOMBRE_DUPLICADO` muestra `tema.nombre.repetido` («Ya tienes un tema con ese nombre.») en el campo, con el diálogo abierto y el foco de vuelta en el campo con el texto seleccionado. Igual al crear, duplicar y renombrar. La comprobación en vivo del renderer es orientativa; main es la autoridad. Nombres de 1 a 60 caracteres tras recortar. Spec 06, «Nombre del tema».
3. **Portada con miniatura.** Se mantiene la propuesta de la spec 02 y no la provisional del ADR: miniatura solo con procedencia `predeterminado`, `aleatorio` o `incluido`, o con `propio` cuyo estilo sea igual al de fábrica o al `config.estilo_predeterminado` heredado (canciones migradas). Con tema de **álbum o artista**, la portada usa el estilo: es una elección deliberada del usuario y debe verse en la Biblioteca. Spec 02, «Tarjeta: tema y portada», criterio B14.
4. **Nombre visible de un grupo.** Se acepta: la grafía de la canción del grupo modificada más recientemente. Se unifica con «Editar datos». Spec 02, tabla «Grupos».
5. **Borrado pendiente al arrancar.** Solo en **Ajustes › Temas**: la fila del tema muestra el aviso `aj.temas.pendiente` con [Terminar de eliminar] y [Cancelar el borrado]. Sin aviso al abrir la app. El editor (`tema.borradoPendiente`, con «Administrar temas…») y la Biblioteca (`bib.grupo.temaBorrando`) remiten ahí cuando el tema afectado está a la vista. El diálogo original también ofrece [Cancelar el borrado]. `BORRADO_PENDIENTE` usa el mismo texto. Spec 08, «Estados y errores», criterio A9.
6. **Catálogo en solo lectura.** `aj.temas.soloLectura` en Ajustes, `tema.soloLectura` en el editor y `bib.temas.soloLectura` en la Biblioteca: «Tus temas se guardaron con una versión más nueva de Shinobi Karaoke. Aquí no se pueden usar ni cambiar; las canciones se ven con el aspecto guardado en cada una. Actualiza la app para usarlos.» Se puede personalizar una canción; ninguna acción de catálogo escribe. También se define `aj.temas.apartado` para el catálogo apartado por ilegible.
7. **Editar datos.** Basta con el resultado visible: la tarjeta se mueve, se enfoca, se anuncia `bib.anuncio.movida` y, **solo si cambia el tema efectivo**, aparece el toast `bib.toast.temaCambiado` con el tema y la procedencia nuevos. Sin aviso previo en el diálogo. Spec 02, «Editar datos», criterio B7.
8. **Lote y dañadas por pistas.** Sí: las Dañadas solo por pistas se pueden seleccionar (su `cancion.json` es válido). Las Dañadas con `cancion.json` ilegible no. Spec 02, «Selección múltiple», criterio B8.

**Viabilidad del aviso al cerrar**: se adopta. Spec 06, «Salir con un borrador de tema», y criterio T23.

**Pendiente con el arquitecto**: la opción provisional B1 de [0052](0052-predeterminado-y-canciones-que-dependen-de-el.md) (quitar el predeterminado no cambia el aspecto de las canciones que lo seguían) difiere del ADR §3, donde pasarían al estilo incluido. Si se confirma, la operación de quitar el predeterminado debe fijar como `base` de esas canciones el tema anterior.
