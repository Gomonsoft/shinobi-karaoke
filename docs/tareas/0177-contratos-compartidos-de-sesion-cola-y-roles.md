# 0177 — Contratos compartidos de sesión, cola y roles

- Estado: Hecha
- Paso del pipeline: 6 (y 4 por el bloqueo)
- Depende de: fase 3 integrada
- ADRs: [0017](../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md) §5, §7, §10, §11 y §12, [0006](../adr/0006-persistencia-y-modelo-de-datos.md#revisión-para-020--fase-4), [0008](../adr/0008-seguridad-de-electron-y-protocolos-propios.md#revisión-para-020--fase-4)
- Spec UX: [Biblioteca · Fase 4](../ux/02-biblioteca.md#fase-4-de-020--ventana-secundaria-y-cola) (claves `cola.causa.*`), [Reproductor · Fase 4](../ux/07-reproductor.md#fase-4-de-020--ventana-secundaria-y-cola) y [Ajustes · Fase 4](../ux/08-ajustes-y-acerca.md#fase-4-de-020--ventana-secundaria-y-cola)

## Objetivo

Fijar en `shared/` y en los preloads todo el contrato de la fase 4, para que main y renderer puedan avanzar en paralelo contra dobles. **Es la única tarea de la fase que modifica `shared/ipc.ts`, `shared/canales.ts`, `shared/errores.ts`, `shared/config.ts` y `preload/`.** No implementa la lógica.

## Contrato

- **`shared/sesion.ts`** (nuevo), con los tipos y esquemas Zod del ADR 0017:
  - `EntradaIpc`, `EstadoSesionIpc` (fases, `cierrePendiente` con el rol de origen, `transicion`, `error` con `MotivoFallo` y `codigo`, incidencias, `contexto` con `pausada`/`terminada`) y `EstadoSecundariaIpc`;
  - `PantallaIpc`, `ListaPantallasIpc` (con `colocacion`);
  - `MotivoNoDisponible`, `MotivoFallo`;
  - `ComandoSecundariaIpc` (`cargar`, `pausar`, `reanudar`, `reiniciar`, `transicion`, `fin_de_cola`, `error`) y su DTO de entrada (§10);
  - `InformeSecundariaIpc` (`lista`, `reproduciendo`, `pausada`, `posicion`, `fin`, `error`);
  - límites de §11: UUID, `idCancionSchema`, `posicionMs` en [−60 000, 86 400 000], `revision` ≥ 0 y enumeraciones cerradas;
  - constante `MAXIMO_PENDIENTES = 500`.
- **`shared/canales.ts`**:
  - los canales nuevos de §11 (`pantallas.*`, `sesion.*`, `cola.*`) y los eventos `sesion:estado`, `sesion:posicion`, `pantallas:cambiadas`, `sesion:comando`, `sesion:estadoSecundaria` y `sesion:preferencias`;
  - `ROLES_POR_CANAL`: el tipo `'principal' | 'secundaria'` y, para **cada** canal invocable (los existentes y los nuevos), sus roles permitidos. `ventana.fijarPantallaCompleta` y `ventana.estaEnPantallaCompleta` admiten los dos roles. Los demás canales existentes, solo `principal`.
- **`shared/ipc.ts`**:
  - entradas de `CONTRATO` para los canales nuevos, con las respuestas de §11 (`cola.agregar` → `{ estado, entradaId }`, `cola.quitar` → `{ estado, antesDe }` y `cola.vaciar({ contexto })`);
  - `ApiShinobi` gana `pantallas`, `sesion` y `cola`, con sus suscripciones (`alCambiarSesion`, `alPosicionSesion`, `alCambiarPantallas`);
  - tipo nuevo `ApiReproductor` (`window.shinobiReproductor`), solo con lo de la secundaria: `sesion.inicial`, `informar`, `siguiente`, `empezar`, `detenerTransicion`, `repetir`, cierre (`solicitar`, `confirmar`, `cancelar`), `preferencias`, `guardarPreferencias`, `ventana.fijarPantallaCompleta`, `ventana.estaEnPantallaCompleta`, `ventana.alCambiarPantallaCompleta`, `alComando`, `alEstado` y `alPreferencias`.
- **`shared/errores.ts`**: `EDICION_BLOQUEADA`, `SESION_EN_CURSO`, `SESION_NO_ACTIVA`, `GUARDADO_PENDIENTE`, `PANTALLA_NO_DISPONIBLE`, `CANCION_NO_DISPONIBLE`, `CANCION_EN_REPRODUCCION`, `ENTRADA_NO_ENCONTRADA` y `COLA_LLENA`.
- **`shared/config.ts`** (ADR 0006, revisión de fase 4):
  - `reproductor.transicion_s` es un entero de 1 a 30 con 4 por defecto, con `.catch(4)`;
  - `reproductor.secundaria` vale `{ pantalla: { id, etiqueta, ancho, alto }, pantalla_completa } | null`, con `.catch(null)`;
  - `configParcialRendererSchema` admite `transicion_s` (de 1 a 30) y no admite `secundaria`;
  - `preferenciasSecundariaSchema` es estricto, con `volumen`, `silenciado`, `voz_guia` y `voz_guia_silenciada`.
- **Preload**:
  - `preload/index.ts` añade los grupos nuevos a `window.shinobi`;
  - `preload/secundaria.ts` (nuevo) expone `window.shinobiReproductor` con el mismo patrón de `invocar` y `suscribir`, y **no** expone `window.shinobi`.
- **Dobles**: `shared/__fixtures__/sesion.ts` con constructores de `EstadoSesionIpc` y `EstadoSecundariaIpc` para cada fase (P1–P6 y S1–S4) y una `ApiReproductor` falsa, para las pruebas del renderer de 0182–0187.

## Archivos

`app/src/shared/{sesion,canales,ipc,errores,config}.ts` y sus pruebas, `app/src/shared/__fixtures__/sesion.ts`, `app/src/preload/index.ts` y `app/src/preload/secundaria.ts`. No toca `electron.vite.config.ts`: la entrada del preload nuevo la añade [0179](0179-roles-de-ventana-remitente-por-rol-y-documento-secundario.md).

## Criterios de aceptación

- [x] Una prueba recorre `Object.keys(CONTRATO)` y falla si algún canal no tiene roles en `ROLES_POR_CANAL`, o si alguno no existe.
- [x] Los esquemas rechazan:
  - un UUID mal formado;
  - una `posicionMs` fuera de rango;
  - un `tipo` de informe desconocido;
  - `cola.agregar` con `donde` desconocido;
  - `cola.mover` sin `antesDe`;
  - `guardarPreferencias` con una clave ajena (`transicion_s`).
- [x] `config.json` con `transicion_s: 0`, `"4"` o `99` se lee como 4, sin apartar el archivo. `secundaria` mal formado se lee como `null`. `configParcialRendererSchema` acepta 2 y 15, y rechaza 0 y 31.
- [x] `window.shinobiReproductor` no tiene `biblioteca`, `temas`, `config` ni `cola` (prueba de tipos y de ejecución del objeto expuesto).
- [x] `tsc`, ESLint y Vitest en verde. Los canales nuevos aún no tienen manejador, y las pruebas de `handlers` existentes siguen en verde.

## Notas de implementación

### Qué se hizo

- `shared/sesion.ts` (nuevo): esquemas Zod y tipos de §5, §7, §10 y §11 (entradas, estado de sesión y de la secundaria, pantallas, comandos, informes, argumentos y respuestas de cola y sesión), `MAXIMO_PENDIENTES = 500` y los límites de posición y revisión. `idCancionSchema` vive ahora aquí (para evitar un ciclo con `ipc.ts`) y `ipc.ts` lo reexporta.
- `shared/canales.ts`: grupos `pantallas`, `sesion` y `cola`, seis eventos nuevos, `RolVentana`, `NombreCanalInvocable` y `ROLES_POR_CANAL` (el tipo obliga a declarar todos los canales invocables).
- `shared/ipc.ts`: 24 entradas nuevas en `CONTRATO`, `ApiShinobi` con `pantallas`, `sesion`, `cola`, `alCambiarSesion`, `alPosicionSesion` y `alCambiarPantallas`, y `ApiReproductor`. `configParcialRendererSchema` admite `transicion_s` (1–30).
- `shared/errores.ts`: los nueve códigos, también en `CODIGOS_SOLO_MAIN` (el worker no los emite).
- `shared/config.ts`: `reproductor.transicion_s` y `secundaria` con lectura tolerante, `preferenciasSecundariaSchema` y `reproductorSchema` exportados.
- `preload/index.ts` y `preload/secundaria.ts` (nuevo, sin `window.shinobi`).
- `shared/__fixtures__/sesion.ts`: `estadoP1`–`estadoP6` (más `estadoP4FinDeCola` y `estadoSinCola`), `estadoS1`–`estadoS4`, `entrada`, `pantalla` y `crearApiReproductorFalsa`.
- Pruebas: `shared/sesion.test.ts`, `shared/preloadSecundaria.test.ts` (mock de `electron`; está en `shared/` porque `vitest.config.ts` no incluye `src/preload`).

### Cómo probarlo

`npm run typecheck`, `npm run lint` y `npm test` en `app/`.

### Desviaciones y decisiones provisionales

- **Dos retoques fuera de la lista de archivos**, necesarios para mantener `tsc` y las pruebas en verde:
  - `main/ipc/handlers.ts`: `crearManejadores` devuelve `Record<Exclude<CanalInvocable, CanalDeSesionPendiente>, …>` (los canales `pantallas:`, `sesion:` y `cola:` aún no tienen manejador), y `handlers.test.ts` excluye esos canales del recuento. **0181 debe retirar la exclusión** al registrar los manejadores.
  - `renderer/src/karaoke/useVolumenCompartido.ts` enviaba `config.reproductor` entero a `config.actualizar`, que ahora incluye `secundaria` (el esquema del renderer la rechaza). Ahora solo toma y envía los cuatro campos de sonido.
  - También se actualizaron los valores esperados de `config.test.ts`, `servicio.test.ts` y `separacion.test.ts`.
- `cierrePendiente` es `null | { origen: 'principal' | 'secundaria' }` (el ADR lo dibuja como booleano, pero la tarea pide el rol de origen).
- Campos que el ADR no concreta, fijados de forma provisional:
  - incidencias: `pantalla_perdida { etiqueta, estabaEnPantallaCompleta }`, `pantalla_reconectada { etiqueta, pantallaId }`, `secundaria_no_responde`, y fuera de sesión `secundaria_caida` y `reanudacion_fallida { motivo }`;
  - `pausar.causa` es un texto de hasta 50 caracteres;
  - el comando `transicion` lleva `transicion: {candidata, restanteMs, duracionMs} | null`;
  - `pausar`, `reanudar` y `reiniciar` llevan `entradaId`, para que la secundaria ignore los de otra entrada;
  - el informe `error` lleva `{ motivo: 'no_encontrada' | 'lectura' | 'decodificacion', pista: 'instrumental' | 'voz' }`;
  - `EstadoSecundariaIpc` incluye también `transicion` (para la cuenta de S1) además de lo listado en §10.
- Las suscripciones `alCambiarSesion`, `alPosicionSesion` y `alCambiarPantallas` cuelgan de la raíz de `ApiShinobi` (como `alCambiarCancion`); `alComando`, `alEstado` y `alPreferencias` de la raíz de `ApiReproductor`.
- Los canales `sesion.estado`/`sesion.preferencias` comparten nombre con los eventos `sesion:estado`/`sesion:preferencias` del ADR: es válido en Electron (`handle` frente a `send`) y está así en el ADR.

### Deuda técnica

- El contrato de `sesion.preferencias` y `sesion.guardarPreferencias` devuelve `config.reproductor` completo, incluida `secundaria`. Si 0181 prefiere ocultarla a la secundaria, bastará con estrechar `res`.
