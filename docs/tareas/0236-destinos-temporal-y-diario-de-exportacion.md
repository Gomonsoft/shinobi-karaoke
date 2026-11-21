# 0236 — Destinos, temporal, sustitución atómica y diario

- Estado: Pendiente
- Paso del pipeline: 6
- Depende de: [0230](0230-contratos-compartidos-de-la-exportacion.md)
- ADRs: [0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md) §6 y §11, [0006](../adr/0006-persistencia-y-modelo-de-datos.md#revisión-para-020--fase-6)
- Spec UX: [10](../ux/10-exportacion.md) («Guardar como», archivo existente, notas de espacio y carpeta, cierre inesperado)

## Objetivo
Resolver en main todo lo que toca el sistema de archivos del usuario, con funciones probables sin Electron.

## Contrato (`main/exportacion/destinos.ts` y `diario.ts`, con puertos de `fs`, `dialog` y rutas)
- `destinoPropuesto(cancion, formato, config)`: carpeta recordada si existe y se puede escribir, si no `videos`, si no `home`; nombre con `nombrePropuesto`; `existe`, `libreBytes` (`fs.statfs`), `carpetaRecordadaNoDisponible`. Registra un `destinoId` (UUID, un solo uso, caduca a los 30 min).
- `elegirDestino(destinoId, ventana)`: `dialog.showSaveDialog` con ruta y filtro; fuerza la extensión; cancelar devuelve `null` sin cambiar nada.
- Rechazo de destinos dentro del directorio de datos (`DESTINO_NO_DISPONIBLE`) y de carpetas sin permiso de escritura.
- `rutaTemporal(destino, trabajoId)` = `<carpeta>/.<nombre>.<8 hex>.shinobi-parcial`.
- `sustituir(temporal, destino)`: `rename`; con `EBUSY`/`EPERM`/`EXDEV` → `DESTINO_NO_DISPONIBLE` y el temporal se borra.
- `limpiar(temporal)` → `LIMPIEZA_FALLIDA` con la ruta si falla.
- Diario `exportacion/en-curso.json` (escritura atómica de `main/persistencia/`): `escribir`, `borrar` y `recuperarAlArrancar()` → borra restos y devuelve `{ titulo, cancionId } | null` para el aviso único.

## Criterios de aceptación
- [ ] Con un archivo previo en el destino, cancelar o fallar lo deja con el mismo hash y fecha; el éxito lo sustituye (V13).
- [ ] El diario de una exportación interrumpida se limpia al arrancar y produce un solo aviso (V26); si el temporal ya no existe, también.
- [ ] Un destino dentro del directorio de datos o con la extensión cambiada se corrige o se rechaza según el contrato.
- [ ] `destinoId` usado o caducado se rechaza.

## Pruebas de feedback
- Unitarias: `destinos.test.ts` y `diario.test.ts` con un directorio temporal real y dobles de `dialog`.
- E2E: ninguna.
- Críticos: sí (toca `main/`).
- Manual: «Mostrar en la carpeta» y sustitución en los 3 SO (M6, M8).

## Notas de implementación
