# 0056 — Destino «respaldo» al heredar y canciones no intentadas tras un fallo

- De: arquitecto
- Para: disenador-ux
- Estado: Respondida
- Bloquea: no. Las tareas 0169, 0170 y 0175 siguen con la opción provisional.

## Contexto

Al cerrar [0055](0055-textos-de-predeterminado-anterior-y-ajustes-de-la-fase-3.md), el [ADR 0016](../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md) (revisión 2) añade dos cosas:

- **`alHeredar`** (§3 y §9): `{ procedencia, temaId, temaNombre }`. Es lo que daría la canción si heredara, y lo calcula main. Alimenta `tema.heredar.destino`, igual que `ImpactoIpc.afectadas[].despues` alimenta el diálogo de quitar el tema de un grupo.
- **Estado `pendiente`** en el resultado (§7). Quitar el predeterminado, borrar un tema y reanudar un borrado se detienen en el primer fallo. Desde ahora, el resultado lista todas las canciones: `aplicada`, `error` (la que falló, con su código) y `pendiente` (las que no se llegaron a intentar).

Hay dos casos que las specs no cubren.

## Preguntas

1. **Destino `respaldo`.** Ocurre cuando la base de la canción («al azar» o «predeterminado anterior») apunta a un tema que no está en el catálogo, por ejemplo en una carpeta copiada de otro equipo. Si la canción tiene un tema asignado y se pulsa «Volver a heredar», o si se quita el tema de su álbum o artista, pasará a «Tema no disponible» con su aspecto guardado. ¿Qué texto usan `tema.heredar.destino` y la fila de `bib.grupo.impacto` al quitar?
   - Provisional en el editor: «Usará el aspecto guardado en esta canción.».
   - Provisional en la fila: «{título} — {artista} · usará el aspecto guardado (tema no disponible)».
2. **Canciones `pendiente`** en `aj.temas.ninguno.parcial` y `tema.eliminar.parcial`. La spec dice «estas no se pudieron guardar» y da a cada una [Copiar detalles] con su código. Con el corte en el primer fallo, solo una canción tiene código; las demás no se intentaron. ¿Se listan todas igual, se distinguen («No se intentó») o solo se lista la que falló, con «y {p} más pendientes»?
   - Provisional: se listan todas en orden. La que falló lleva ✕ y [Copiar detalles]. Las pendientes llevan – en `texto-3`, sin [Copiar detalles] ni texto extra.

## Opción provisional tomada (si no bloquea)

La de cada punto. Los textos van en `renderer/src/temas/textos.ts` (0169) y en `vistas/editor/textos.ts` (0170), para cambiarlos en un solo sitio.

## Respuesta

De: disenador-ux · 2026-11-09. Las dos respuestas **difieren de lo provisional**: hay que ajustar los textos de 0169, 0170 y 0175, y las tareas que pintan el diálogo de grupo (0174) y el fallo a mitad de eliminar (0171 o la que lo implemente). Todo está aplicado en las specs [06](../ux/06-editor.md), [02](../ux/02-biblioteca.md) y [08](../ux/08-ajustes-y-acerca.md).

### 1. Destino `respaldo`

«Usará el aspecto guardado en esta canción» no explica por qué no vuelve a un tema, y el usuario no sabe qué es «el aspecto guardado». Hay que decir la causa (su tema de origen no está), avisar de la consecuencia («Tema no disponible») y no prometer «el aspecto actual», porque la instantánea puede estar atrasada (ADR 0016 §2: se refresca solo cuando se escribe la canción, y quitar el tema de un grupo no escribe canciones). Por eso se habla del **último** aspecto guardado.

Regla común: con destino `respaldo` **no se nombra ningún tema**. El renderer ignora `alHeredar.temaNombre` y `despues.temaNombre`.

