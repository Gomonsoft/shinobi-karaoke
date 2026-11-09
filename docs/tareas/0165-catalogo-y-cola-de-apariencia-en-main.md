# 0165 — Catálogo `temas.json`, cola de apariencia y usos en main

- Estado: Hecha
- Paso del pipeline: 4 y 5
- Depende de: [0163](0163-modelo-puro-de-temas-e-identidad.md) (en paralelo con [0164](0164-contratos-ipc-de-temas-y-apariencia.md))
- ADRs: [0016](../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md) §1, §5, §6, §7 (operaciones sin impacto), §9, [0006](../adr/0006-persistencia-y-modelo-de-datos.md#revisión-para-020--fase-3)
- Specs: [Ajustes · Fase 3, «Migración desde 0.1.0» y «Estados y errores»](../ux/08-ajustes-y-acerca.md#fase-3-de-020--temas-y-biblioteca)

## Objetivo

Crear `ServicioTemas` (`main/temas/`), único escritor de `biblioteca/temas.json`, con lectura tolerante, siembra inicial, solo lectura, apartado por ilegible, cola única de apariencia, operaciones sin impacto, sorteo de la apariencia inicial y cálculo de usos. Es la base sobre la que 0166 y 0167 añaden operaciones confirmadas y 0168 conecta la biblioteca y el IPC.

## Contrato

- **Puerto de canciones** inyectado (`PuertoCanciones`): `indice()` (resúmenes con id, metadatos, `modificada`, `apariencia`, `danada`), `leer(id)` y `actualizar(id, mutador)`. En pruebas, un doble en memoria; en 0168, `ServicioBiblioteca`.
- **Carga** (`main/temas/catalogo.ts`): usa `leerJson`/`escribirJsonAtomico` de `main/persistencia/` y `migrarCatalogo`.
  - Sin `temas.json` ni `.bak` → `catalogoInicial` con `config.estilo_predeterminado` (inyectado) y escritura inmediata.
  - Esquema más nuevo → `soloLectura: true`; ninguna mutación escribe (`TEMAS_SOLO_LECTURA`); la resolución usa `indice = null`.
  - Ilegible también desde `.bak` → renombrar a `temas.json.danado` (sustituye a uno anterior), registrar el error y sembrar uno nuevo con `apartado` = ahora.
- **Cola única** (`main/temas/cola.ts`): FIFO de promesas; expone `enCola(fn)` para que 0166–0168 serialicen creación de canciones, metadatos y cambios de apariencia.
- **Fachada pública completa** (`main/temas/servicio.ts`), con estas firmas desde el principio para que 0168 pueda cablear el IPC: `catalogo()`, `crear`, `renombrar`, `duplicar`, `descartarAvisoApartado`, `previsualizar`, `ejecutar`, `reanudarBorrado`, `cancelarBorrado`, `resolver(cancion)`, `aparienciaInicial(metadatos)`, `enCola`. `previsualizar`, `ejecutar`, `reanudarBorrado` y `cancelarBorrado` lanzan `NO_IMPLEMENTADO` hasta 0166/0167.
- **`resolver(cancion)`** devuelve `{ estilo, procedencia, temaId, temaNombre, neutra, alHeredar }`. `alHeredar` (ADR 0016 §3, revisión 2) es `{ procedencia, temaId, temaNombre }` de `resolverApariencia` aplicada a una copia de la canción con `apariencia = { modo: "heredar", base }`: sin `tema_id` y conservando la `base`. 0168 lo copia al resumen y a `resuelta` sin recalcularlo.
- **Operaciones sin impacto**: `crear({ nombre, estilo })`, `renombrar({ temaId, revisionTema, nombre })` (revisión distinta → `CONFIRMACION_OBSOLETA` sin impacto), `duplicar({ temaId, nombre })`. Nombre normalizado y único por clave (`TEMA_NOMBRE_DUPLICADO`); tema inexistente → `TEMA_NO_ENCONTRADO`; tema en borrado → `BORRADO_PENDIENTE`. `revision` +1 al renombrar.
- **Apariencia inicial** (§6): `aparienciaInicial(metadatos, randomInt = crypto.randomInt)` → `heredar` sin base si hay predeterminado; si no, `base: aleatorio` con un tema no en borrado elegido con probabilidad uniforme; si el catálogo está vacío (o en solo lectura), `base: incluido`. Devuelve también el `estilo` y `tema_nombre` resueltos para la instantánea.
- **Usos** (`main/temas/usos.ts`, función pura sobre índice y catálogo): por tema `usos` y desglose por procedencia, `grupos`, `predeterminadoUsos` y `referenciasFaltantes` (ADR 0016 §9). Excluye las dañadas por JSON.
- **Forma de salida**: `catalogo()` devuelve un objeto con la forma de `CatalogoIpc` de 0164. Si 0164 aún no se ha integrado, se tipa con una interfaz local equivalente y 0168 la sustituye por el tipo inferido del esquema.
- **Eventos**: emisor inyectado `temas:cambiado` tras cada mutación, y `notificarIndiceCambiado()` que reemite agrupado en 250 ms (lo llamará 0168).

## Archivos

- `app/src/main/temas/catalogo.ts`, `cola.ts`, `servicio.ts`, `usos.ts`, `index.ts` y sus `*.test.ts` (nuevos).
- Sin cambios en `main/biblioteca/`, `main/ipc/` ni `shared/` (si falta algo en `shared/`, se pide a 0163 o 0164).

## Criterios de aceptación

- [x] Primer arranque sin catálogo y `config.estilo_predeterminado` de fábrica → `temas.json` con un tema «Shinobi» predeterminado; con un estilo cambiado → «Mi estilo». Reiniciar no crea otro tema.
- [x] `temas.json` con basura y `.bak` válido → se usa el `.bak`. Ambos ilegibles → existe `temas.json.danado`, el catálogo nuevo tiene `apartado` y `descartarAvisoApartado()` lo deja en `null` de forma persistente.
- [x] Catálogo con `esquema: 2` → `catalogo().soloLectura === true`, el archivo no cambia byte a byte tras intentar `crear`, `renombrar` y `duplicar` (todas `TEMAS_SOLO_LECTURA`).
- [x] `crear` con «noche  NINJA» cuando existe «Noche ninja» → `TEMA_NOMBRE_DUPLICADO`; con «Noché ninja» → se crea. Renombrar con revisión antigua → `CONFIRMACION_OBSOLETA`. Duplicar da id nuevo, mismo estilo y 0 usos.
- [x] `aparienciaInicial` con `randomInt` inyectado reparte entre 3 temas (prueba con secuencia fija), nunca elige un tema en borrado y da `incluido` con catálogo vacío.
- [x] Usos: con una canción asignada, una de álbum, una de artista, una de predeterminado, una `predeterminado_anterior`, una aleatoria, una personalizada y una con referencia rota, cada contador y `referenciasFaltantes = 1` son exactos; en solo lectura `referenciasFaltantes = 0`.
- [x] `resolver(...).alHeredar`: una canción asignada a «Sol» en el álbum de Queen con tema de álbum → `album`; sin tema de grupo y con `base: predeterminado_anterior` «Noche ninja» → `predeterminado_anterior` «Noche ninja»; sin base y con predeterminado → `predeterminado`; sin tema de grupo y con `base: aleatorio` hacia un tema que no está en el catálogo → `respaldo`. Una canción `propio` también lo trae, y nunca vale `propio` ni `cancion`.
- [x] La cola serializa: dos mutaciones lanzadas a la vez se escriben en orden y cada promesa se resuelve tras su escritura. Un fallo de escritura rechaza esa promesa sin bloquear la cola.
- [x] Con 500 canciones en el índice, `catalogo()` (con usos) tarda < 20 ms en la máquina de CI.

## Notas de implementación

**Qué se hizo.** `main/temas/` nuevo, sin tocar `shared/`, IPC ni la biblioteca.
- `catalogo.ts`: `cargarCatalogo`, `escribirCatalogo`, `rutaCatalogo`. Siembra «Shinobi»/«Mi estilo» desde `estiloInicial`; recuperación por `.bak` (vía `leerJson`); esquema más nuevo (principal, o `.bak` si el principal no se lee) a solo lectura **antes** de llamar a `leerJson`, para que un `.bak` antiguo no pise un principal nuevo; ilegible a `temas.json.danado` (sustituye al anterior) y catálogo nuevo con `apartado`.
- `cola.ts`: `ColaApariencia` (FIFO; un fallo rechaza solo su tarea).
- `usos.ts`: `construirCatalogoTemas(catalogo | null, canciones, { soloLectura })` pura, con tipos `CatalogoTemas` (forma de `CatalogoIpc`), `CancionIndice`, `UsosTema`.
- `servicio.ts`: `ServicioTemas.abrir({ dirBiblioteca, puerto, estiloInicial, registro?, alCambiar?, ... })`.
- Fachada: `catalogo()`, `soloLectura`, `datos()`, `crear`, `renombrar`, `duplicar`, `descartarAvisoApartado`, `resolver(cancion)` (devuelve `ResolucionCancion` con `neutra` y `alHeredar`; `neutra` usa `estiloInicial` como estilo heredado), `aparienciaInicial(metadatos, randomInt?) -> { apariencia, estilo }` (con `tema_nombre` dentro de `apariencia`), `enCola`, `notificarIndiceCambiado()` (250 ms), `cerrar()`, `confirmarCatalogo(nuevo)` (para 0166/0167, dentro de `enCola`: escribe y solo entonces adopta y emite). `previsualizar`, `ejecutar`, `reanudarBorrado` y `cancelarBorrado` rechazan con `ErrorNoImplementado` (mensaje `NO_IMPLEMENTADO`). Errores: `ErrorTemas { codigo, detalles? }`.

**Decisiones.**
- `PuertoCanciones.indice()` es síncrono (como `ServicioBiblioteca.listar`) y devuelve `CancionIndice { id, metadatos, modificada, estilo | null, apariencia?, danada: 'json' | 'pistas' | null }`; `actualizar(id, mutador: Cancion => Cancion)`. 0168 lo adapta.
- En solo lectura el catálogo en memoria es `null` (no se interpreta el archivo): `catalogo()` devuelve sin temas, `resolver` usa `indice = null`.
- `borradoPendiente.restantes` = `total` hasta que 0167 lo refine.
- `renombrar` permite cambiar solo mayúsculas del propio nombre; el orden de comprobación es solo lectura, no encontrado, borrado, revisión, nombre.
- Nombre o estilo inválidos: `ARGUMENTOS_NO_VALIDOS`.

**Cómo probarlo.** `cd app && npx vitest run src/main/temas` (46 pruebas en 4 archivos: catalogo 9, cola 3, usos 8, servicio 26).

**Deuda técnica.** Falta cablear en `main/index.ts` (0168). En la suite completa fallan además `config.test.ts` (trabajo en curso de 0164) y las conocidas por EPERM e intermitente del editor.
