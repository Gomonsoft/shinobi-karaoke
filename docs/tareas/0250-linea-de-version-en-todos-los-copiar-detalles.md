# 0250 — Línea de versión al final de todos los «Copiar detalles»
- Estado: Pendiente
- Paso del pipeline: transversal
- Depende de: 0248
- ADRs: [0020](../adr/0020-publicacion-en-github-releases-y-politica-de-versiones.md), «Revisión para 0.2.0 — fase 10», §2
- Spec UX: [08 · «Línea de versión en los detalles copiados»](../ux/08-ajustes-y-acerca.md#línea-de-versión-en-los-detalles-copiados) (AC6) y [10 · V20](../ux/10-exportacion.md) (detalles del error de exportación); también las specs 01, 02, 03, 04, 06 y 07 en lo que la regla de la 08 cambia
- Versión: 0.2.0-alpha.2 · Fase 10, punto 3

## Objetivo
Todo texto que la app copia para pegarlo en una incidencia termina con la misma última línea, `Versión: {identificador}`, generada por la función compartida `lineaVersion` (0248). El error de exportación deja de terminar con `Versión: 0.2.0-alpha.1` sin número ni commit.

## Contrato
- **Ayudante del renderer**, por ejemplo `renderer/src/soporte/detalles.ts`: `conLineaVersion(texto)` añade la línea al final, a partir de `sistema.info()` (una sola petición, guardada en memoria), y `copiarDetalles(texto)` la usa antes de `navigator.clipboard.writeText`. Si `info()` falla, copia el texto sin la línea; nunca escribe `undefined`.
- **Sitios** (inventario hecho con `rg "navigator.clipboard|writeText(" src/renderer/src`; repetirlo al empezar): `exportacion/dialogo/DialogoSeguimiento.tsx` (`detallesDe`, línea 132: quitar la línea `Versión:` propia), `exportacion/dialogo/DialogoFormulario.tsx`, `navegacion/IndicadorActividad.tsx`, `temas/ListaFalloAMitad.tsx`, `vistas/ajustes/ReproductorAjustes.tsx`, `vistas/anadir/{PanelArchivo,PanelYoutube,ResumenFuente}.tsx`, `vistas/biblioteca/{Biblioteca,DialogoAplicarTema,TemaGrupo}.tsx`, `vistas/biblioteca/cola/BloqueActiva.tsx`, `vistas/biblioteca/useAgregarACola.ts`, `vistas/editor/{BotonLista,useBorradorTema,useGuardadoEditor,useTemaEditor}.tsx`, `vistas/primer-arranque/{PantallasInicio,PantallasInstalacion}.tsx`, `vistas/progreso/Progreso.tsx` y `vistas/reproductor/PantallaError.tsx` (línea 28: quitar `Shinobi Karaoke ${version} · ${so}` como versión y dejar la línea común al final). «Copiar información para soporte» (`AcercaDe.tsx`) **no** lleva la línea: es de 0249.
- **Main**: `runtime/servicio.ts:473` (comprobado: `Shinobi Karaoke ${deps.versionApp}` en el texto de `detalles()` que copian B2 y B4 del primer arranque) pasa a terminar con `lineaVersion(...)` y deja de poner la versión arriba. `versionApp` se sustituye por lo que haga falta para formarla (versión y `Compilacion`), pasado desde `index.ts:578`.
- La línea es siempre la **última**, una sola vez, también cuando el bloque termina con líneas de registro. No se añaden rutas ni datos personales.
- Una fila de una lista de fallos copia su código y la línea de versión.

## Criterios de aceptación
- [ ] AC6 de la spec 08: cada «Copiar detalles» de los sitios del inventario termina con `Versión: {identificador}` como última línea, una sola vez.
- [ ] El error de exportación copia el ejemplo de la spec 08 (código, perfil, formato, posición y `Versión: 0.2.0-alpha.3-1260 (desarrollo, commit 9e07c55)` con los datos falsos correspondientes).
- [ ] Ningún sitio copia sin pasar por el ayudante: comprobación de `rg` en las notas de la tarea.

## Pruebas de feedback
- Unitarias: el ayudante (con `info()` bien y mal) y los tests existentes de los sitios que ya comprueban lo que se copia (`DialogoSeguimiento`, `PantallaError`, `Progreso`, `PrimerArranque`, `runtime/servicio`), actualizados. No hace falta un test nuevo por sitio: basta con que cada sitio use `copiarDetalles`.
- E2E: ninguna.
- Críticos: sí (toca `main/` y vistas del flujo principal: añadir canción, progreso y editor).
- Manual: copiar los detalles de un error de exportación con la app de la *Release* y comprobar la última línea (guía de la versión).

## Notas de implementación
