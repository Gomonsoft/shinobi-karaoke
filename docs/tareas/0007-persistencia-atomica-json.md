# 0007 — Escritura atómica y lectura robusta de archivos JSON
- Estado: Pendiente
- Paso del pipeline: 5
- Depende de: 0006
- ADRs: 0006
- Spec UX: —

## Objetivo
Un módulo de main (`src/main/persistencia/`) que garantice que `cancion.json` y `config.json` nunca quedan corruptos, aunque la app se cierre o el equipo se apague a mitad de escritura.

## Criterios de aceptación
- [ ] `escribirJsonAtomico(ruta, datos)`: escribe `ruta.tmp` → `fsync` del archivo → copia el actual a `ruta.bak` (si existe) → renombra `ruta.tmp` a `ruta` → `fsync` del directorio cuando el SO lo permita. En Windows, reintenta el renombrado hasta 5 veces con espera corta si falla con `EPERM`/`EBUSY` (antivirus, indexador).
- [ ] `leerJson(ruta, esquema)`: lee y valida con el esquema Zod y la migración de 0006; si el JSON no se puede leer o no es válido, intenta `ruta.bak`; si recupera desde `.bak`, reescribe el principal. Devuelve un resultado discriminado `{ ok, datos, recuperadoDeBak } | { ok: false, motivo }`.
- [ ] **Cola de escritura por archivo**: escrituras concurrentes sobre el mismo archivo se serializan; con *debounce* opcional (por defecto ~1 s para cambios del editor, ADR 0006) y `flush()` para forzar la escritura pendiente (al cerrar la app).
- [ ] Se ignoran y limpian archivos `*.tmp` huérfanos al leer.
- [ ] Tests (Vitest, directorio temporal): escritura normal; recuperación desde `.bak` con principal truncado; ambos inválidos → error; 100 escrituras concurrentes acaban con el último valor y un archivo válido; `flush` escribe lo pendiente.
- [ ] Simulación de fallo entre "escribir tmp" y "renombrar" (inyectando un error) deja el archivo principal intacto.

## Notas de implementación
(las rellena el programador al terminar)