Editor (spec 06, D1 y T22b):
- `tema.heredar.destino.respaldo`: «⚠ Su tema de origen no está en tus temas. Se verá con el último aspecto guardado en esta canción («Tema no disponible»).». El ⚠ va en `aviso` y el texto en `texto-2`.
- «Volver a heredar» sigue activo y sin confirmación, porque se deshace con Ctrl/Cmd + Z. Al pulsarlo, el panel pasa a D4, se anuncia `tema.anuncio.heredar.respaldo` y el foco va al selector.
- Variantes nuevas que hacían falta por coherencia: `tema.toast.definidos` (respaldo y estilo incluido), `tema.anuncio.heredar` (estilo incluido) y `tema.origen.corta` (respaldo → «no disponible»).

Biblioteca, quitar el tema de un grupo (spec 02, B5b):
- Fila de la lista: «⚠ {título} — {artista} · se verá con el último aspecto guardado (su tema de origen no está en tus temas)».
- Si todas van a `respaldo`, el texto principal es «{n} canciones se verán con el último aspecto guardado en cada una: su tema de origen no está en tus temas.» (tiene variante n = 1).
- Si solo van algunas, se mantiene «quitar» o «destinos distintos» y se añade la línea `bib.grupo.impacto.noDisponible`: «⚠ {r} de ellas quedarán como «Tema no disponible» porque su tema de origen no está en tus temas. Puedes darles otro con «Aplicar tema…».». Los botones y el foco no cambian.

### 2. Canciones `pendiente`

Se listan todas, como en lo provisional, pero **se distinguen con texto visible**. Un «–» solo no se entiende y un lector de pantalla no lo anuncia. Componente común en spec 06, «Lista de canciones tras un fallo a mitad». Lo usan `tema.eliminar.parcial` (también al reanudar, desde el editor o desde Ajustes) y `aj.temas.ninguno.parcial`:
- Se listan solo las `error` y `pendiente`, en el orden del resultado. Las `aplicada` no aparecen.
- `error`: ✕ en `error` + «{título} — {artista}» + «No se pudo guardar.» + [Copiar detalles] con su `codigo`.
- `pendiente`: – + «{título} — {artista}» + **«Pendiente»**, todo en `texto-3`, sin [Copiar detalles].
- Si hay alguna pendiente, se añade la nota `tema.parcial.notaPendientes`: «Las pendientes no se intentaron porque el proceso se detuvo en el fallo. Reintentar las guarda todas.».
- Nombre accesible por fila con el estado («…, pendiente»). Los símbolos llevan `aria-hidden`. Caben hasta 8 filas visibles con scroll.
- El texto principal se anuncia con `role="alert"` y el foco va a [Reintentar].

**Cambio en el texto principal**: se sustituye «{k} de {n} … ya conservan; estas no se pudieron guardar» por la canción que falló y **«Faltan {f}»** (f = `error` + `pendiente`). Al reintentar o reanudar, main recalcula el conjunto y `n` ya no es el del primer intento, así que «{k} de {n}» engañaría. Textos nuevos:
- `tema.eliminar.parcial`: «No se pudo terminar: falló al guardar «{título}» y el borrado se detuvo. Faltan {f} canciones por conservar su aspecto. El tema no se eliminará hasta que se guarden todas.» (con variante f = 1).
- `aj.temas.ninguno.parcial`: «No se pudo quitar el predeterminado: falló al guardar «{título}» y se detuvo. Faltan {f} canciones por guardar. «{anterior}» sigue siendo el predeterminado y ninguna canción ha cambiado de aspecto.» (con variante f = 1).

Criterios actualizados: T19, T22b (spec 06), B5b (spec 02) y A15 (spec 08).

**Aplicado (arquitecto, 2026-11-09)**: ADR 0016 revisión 3 (`titulo` y `artista` en el resultado por canción; destino `respaldo` sin nombre de tema). Tareas 0169 (dueña de `ListaFalloAMitad` y de los textos compartidos), 0170, 0174, 0175 y 0176 ajustadas; 0171 no pinta ningún fallo a mitad.
