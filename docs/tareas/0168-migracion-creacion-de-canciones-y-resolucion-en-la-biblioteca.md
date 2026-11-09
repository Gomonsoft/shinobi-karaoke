# 0168 — Migración, creación de canciones y resolución en la biblioteca

- Estado: Pendiente
- Paso del pipeline: 1, 4 y 5
- Depende de: [0164](0164-contratos-ipc-de-temas-y-apariencia.md), [0165](0165-catalogo-y-cola-de-apariencia-en-main.md) (en paralelo con [0166](0166-impactos-fichas-y-operaciones-confirmadas.md) y [0167](0167-borrado-recuperable-de-temas.md): cablea su fachada)
- ADRs: [0016](../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md) §2, §5, §6, §9–§11, [0006](../adr/0006-persistencia-y-modelo-de-datos.md#revisión-para-020--fase-3), [0008](../adr/0008-seguridad-de-electron-y-protocolos-propios.md#revisión-para-020--fase-3)
- Specs: [Editor · Fase 3](../ux/06-editor.md#fase-3-de-020--temas-y-biblioteca) (T1, T22), [Ajustes · Fase 3, «Migración desde 0.1.0»](../ux/08-ajustes-y-acerca.md#migración-desde-010) (A3, A5, A7b), [Biblioteca · Fase 3, «Tarjeta: tema y portada» y «Editar datos»](../ux/02-biblioteca.md#tarjeta-tema-y-portada)

## Objetivo

Conectar `ServicioTemas` con `ServicioBiblioteca`, el arranque y el IPC: resumen y `obtener` resueltos, `guardarApariencia` completo, creación de canciones y edición de metadatos por la cola de apariencia, refresco de instantánea, apertura de bibliotecas de 0.1.0 sin reescritura y semilla de desarrollo con temas. **Es la única tarea que modifica `main/biblioteca/servicio.ts`, `main/index.ts` y `main/ipc/handlers.ts` en esta fase** (tras el puente de 0164).

## Contrato

- **Arranque** (`main/index.ts`): crea `ServicioTemas` tras `ServicioConfig` y antes de exponer la biblioteca; le pasa `config.estilo_predeterminado` solo para sembrar y para `neutra`. `ServicioBiblioteca` deja de recibir `estiloPredeterminado`.
- **Puerto**: `ServicioBiblioteca` implementa `PuertoCanciones` de 0165. Toda escritura de una canción con `modo` `tema`/`heredar` refresca de oportunidad `estilo` y `tema_nombre` con la resolución vigente (ADR 0016 §2), sin escrituras extra.
- **Creación** (importación local y YouTube, `construir` en las dos rutas): dentro de `temas.enCola`, `apariencia` y `estilo` iniciales de `aparienciaInicial(metadatos)` (con precedencia de álbum y artista en la instantánea).
- **Metadatos**: `actualizarMetadatos` pasa por la cola; el resumen devuelto lleva la apariencia nueva. Tras crear, editar metadatos, mover a la papelera o restaurar, llama a `notificarIndiceCambiado()`.
- **Resumen** (`resumen.ts`) y **`obtener`**: sustituyen los valores provisionales de 0164 por `temas.resolver(cancion)` de 0165 (resolución, `neutra` y `alHeredar`, ADR 0016 §3 y §9, revisión 2), sin volver a resolver en `main/biblioteca/`. `estilo` del resumen = resuelto. Las dañadas por JSON siguen como hoy.
- **`guardarApariencia(id, seleccion)`** por la cola: `propio` escribe `{ modo: "propio" }` y el estilo; `tema` exige tema existente y no en borrado (`TEMA_NO_ENCONTRADO`/`BORRADO_PENDIENTE`); `heredar` conserva `base`. En solo lectura solo se admite `propio`.
- **IPC** (`handlers.ts`): registra todos los canales `temas.*` del ADR 0016 §11 contra la fachada de 0165 (los métodos de 0166/0167 se activan solos al integrarse), con validación Zod en main, remitente comprobado y errores sin rutas. Reenvía `temas:cambiado` y `temas:progreso` a la ventana.
- **Bibliotecas de esquema 1**: no se reescribe ningún `cancion.json` al abrir ni al listar. Se leen como `propio` con su `estilo`.
- **Semilla** (`semilla.ts`, la que usan E2E y capturas): opción para sembrar el conjunto de [revision-fase-3](../ux/revision-fase-3/README.md#datos-de-prueba): temas «Neón», «Noche ninja» (predeterminado) y «Sol»; Queen con tema de artista y «A Night at the Opera» con tema de álbum; «Greatest Hits» de ABBA y de Queen; canciones sin artista y sin álbum; una personalizada de 0.1.0 (sin `apariencia`); una con referencia a un tema inexistente y `tema_nombre`; una de YouTube con miniatura; una que hereda con `base: { tipo: "predeterminado_anterior", tema_id: <Sol> }` (procedencia «Tema predeterminado anterior», como si se hubiera quitado y vuelto a poner el predeterminado) y otra asignada a «Neón» con esa misma base, para «Volver a heredar» (T2b); las dos de un artista y un álbum sin tema.

## Archivos

- `app/src/main/biblioteca/servicio.ts`, `resumen.ts`, `operaciones.ts` (si crea o actualiza canciones), `semilla.ts` y sus pruebas (`servicio.test.ts`, `escritura.test.ts`, `semilla.test.ts`).
- No modifica `app/src/main/temas/` (lo tocan 0166 y 0167 en paralelo): el puerto se inyecta al construir `ServicioTemas` en `index.ts`. Si hace falta un cambio en la fachada, se coordina con quien tenga abierta 0166/0167.
- `app/src/main/index.ts`.
- `app/src/main/ipc/handlers.ts`, `handlers.test.ts`.
- Rutas de creación de `main/fuente/` si llaman a `construir` de otra forma.

## Criterios de aceptación

- [ ] T1/A7b: una biblioteca de 0.1.0 copiada en un perfil limpio arranca, se crea «Shinobi» (o «Mi estilo»), `biblioteca.listar` da cada canción con procedencia `propio` y su estilo exacto, y ningún `cancion.json` cambia (hash antes y después).
- [ ] A3/A5: con predeterminado, una canción nueva hereda sin base y resuelve `predeterminado`; con tema de artista, `artista`; sin predeterminado y con 3 temas, `base: aleatorio` estable tras reiniciar; con catálogo vacío, `incluido`. La instantánea `estilo` del archivo coincide con lo resuelto.
- [ ] Editar el artista de una canción que hereda a uno con tema devuelve el resumen con procedencia `artista`; el `cancion.json` refresca su instantánea en esa misma escritura.
- [ ] `guardarApariencia` con un tema inexistente → `TEMA_NO_ENCONTRADO`; con `heredar` conserva la `base`; en solo lectura, `tema` → `TEMAS_SOLO_LECTURA` y `propio` funciona.
- [ ] `alHeredar` llega igual en el resumen, en `resuelta` y en la respuesta de `guardarApariencia`: tras asignar un tema a la canción de la semilla con base `predeterminado_anterior`, vale `{ procedencia: "predeterminado_anterior", temaNombre: "Sol" }`; tras asignar un tema a su artista, el siguiente `biblioteca.listar()` da `artista`.
- [ ] Portada: el resumen de una canción de YouTube con procedencia `predeterminado` tiene `neutra: true`; tras asignarle tema a su álbum, `false`.
- [ ] Una canción que apunta a un tema inexistente resuelve `respaldo` con su instantánea y su `tema_nombre`; `catalogo().referenciasFaltantes = 1`.
- [ ] Todos los canales `temas.*` rechazan argumentos inválidos y remitentes ajenos (pruebas de `handlers.test.ts` como en 0151/0155).
- [ ] `tsc`, Vitest y los E2E existentes en verde; `SHINOBI_SEMILLA` (o el mecanismo actual) siembra el conjunto de temas sin red.

## Notas de implementación
