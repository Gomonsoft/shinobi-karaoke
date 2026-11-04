# 0008 — Servicio de configuración (config.json y directorio de datos)
- Estado: Hecha
- Paso del pipeline: 0
- Depende de: 0007
- ADRs: 0004, 0006
- Spec UX: docs/ux/sistema-visual.md §8 (estilo predeterminado)

## Objetivo
Crear y mantener el directorio de datos y `config.json`, con una API en main que el resto de servicios y la IPC (0011) puedan usar.

## Criterios de aceptación
- [x] Al arrancar, se crea si no existe la estructura de ADR 0006 bajo `rutaDatos()` (0002): `biblioteca/`, `biblioteca/.importando/`, `modelos/`, `registros/`, `runtime/`.
- [x] Si `config.json` no existe, se crea con los valores por defecto de 0006 (`instalacion.estado: "pendiente"`, `separacion.modo: "automatico"`, `reproductor.volumen: 0.8`, estilo predeterminado de `sistema-visual.md` §8).
- [x] API: `obtener()`, `actualizar(parcial)` (fusiona, valida y escribe con 0007), `suscribir(cb)` para cambios. `modoSeparacionEfectivo()` según ADR 0006 (automatico → según perfil).
- [x] Registro de la app: logs rotados en `registros/app.log` (máx. ~5 MB × 3 archivos) con nivel, fecha y módulo; sin datos personales salvo rutas.
- [x] Tests: creación inicial, lectura tolerante con campos ausentes, actualización parcial, rechazo de valores inválidos (p. ej. volumen 2).
- [x] Para desarrollo: `config.json` con `instalacion.estado: "completa"` se puede generar con el script `semilla` (0009) para saltar el primer arranque, que se implementa en la Fase 2.

## Notas de implementación
- **Qué se hizo**: `app/src/main/configuracion/` (`estructura.ts`: `asegurarEstructuraDatos`; `servicio.ts`: clase `ServicioConfig` con `abrir(datos, {registro})`, `obtener()`, `actualizar(parcial)`, `suscribir(cb)`, `modoSeparacionEfectivo()` y la función pura `modoSeparacionEfectivo(config)`) y `app/src/main/registro/registroApp.ts` (`RegistroArchivo`: `registros/app.log`, línea `fecha [NIVEL] [módulo] mensaje`, rotación a 5 MB conservando `app.log`, `app.1.log`, `app.2.log`; nunca lanza). `main/index.ts` abre el servicio al arrancar (export `servicioConfig`) y llama a `flush()` en `before-quit`.
- **Decisiones**: `actualizar` fusiona en profundidad (objetos se fusionan; arrays y valores simples se sustituyen), valida con `migrarConfig` y solo entonces escribe con `escribirJsonAtomico` y notifica; si es inválido lanza `ErrorDatosInvalidos` y no cambia nada. Las actualizaciones se serializan en una cola. `obtener()` y los callbacks reciben copias. Al abrir se reescribe siempre `config.json` (crea el archivo o completa campos ausentes). Si `config.json` y su `.bak` son ilegibles, se aparta como `config.json.danado` y se parte de los valores por defecto (conservador; se registra como error). Sin `perfil_hardware` el modo automático resuelve a `rapido`. Criterio del script `semilla` (0009): lo cumple el propio formato (`instalacion.estado: "completa"` es válido); el script es de la Fase 2.
- **Cómo probarlo** (desde `app/`): `npx vitest run --project node src/main/configuracion` (15 tests), `npx eslint src/main/configuracion src/main/registro`, `npx tsc --noEmit -p tsconfig.node.json`.
- **Deuda técnica**: el registro de la app no se ha cableado a otros módulos (solo configuración y arranque); `servicioConfig` se expone como variable de módulo hasta que 0011 defina la inyección; el vaciado de `.importando/` al arrancar pertenece a la tarea de biblioteca.
