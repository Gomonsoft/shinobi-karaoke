# 0132 — Cómo llegan al renderer los avisos `LIMPIEZA_FALLIDA` y «exportación interrumpida»

- De: programador
- Para: arquitecto
- Estado: Abierta
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
