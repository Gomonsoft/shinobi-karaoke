# 0132 — Cómo llegan al renderer los avisos `LIMPIEZA_FALLIDA` y «exportación interrumpida»

- De: programador
- Para: arquitecto
- Estado: Respondida
- Bloquea: no (las tareas [0239](../tareas/0239-progreso-resultado-y-estado-de-exportaciones.md) y [0240](../tareas/0240-puntos-de-entrada-de-la-exportacion.md) usan la opción provisional)

## Contexto
La spec [10](../ux/10-exportacion.md) pide dos toasts que no nacen de una transición normal de una exportación en marcha:
- `exp.toast.limpieza` («No se pudo borrar un archivo temporal») con [Mostrar en la carpeta], tras cancelar, fallar o reabrir tras una caída.
- `exp.toast.interrumpida` («La exportación de «{título}» no terminó porque Shinobi Karaoke se cerró») con [Exportar video…], una sola vez al arrancar.

Los contratos de [0230](../tareas/0230-contratos-compartidos-de-la-exportacion.md) solo tienen `exportacion:cambio` (`ExportacionIpc`) y `exportacion:progreso`; no hay un evento de aviso ni un campo que marque una exportación como «interrumpida» o «con limpieza fallida». El ADR 0019 §10 describe el comportamiento de main, pero no cómo se lo comunica al renderer.

## Pregunta
¿Qué evento o campo usará main (0237) para avisar de cada caso? ¿Se amplía `ExportacionIpc`/los eventos (0230), o se interpretan los datos actuales?

## Opción provisional tomada
Se interpreta `exportacion:cambio` con una función aislada (`clasificarAviso` en `renderer/src/exportacion/estado.ts`), fácil de cambiar:
- `estado: 'terminada'` con `error.codigo === 'LIMPIEZA_FALLIDA'` (con `resultado` `cancelada` o `error`) → toast `exp.toast.limpieza`; «Mostrar en la carpeta» llama a `exportacion.mostrarEnCarpeta(trabajoId)`.
- `estado: 'terminada'`, `resultado: 'error'` con `error.codigo === 'PROCESO_TERMINADO'` y `error.posicionMs === null`, recibido para un `trabajoId` que el renderer no conocía (main lo emite al arrancar tras leer el diario) → toast `exp.toast.interrumpida` con [Exportar video…] (abre el diálogo A de esa canción), mostrado una sola vez por `trabajoId`; no se trata como un fallo normal (sin toast `exp.toast.error`).

Si main elige otro mecanismo, solo hay que cambiar `clasificarAviso`.

## Respuesta
Respondida por el arquitecto el 2026-11-20. El contrato se amplía, así que ya no hace falta deducir los avisos de `error.codigo`. Detalle en el ADR 0019 §6 y §10 (revisión del 2026-11-20). Lo implementa [0237](../tareas/0237-servicio-de-exportacion-e-ipc.md), que también adapta `clasificarAviso`.

- **Limpieza fallida tras cancelar o fallar en esta sesión**: `ExportacionIpc.limpiezaFallida: true`. `resultado` y `error.codigo` siguen siendo los reales (`cancelado`, o el código del fallo con su toast normal), y `LIMPIEZA_FALLIDA` deja de usarse como código de trabajo. Toast `exp.toast.limpieza`; «Mostrar en la carpeta» llama a `mostrarEnCarpeta({ trabajoId })`, que en ese caso muestra el temporal.
- **Interrumpida, y limpieza fallida al arrancar**: no son trabajos. Llegan como `AvisoExportacionIpc = { avisoId, tipo: 'interrumpida' | 'limpieza_fallida', cancionId, titulo }` por el evento nuevo `exportacion:aviso` y por el canal nuevo `exportacion.avisosPendientes()`. La principal llama a ese canal al montarse, así que el aviso del arranque no se pierde aunque se emita antes de suscribirse. Cada aviso se entrega una vez.
  - `interrumpida` → toast `exp.toast.interrumpida` con [Exportar video…] para `cancionId`.
  - `limpieza_fallida` → `exp.toast.limpieza` con [Mostrar en la carpeta], que llama a `mostrarEnCarpeta({ avisoId })`.
- No se emite ningún `ExportacionIpc` con `PROCESO_TERMINADO` para un trabajo desconocido. La rama provisional de `clasificarAviso` se retira.
