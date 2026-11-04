# 0009 — Servicio de biblioteca: escaneo, índice en memoria y recuperación al arrancar
- Estado: Hecha
- Paso del pipeline: 5
- Depende de: 0007, 0008
- ADRs: 0006
- Spec UX: docs/ux/02-biblioteca.md (estados Cargando y Dañada)

## Objetivo
Leer todas las canciones de `biblioteca/` al arrancar, detectar las dañadas y dejar un índice en memoria del que leerán la IPC y la vista Biblioteca.

## Criterios de aceptación
- [x] `escanear()`: recorre `biblioteca/*/` ignorando entradas que empiezan por `.`; para cada carpeta lee `cancion.json` con 0007. Una canción ilegible (sin `.bak` válido) se indexa como **dañada** con `motivo: "json"` y el nombre de la carpeta como título provisional; no interrumpe la carga del resto.
- [x] Si `pasos.separacion` está `completado` pero falta alguno de `pistas/voz.flac` o `pistas/instrumental.flac`, la canción se indexa como **dañada** con `motivo: "pistas"` (sin modificar `cancion.json`).
- [x] Al arrancar: todo paso `en_curso` pasa a `interrumpido` (y se guarda), porque no puede haber trabajos vivos de una sesión anterior (ADR 0006); se vacía `biblioteca/.importando/`.
- [x] El índice expone un **resumen** por canción para la biblioteca: id, título, artista, duración, estado, `modificada`, estilo, miniatura, pasos (estado + progreso + error), `incompleta`, número de líneas sin sincronizar, dañada/motivo. Orden: `modificada` descendente.
- [x] `obtener(id)` devuelve la canción completa validada.
- [x] Rendimiento: escanear 300 canciones sintéticas tarda < 1 s en un equipo de desarrollo (test).
- [x] Script `npm run semilla`: crea en el directorio de datos de desarrollo una biblioteca con las fixtures de 0006 (al menos: 2 listas, 1 lista incompleta, 3 borradores en pasos distintos, 1 con error, 1 interrumpida, 1 dañada por JSON, 1 dañada por pistas; con estilos y fuentes variados; archivos FLAC de pistas como silencio corto) y `config.json` con instalación completa. Es idempotente (`--limpiar` para recrear).
- [x] Tests con directorio temporal: biblioteca vacía, canciones válidas, dañadas, `en_curso` → `interrumpido`, limpieza de `.importando`.

## Notas de implementación
- **Qué se hizo**: `app/src/main/biblioteca/` con `servicio.ts` (`ServicioBiblioteca(datos, {registro, ahora})`: `arrancar()` = vaciar `.importando/` + escanear interrumpiendo pasos `en_curso`; `escanear()` (sin tocar pasos), `listar()` (resúmenes por `modificada` desc.), `obtener(id)` (copia de la canción validada, null si dañada por JSON), `obtenerResumen(id)`), `resumen.ts` (tipo `ResumenCancion`: id, titulo, artista, duracionMs, estado, modificada, estilo, miniatura (ruta absoluta o null), pasos {estado, progreso, error}, incompleta, lineasSinSincronizar, danada, motivo), `flac.ts` (silencio FLAC válido generado a mano) y `semilla.ts`. `main/index.ts` crea y arranca el servicio tras la configuración (export `servicioBiblioteca`).
- **Decisiones**: el id del índice es el nombre de la carpeta; lectura con `leerJson`+`migrarCancion` (recupera de `.bak`), 32 lecturas en paralelo. Dañada por JSON: título provisional = carpeta, sin estilo ni pasos. Dañada por pistas: conserva sus metadatos; se comprueban las rutas de `pistas` (o `pistas/voz.flac` e `instrumental.flac` si `pistas` es null) y una ruta fuera de la carpeta cuenta como ausente. El paso `en_curso` → `interrumpido` actualiza `actualizado` pero no `modificada` (para no reordenar la biblioteca) y se guarda con `escribirJsonAtomico`. `obtener` sirve de memoria (las escrituras futuras deberán actualizar el índice; no hay aún método de actualización).
- **Script `semilla`**: `npm run semilla [-- --limpiar]` (`scripts/semilla.mjs` + hook `scripts/resolver-ts.mjs`; usa `node --experimental-transform-types`, sin dependencias nuevas). Crea 10 canciones en `.datos-dev/` (2 listas, 1 incompleta, 3 borradores, 1 con error, 1 interrumpida, 1 dañada por JSON, 1 por pistas) con estilos/fuentes variados y `config.json` con instalación completa. Idempotente (no toca lo existente).
- **Cómo probarlo** (desde `app/`): `npx vitest run --project node src/main/biblioteca` (15 tests, incl. 300 canciones < 1 s), `npx eslint src/main scripts`, `npx tsc --noEmit -p tsconfig.node.json`, `npm run semilla -- --limpiar`.
- **Deuda técnica**: el índice no se refresca tras escrituras (lo hará quien implemente edición/IPC, 0011); el cableado en `main/index.ts` no tiene test (requiere Electron); la miniatura se expone como ruta absoluta (la IPC decidirá cómo servirla al renderer).
