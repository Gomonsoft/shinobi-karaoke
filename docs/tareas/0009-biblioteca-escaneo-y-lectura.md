# 0009 — Servicio de biblioteca: escaneo, índice en memoria y recuperación al arrancar
- Estado: Pendiente
- Paso del pipeline: 5
- Depende de: 0007, 0008
- ADRs: 0006
- Spec UX: docs/ux/02-biblioteca.md (estados Cargando y Dañada)

## Objetivo
Leer todas las canciones de `biblioteca/` al arrancar, detectar las dañadas y dejar un índice en memoria del que leerán la IPC y la vista Biblioteca.

## Criterios de aceptación
- [ ] `escanear()`: recorre `biblioteca/*/` ignorando entradas que empiezan por `.`; para cada carpeta lee `cancion.json` con 0007. Una canción ilegible (sin `.bak` válido) se indexa como **dañada** con `motivo: "json"` y el nombre de la carpeta como título provisional; no interrumpe la carga del resto.
- [ ] Si `pasos.separacion` está `completado` pero falta alguno de `pistas/voz.flac` o `pistas/instrumental.flac`, la canción se indexa como **dañada** con `motivo: "pistas"` (sin modificar `cancion.json`).
- [ ] Al arrancar: todo paso `en_curso` pasa a `interrumpido` (y se guarda), porque no puede haber trabajos vivos de una sesión anterior (ADR 0006); se vacía `biblioteca/.importando/`.
- [ ] El índice expone un **resumen** por canción para la biblioteca: id, título, artista, duración, estado, `modificada`, estilo, miniatura, pasos (estado + progreso + error), `incompleta`, número de líneas sin sincronizar, dañada/motivo. Orden: `modificada` descendente.
- [ ] `obtener(id)` devuelve la canción completa validada.
- [ ] Rendimiento: escanear 300 canciones sintéticas tarda < 1 s en un equipo de desarrollo (test).
- [ ] Script `npm run semilla`: crea en el directorio de datos de desarrollo una biblioteca con las fixtures de 0006 (al menos: 2 listas, 1 lista incompleta, 3 borradores en pasos distintos, 1 con error, 1 interrumpida, 1 dañada por JSON, 1 dañada por pistas; con estilos y fuentes variados; archivos FLAC de pistas como silencio corto) y `config.json` con instalación completa. Es idempotente (`--limpiar` para recrear).
- [ ] Tests con directorio temporal: biblioteca vacía, canciones válidas, dañadas, `en_curso` → `interrumpido`, limpieza de `.importando`.

## Notas de implementación
(las rellena el programador al terminar)
