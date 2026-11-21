# 0236 — Destinos, temporal, sustitución atómica y diario

- Estado: Hecha
- Paso del pipeline: 6
- Depende de: [0230](0230-contratos-compartidos-de-la-exportacion.md)
- ADRs: [0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md) §6 y §11, [0006](../adr/0006-persistencia-y-modelo-de-datos.md#revisión-para-020--fase-6)
- Spec UX: [10](../ux/10-exportacion.md) («Guardar como», archivo existente, notas de espacio y carpeta, cierre inesperado)

## Objetivo

Resolver en main todo lo que toca el sistema de archivos del usuario, con funciones probables sin Electron.

## Contrato (`main/exportacion/destinos.ts` y `diario.ts`, con puertos de `fs`, `dialog` y rutas)

- `destinoPropuesto(cancion, formato, config)`: carpeta recordada si existe y se puede escribir, si no `videos`, si no `home`; nombre con `nombrePropuesto`; `existe`, `libreBytes` (`fs.statfs`), `carpetaRecordadaNoDisponible`. Registra un `destinoId` (UUID, un solo uso, caduca a los 30 min).
- `destinoPropuesto(..., desdeDestinoId)`: conserva carpeta y nombre del destino anterior con la extensión del formato nuevo, recalcula `existe` y `libreBytes`, emite un `destinoId` nuevo y caduca el anterior; si el anterior no es válido, devuelve el propuesto normal (ADR 0019 §6, [0124](../preguntas/0124-destino-conservado-al-cambiar-de-formato.md)).
- `elegirDestino(destinoId, ventana)`: `dialog.showSaveDialog` con ruta y filtro; fuerza la extensión; cancelar devuelve `null` sin cambiar nada.
- Rechazo de destinos dentro del directorio de datos (`DESTINO_NO_DISPONIBLE`) y de carpetas sin permiso de escritura.
- `rutaTemporal(destino, trabajoId)` = `<carpeta>/.<nombre>.<8 hex>.shinobi-parcial`.
- `sustituir(temporal, destino)`: `rename`; con `EBUSY`/`EPERM`/`EXDEV` → `DESTINO_NO_DISPONIBLE` y el temporal se borra.
- `limpiar(temporal)` → `LIMPIEZA_FALLIDA` con la ruta si falla.
- Diario `exportacion/en-curso.json` (escritura atómica de `main/persistencia/`): `escribir`, `borrar` y `recuperarAlArrancar()` → borra restos y devuelve `{ titulo, cancionId } | null` para el aviso único.

## Criterios de aceptación

- [x] Con un archivo previo en el destino, cancelar o fallar lo deja con el mismo hash y fecha; el éxito lo sustituye (V13).
- [x] El diario de una exportación interrumpida se limpia al arrancar y produce un solo aviso (V26); si el temporal ya no existe, también.
- [x] Un destino dentro del directorio de datos o con la extensión cambiada se corrige o se rechaza según el contrato.
- [x] `destinoId` usado o caducado se rechaza.
- [x] Con `desdeDestinoId` de un destino elegido, el nuevo conserva carpeta y nombre y cambia solo la extensión.

## Pruebas de feedback

- Unitarias: `destinos.test.ts` y `diario.test.ts` con un directorio temporal real y dobles de `dialog`.
- E2E: ninguna.
- Críticos: sí (toca `main/`).
- Manual: «Mostrar en la carpeta» y sustitución en los 3 SO (M6, M8).

## Notas de implementación

- Hecho: `main/exportacion/destinos.ts` (clase `Destinos` con puertos de disco, diálogo y rutas del sistema; `ErrorDestino` con `codigo` y `detalles`) y `main/exportacion/diario.ts` (`DiarioExportacion`, reutiliza `escribirJsonAtomico` y `leerJson`). Pruebas con directorio temporal real: `destinos.test.ts`, `diario.test.ts`.
- API para 0237: `destinoPropuesto(cancion, formato, carpetaRecordada, desdeDestinoId?)`, `elegirDestino(destinoId, ventana)`, `consumir(destinoId)` (gasta el id y devuelve la ruta; 0237 lo llama en `iniciar`), `rutaTemporal`, `sustituir`, `limpiar`; diario: `escribir`, `borrar`, `recuperarAlArrancar`. 0237 debe leer `config.exportacion.carpeta`, comprobar `DESTINO_OCUPADO` y cablear el aviso único.
- Decisiones: `elegirDestino` cancelado no gasta el id; uno válido gasta el anterior y emite otro. Extensión forzada: se sustituye `.mkv`/`.webm` y cualquier otra se conserva añadiendo la del formato (`x.avi` pasa a `x.avi.mkv`). Con `desdeDestinoId` se cambia cualquier extensión. En Windows se rechazan nombres reservados (`CON`, `NUL`, `COM1`…) y la comparación con el directorio de datos no distingue mayúsculas. Si la carpeta recordada o la de `videos` está dentro de los datos, se descarta. `rename` con otro error distinto de `EBUSY`/`EPERM`/`EXDEV` se relanza tras borrar el temporal. Si en el arranque no se puede borrar el temporal, el diario se borra igual para que el aviso sea único (V26).
- Deuda: `access(W_OK)` es una comprobación débil en Windows (no mira ACL). No se ejecutaron los E2E críticos porque no se tocó `main/index.ts`. Manual: M6 y M8 en los 3 SO (sustitución con el archivo abierto en Windows, «Mostrar en la carpeta»).
