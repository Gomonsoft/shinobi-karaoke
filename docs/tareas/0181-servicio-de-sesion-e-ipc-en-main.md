# 0181 — Servicio de sesión e IPC en main

- Estado: Pendiente
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

## Archivos

`app/src/main/sesion/servicio.ts` (y su prueba de integración con dobles), `app/src/main/ipc/handlers.ts` y `handlers.test.ts`, `app/src/main/index.ts`, `app/src/main/cierre.ts` y `cierre.test.ts`. Solo lee `main/sesion/{cola,maquina,proyeccion,pantallas,ventanaSecundaria}.ts`, y cualquier cambio en ellos se coordina con su tarea.

## Criterios de aceptación

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
