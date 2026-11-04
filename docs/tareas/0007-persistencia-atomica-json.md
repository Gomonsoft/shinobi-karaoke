# 0007 — Escritura atómica y lectura robusta de archivos JSON
- Estado: Hecha
- Paso del pipeline: 5
- Depende de: 0006
- ADRs: 0006
- Spec UX: —

## Objetivo
Un módulo de main (`src/main/persistencia/`) que garantice que `cancion.json` y `config.json` nunca quedan corruptos, aunque la app se cierre o el equipo se apague a mitad de escritura.

## Criterios de aceptación
- [x] `escribirJsonAtomico(ruta, datos)`: escribe `ruta.tmp` → `fsync` del archivo → copia el actual a `ruta.bak` (si existe) → renombra `ruta.tmp` a `ruta` → `fsync` del directorio cuando el SO lo permita. En Windows, reintenta el renombrado hasta 5 veces con espera corta si falla con `EPERM`/`EBUSY` (antivirus, indexador).
- [x] `leerJson(ruta, esquema)`: lee y valida con el esquema Zod y la migración de 0006; si el JSON no se puede leer o no es válido, intenta `ruta.bak`; si recupera desde `.bak`, reescribe el principal. Devuelve un resultado discriminado `{ ok, datos, recuperadoDeBak } | { ok: false, motivo }`.
- [x] **Cola de escritura por archivo**: escrituras concurrentes sobre el mismo archivo se serializan; con *debounce* opcional (por defecto ~1 s para cambios del editor, ADR 0006) y `flush()` para forzar la escritura pendiente (al cerrar la app).
- [x] Se ignoran y limpian archivos `*.tmp` huérfanos al leer.
- [x] Tests (Vitest, directorio temporal): escritura normal; recuperación desde `.bak` con principal truncado; ambos inválidos → error; 100 escrituras concurrentes acaban con el último valor y un archivo válido; `flush` escribe lo pendiente.
- [x] Simulación de fallo entre "escribir tmp" y "renombrar" (inyectando un error) deja el archivo principal intacto.

## Notas de implementación
- **Qué se hizo**: `app/src/main/persistencia/jsonAtomico.ts` (reexportado por `index.ts`): `escribirJsonAtomico(ruta, datos, { debounceMs? })`, `leerJson(ruta, validar)`, `flush(ruta?)`. `leerJson` recibe como "esquema" una función validadora/migradora (`migrarCancion`, `migrarConfig` de `shared`), que lanza si el JSON no es válido. Resultado discriminado `{ ok, datos, recuperadoDeBak } | { ok: false, motivo }`.
- **Decisiones**: cola por ruta (cadena de promesas); con debounce las escrituras seguidas se agrupan y solo se escribe el último valor (todas las promesas esperan esa escritura); una escritura sin debounce absorbe la pendiente. Si falla una escritura se borra el `.tmp` y se rechaza la promesa. Reintentos de renombrado (5, espera 50 ms × intento) solo con `plataforma === 'win32'`. `leerJson` espera a las escrituras en curso y borra `*.tmp` huérfano solo si no hay escritura activa. Las operaciones de disco son inyectables (`sistema`) para simular fallos.
- **Cómo probarlo** (desde `app/`): `npx vitest run --project node src/main/persistencia` (19 tests), `npx eslint src/main/persistencia`, `npx tsc --noEmit -p tsconfig.node.json`.
- **Deuda técnica**: si el principal está corrupto, el siguiente guardado copia ese corrupto a `.bak` (la recuperación ocurre antes al leer, que reescribe el principal). Solo se limpia el `.tmp` del archivo leído, no se escanea el directorio. Falta que quien cierre la app llame a `flush()` (cableado en tareas posteriores).
- **Mantenimiento (test intermitente)**: "100 escrituras concurrentes" fallaba por timeout de 5 s con `npm test` completo en paralelo. Causa: carga, no un bug de la cola (revisada: serializa bien); 100 escrituras con fsync real de archivo y de directorio (más la copia a `.bak`) saturan el disco cuando otros workers también lo usan. Arreglo: el test inyecta un `sistema` sin fsync reales y ahora comprueba además que nunca hay más de una escritura activa y que se escribe en orden 0..99, sin tocar el timeout. Verificado con 3 ejecuciones seguidas de `npm test` (371 pasan, 4 omitidos).
