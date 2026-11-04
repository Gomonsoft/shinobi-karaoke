# 0008 — Servicio de configuración (config.json y directorio de datos)
- Estado: Pendiente
- Paso del pipeline: 0
- Depende de: 0007
- ADRs: 0004, 0006
- Spec UX: docs/ux/sistema-visual.md §8 (estilo predeterminado)

## Objetivo
Crear y mantener el directorio de datos y `config.json`, con una API en main que el resto de servicios y la IPC (0011) puedan usar.

## Criterios de aceptación
- [ ] Al arrancar, se crea si no existe la estructura de ADR 0006 bajo `rutaDatos()` (0002): `biblioteca/`, `biblioteca/.importando/`, `modelos/`, `registros/`, `runtime/`.
- [ ] Si `config.json` no existe, se crea con los valores por defecto de 0006 (`instalacion.estado: "pendiente"`, `separacion.modo: "automatico"`, `reproductor.volumen: 0.8`, estilo predeterminado de `sistema-visual.md` §8).
- [ ] API: `obtener()`, `actualizar(parcial)` (fusiona, valida y escribe con 0007), `suscribir(cb)` para cambios. `modoSeparacionEfectivo()` según ADR 0006 (automatico → según perfil).
- [ ] Registro de la app: logs rotados en `registros/app.log` (máx. ~5 MB × 3 archivos) con nivel, fecha y módulo; sin datos personales salvo rutas.
- [ ] Tests: creación inicial, lectura tolerante con campos ausentes, actualización parcial, rechazo de valores inválidos (p. ej. volumen 2).
- [ ] Para desarrollo: `config.json` con `instalacion.estado: "completa"` se puede generar con el script `semilla` (0009) para saltar el primer arranque, que se implementa en la Fase 2.

## Notas de implementación
(las rellena el programador al terminar)
