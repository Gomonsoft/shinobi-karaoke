# 0181 — Servicio de sesión e IPC en main

- Estado: Hecha
- Paso del pipeline: 6 (y 4 por el bloqueo)
- Depende de: [0178](0178-modelo-puro-de-cola-y-maquina-de-sesion.md), [0180](0180-pantallas-ventana-secundaria-pantalla-completa-y-reposo.md)
- ADRs: [0017](../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md) §3–§9 y §11, [0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md#revisión-para-020--fase-4), [0011](../adr/0011-reproductor-pantalla-completa-y-reutilizacion-del-motor.md#revisión-para-020--fase-4), [0008](../adr/0008-seguridad-de-electron-y-protocolos-propios.md#revisión-para-020--fase-4)
- Spec UX: [Biblioteca · Fase 4](../ux/02-biblioteca.md#fase-4-de-020--ventana-secundaria-y-cola) (códigos que muestra el diálogo y el panel), [Editor · Fase 4](../ux/06-editor.md#fase-4-de-020--ventana-secundaria-y-cola) (alcance del bloqueo) y [Reproductor · Fase 4](../ux/07-reproductor.md#fase-4-de-020--ventana-secundaria-y-cola)

## Objetivo

Integrar la máquina de [0178](0178-modelo-puro-de-cola-y-maquina-de-sesion.md) y las piezas nativas de [0180](0180-pantallas-ventana-secundaria-pantalla-completa-y-reposo.md) en `ServicioSesion`, conectarlo al arranque, a la biblioteca, al control de cierre y al IPC. **Es la única tarea de la fase que modifica `main/ipc/handlers.ts` (salvo el registro de [0179](0179-roles-de-ventana-remitente-por-rol-y-documento-secundario.md)), `main/index.ts` (después de 0179 y 0180) y `main/cierre.ts`.**

## Contrato

- **`main/sesion/servicio.ts`**: `ServicioSesion` serializa cada evento en una cadena de promesas, aplica `reducir` con `performance.now()` inyectable y ejecuta los efectos:
  - `comando` → `webContents.send` a la secundaria;
  - `programar`/`cancelar` → `setTimeout` inyectable que entrega `vencida(transicionId)`;
  - `revalidar` → `biblioteca.obtener` + estado Lista + `comprobarPistas`, con el resultado como evento `revalidada`. Si no se puede leer el `cancion.json`, el motivo es `ilegible`; si falta el instrumental, `sin_pistas`;
  - `difundir` → `sesion:estado` a la principal y `sesion:estadoSecundaria` a la secundaria. `sesion:posicion` sale como mucho 1 vez por segundo;
  - `bloquearEdicion`/`liberarEdicion`, el silencio de la principal (`setAudioMuted`, con el valor previo restaurado), `GestorReposo.retener/liberar('sesion')` y `guardarPreferenciaPantalla` (`config.reproductor.secundaria`).
- **Biblioteca**: suscripción a los eventos de canción. Una canción eliminada quita sus entradas; una que pasa a borrador o a dañada marca su disponibilidad; un cambio de título lo actualiza.
- **IPC** (`handlers.ts`):
  - registra todos los canales nuevos de §11 contra `ServicioSesion` y comprueba que la secundaria sea la de la sesión vigente (paso 5 del remitente);
  - **defensas**:
    - `EDICION_BLOQUEADA` en `letras.abrirEdicion`, `letras.guardarTiempos`, `letras.guardar`, `letras.editarTexto`, `letras.leerArchivo`, `biblioteca.guardarApariencia` y `biblioteca.marcarLista`;
    - `SESION_EN_CURSO` en `ventana.modoReproductor(true)`;
    - `CANCION_EN_REPRODUCCION` en `biblioteca.eliminar` y `biblioteca.volverABorrador` de la canción activa;
    - `GUARDADO_PENDIENTE` en `sesion.abrir` si `app.guardadoPendiente` está activo;
  - al aceptar una sesión, se libera una visita de letra que siguiera abierta.
- **Cierre de la secundaria**: `close` interceptado con `alCerrarSolicitado` → `solicitarCierre('secundaria')`. Si se confirma, se fuerza o se sale, la ventana se cierra de verdad.
- **Control de cierre** (`main/cierre.ts` y `main/index.ts`):
  - `hayAlgoEnCurso` incluye `sesionActiva` y `colaNoVacia`;
  - el motivo llega al renderer en `app:solicitudCierre` (`{ trabajos, sesion, cola, variante: 'salir' | 'cerrarVentanaMac' }`) para que [0189](0189-salir-de-la-app-con-sesion-o-cola.md) elija el texto;
  - al confirmar, la secundaria se cierra sin el diálogo de cola. Con `cerrarVentanaMac` la cola se conserva;
  - `before-quit` llama a `liberarTodo()`.
- **Retirar** el atajo de prueba de [0179](0179-roles-de-ventana-remitente-por-rol-y-documento-secundario.md), o sustituirlo por `sesion.abrir` real.
- **Estado reducido de la secundaria** (respuesta a [0068](../preguntas/0068-ids-y-conteo-en-el-estado-reducido-de-la-secundaria.md), ADR 0017 §10, revisión 2). Corresponde a esta tarea:
  - ampliar `estadoSecundariaIpcSchema` en `shared/sesion.ts`: `candidata.entradaId`, `activa: { entradaId, titulo, artista } | null` y `pendientes: int ≥ 0`, que sustituye a `hayPendientes`;
  - ampliar los comandos `transicion` (`candidata.entradaId`) y `error` (`entradaId`, `titulo`), y ajustar los fixtures de `shared/__fixtures__/sesion.ts`;
  - calcular los campos nuevos en `aIpcSecundaria` y en los comandos de `main/sesion/proyeccion.ts` y `maquina.ts`;
  - ajustar `renderer/src/secundaria/AppSecundaria.tsx` y `secundaria/textos.ts`. `empezar` usa `candidata.entradaId`; `siguiente` y `repetir` usan `activa.entradaId`; S4 muestra `activa.titulo`, y `ses.cierre` muestra el número. Se retira la opción provisional de 0182.

  Es una excepción explícita a la propiedad de archivos de la fase (`shared/` era de 0177, y `secundaria/` de 0182).

## Archivos

`app/src/main/sesion/servicio.ts` (y su prueba de integración con dobles), `app/src/main/ipc/handlers.ts` y `handlers.test.ts`, `app/src/main/index.ts`, `app/src/main/cierre.ts` y `cierre.test.ts`. Por 0068 también `app/src/shared/sesion.ts`, `app/src/shared/__fixtures__/sesion.ts`, `app/src/main/sesion/{proyeccion,maquina}.ts` (y sus pruebas) y `app/src/renderer/src/secundaria/{AppSecundaria.tsx,textos.ts}` (y sus pruebas). Solo lee `main/sesion/{cola,maquina,proyeccion,pantallas,ventanaSecundaria}.ts`, y cualquier cambio en ellos se coordina con su tarea.

## Criterios de aceptación

- [ ] 0068:
  - en S1 y S2, «Empezar ya» e «Iniciar» de la secundaria consumen la candidata;
  - un fallo al consumir una entrada que la secundaria nunca cargó muestra su título en S4, y «Pasar a la siguiente canción» desde la secundaria avanza una sola vez;
  - «Otra vez» en S3 repite la última;
  - el diálogo de cierre de la secundaria dice «Quedan {n} canciones».

  Se prueba con Vitest en `proyeccion.test.ts` y en las pruebas de `AppSecundaria`.

- [ ] Integración con dobles (ventanas, pantallas, biblioteca y reloj):
  - un `fin` y dos `siguiente` intercalados con una revalidación lenta producen un solo avance;
  - `cola.mover` durante una revalidación se aplica después, sin perderse;
  - una canción eliminada mientras espera desaparece de la cola;
  - una que vuelve a borrador queda `no_lista` y, al consumirla, da `error` sin `cargar`.
- [ ] Durante la sesión, todas las escrituras de edición de la lista responden `EDICION_BLOQUEADA`, en todas las fases, incluida la de diálogo de cierre abierto. Tras cerrar, por cualquier causa, vuelven a funcionar.
- [ ] La secundaria de otra sesión (un `webContents` viejo) no puede informar. Un `sesionId` ajeno da `{ aplicado: false }`.
- [ ] Al caer el renderer de la secundaria:
  - la sesión termina con la cola y el contexto conservados;
  - el bloqueo de edición y el de reposo se liberan;
  - la principal deja de estar silenciada.
- [ ] `sesion.abrir` con `app.guardadoPendiente(true)` responde `GUARDADO_PENDIENTE` y no crea ninguna ventana.
- [ ] Salir con sesión o con cola envía `app:solicitudCierre` con el motivo. Sin sesión ni cola, no se pregunta por este motivo.
- [ ] E2E mínimo (`e2e/sesion-main.spec.ts`) con pantallas simuladas: abrir, recibir `cargar` en la secundaria e informar `fin` dos veces da una sola cuenta. Esto se comprueba en `sesion:estado`.

## Notas de implementación

### Qué se hizo

- `main/sesion/servicio.ts` (nuevo): `ServicioSesion` con la máquina de 0178. Cada evento pasa por una cadena de promesas y `reducir` con reloj inyectable. Ejecuta los efectos:
  - `comando`: se completa con `sesionId` y `revision`, y `cargar` con el DTO preparado en la revalidación (sin rutas). Los comandos que definen la pantalla (`cargar`, `transicion`, `fin_de_cola`, `error`) se guardan como `comandoActual` para `sesion.inicial`.
  - `programar` y `cancelar`: `setTimeout` inyectable que entrega `vencida`.
  - `revalidar`: `obtener` + estado Lista + `comprobarPistas`. Da `ilegible` sin `cancion.json` legible, `sin_pistas` si falta el instrumental, `no_lista` y `no_encontrada`. Devuelve `duracionMs` y `primeraLineaMs`.
  - `difundir`: `sesion:estado` a la principal y `sesion:estadoSecundaria` a la secundaria. `sesion:posicion` sale como mucho 1 vez por segundo y entrada.
  - Bloqueo de edición, silencio de la principal (se restaura el valor previo), `GestorReposo` (`retener/liberar('sesion')`) y `config.reproductor.secundaria`.
  - Suscripción a la biblioteca (eliminada, título y disponibilidad: borrador → `no_lista`, dañada → `sin_pistas` o `ilegible`).
  - Ventana: cierre interceptado (`close` → `solicitarCierre('secundaria')`), caída, «no responde», pantalla perdida o reconectada, y pantalla completa.
  - Pantallas: `pantallas:cambiadas` a la principal.
- `main/ipc/handlers.ts`: se retira `CanalDeSesionPendiente`. Hay manejadores para los 24 canales nuevos, con un `ContextoIpc { rol, sender }` que fija main (`OpcionesRegistro.rolDe`).
  - Defensas: `EDICION_BLOQUEADA`, `SESION_EN_CURSO`, `CANCION_EN_REPRODUCCION` y `GUARDADO_PENDIENTE` (dependencia `guardadoPendiente`).
  - Los canales compartidos devuelven el estado del rol que llama.
  - Un `webContents` que no es el de la sesión vigente recibe `SESION_NO_ACTIVA`. `informar` le responde `{ aplicado: false }`.
  - `ventana.fijarPantallaCompleta` y `estaEnPantallaCompleta` desde la secundaria actúan sobre su ventana.
  - `sesion:preferencias` va a la secundaria solo si cambia `config.reproductor`.
- `main/index.ts`: crea `ServicioSesion` con `abrirSecundaria` (la función `crearVentanaSecundaria` registra el rol, llama a `bloquearNavegacionTotal` y carga `reproductor.html`). Lee `SHINOBI_PANTALLAS_SIMULADAS` y `SHINOBI_PANTALLA_COMPLETA_SIMULADA`. Se retira el atajo de prueba de 0179 (`SHINOBI_VENTANA_SECUNDARIA_PRUEBA` y el menú `dev-secundaria-prueba`), y `e2e/seguridad.spec.ts` abre ahora la sesión real.
- `main/cierre.ts`: `hayAlgoEnCurso` incluye `sesionActiva` y `colaNoVacia`. `motivoDeCierre` y la intención (`ventana` o `salir`) llegan a `hayAlgoEnCurso` y `pedirConfirmacion`. `app:solicitudCierre` lleva `{ trabajos, sesion, cola, variante }` (`SolicitudCierreIpc` en `shared/sesion.ts`; el preload reenvía la carga y `alSolicitudCierre(cb: (motivo) => void)`).
  - macOS, cerrar la ventana: variante `cerrarVentanaMac`. Solo pregunta por la sesión, cierra la secundaria y conserva la cola.
  - Otras plataformas y salir: `prepararSalida()` cierra la secundaria sin su diálogo y ya no vuelve a preguntar.
  - `before-quit` llama a `prepararSalida()` y a `liberarTodo()`.
- 0068 (ADR 0017 §10, revisión 2):
  - `shared/sesion.ts`: `candidata.entradaId`, `activa` y `pendientes` (sustituye a `hayPendientes`); `transicion.candidata.entradaId`; `error` con `entradaId` y `titulo`.
  - Fixtures, `proyeccion.ts` y `maquina.ts` ajustados.
  - `AppSecundaria`: `empezar` usa `candidata.entradaId`; `siguiente` y `repetir`, `activa.entradaId`. S4 muestra `activa.titulo`. `DialogoCierreSesion` dice «Quedan {n} canciones…». `secundaria/textos.ts` reexporta `SES` de `sesion/textos.ts` y se retira la opción provisional.
  - `PantallaEstadoSesion` solo cambia `hayPendientes` por `pendientes > 0`.

### Cómo probarlo

`cd app && npm run typecheck && npm run lint && npm run format:check && npx vitest run`.
E2E: `npm run build && npx playwright test e2e/sesion-main.spec.ts e2e/seguridad.spec.ts e2e/ipc.spec.ts`.
Pruebas nuevas: `main/sesion/servicio.test.ts` (35 casos con dobles de biblioteca, ventana, reloj y temporizadores), `main/ipc/handlers.sesion.test.ts`, `cierre.test.ts`, `proyeccion.test.ts`, `maquina.test.ts`, `AppSecundaria.test.tsx` y `e2e/sesion-main.spec.ts`.

### Desviaciones y decisiones

- **Excepción 0068 a la propiedad de archivos**: se tocaron `shared/sesion.ts`, `shared/__fixtures__/sesion.ts`, `shared/sesion.test.ts`, `shared/ipc.ts` (tipo de `alSolicitudCierre`), `main/sesion/{proyeccion,maquina}.ts` con sus pruebas y `renderer/src/secundaria/*`. También `renderer/src/vistas/reproductor/sesion/PantallaEstadoSesion.tsx` (una línea) y `e2e/ipc.spec.ts`, cuya lista de claves de `window.shinobi` no se actualizó en 0177. No se tocó `vistas/biblioteca` ni `renderer/src/sesion`.
- **Evento nuevo en la máquina**: `{ tipo: 'pantallaCompleta', activa }`. `pantalla.movida` limpiaría incidencias y no servía para reflejar la pantalla completa. Cubierto con prueba.
- **Corrección en 0180 (`ventanaSecundaria.ts`)**: la recarga se detectaba con `did-start-navigation`, que también salta con las navegaciones que `bloquearNavegacionTotal` cancela. Un intento de navegar terminaba la sesión (lo detectó `e2e/seguridad.spec.ts`). Ahora se detecta con `did-navigate` posterior a `did-finish-load`. La prueba se ajustó.
- **Pantalla perdida**: la secundaria va a la pantalla primaria, como en la tarea y la spec 07. El ADR 0017 §3 decía «la de la principal». Se mantiene y se anota.
- `silencioPrevio` del DTO es `anuncio === 'inicio'`. `revalidada` recibe `primeraLineaMs` (`inicio_ms + offset_ms` de la primera línea con tiempo).
- Un cierre por `forzarCierre` o `cerrarConservando` usa la causa `forzada` (conserva la cola, sin incidencia). La caída (`secundaria_caida`) solo viene de `render-process-gone` o de una recarga.
- `ventana.fijarPantallaCompleta` y `ventana.estaEnPantallaCompleta` tienen `ROLES_POR_CANAL = AMBAS`; los resuelve el rol (la secundaria actúa sobre su ventana).
- `RegistroVentanas` admite un solo `secundaria`, y se da de baja en `closed`: un `webContents` viejo no pasa el paso 5 del remitente. Además `esSecundariaVigente` compara con el de la sesión.

### Deuda técnica y notas para otras tareas

- En S4, `pendientes` cuenta también la fallida si era la candidata. El botón «Pasar a la siguiente canción» puede aparecer sin una siguiente real, y main lo ignora. Haría falta un campo aparte para distinguirlo.
- `app:solicitudCierre` ya lleva el motivo, pero el diálogo del renderer (`DialogoCierre.tsx`) sigue respondiendo como antes. Los textos `ses.salir` son de 0189.
- `sesion.preferencias` devuelve `config.reproductor` completo, con `secundaria` (ver deuda de 0177). No se estrechó.
- `e2e/ventana.spec.ts` (DPR 1) falla en esta máquina macOS (DPR distinto de 1); no se comprobó si ya fallaba antes de esta tarea. No se ejecutó la suite E2E completa, por política.
