# 0023 — Papelera inyectable en las pruebas E2E
- Estado: Hecha
- Paso del pipeline: — (calidad)
- Depende de: 0020
- ADRs: 0006, 0007
- Spec UX: —

## Objetivo
Que las pruebas E2E no envíen carpetas a la papelera real del sistema del desarrollador ni del runner de CI (deuda de 0020: el E2E de eliminar usa `shell.trashItem` real), y poder probar de extremo a extremo el fallo de la papelera.

## Criterios de aceptación
- [x] Variable de entorno `SHINOBI_PAPELERA_PRUEBAS`, **ignorada si `app.isPackaged`**. Con una ruta de directorio, el `shell` que `main/index.ts` inyecta en `ServicioBiblioteca` sustituye `trashItem(carpeta)` por un renombrado de la carpeta a `<ruta>/<nombre>-<marca de tiempo>` (con copia + borrado si el renombrado falla por cambiar de disco). Con el valor `fallar`, `trashItem` rechaza (para probar el toast de error). El resto de `shell` no cambia.
- [x] La sustitución es una función pura/inyectable en main con test unitario (ruta, valor `fallar`, ignorada en empaquetado).
- [x] `e2e/biblioteca-acciones.spec.ts` lanza la app con `SHINOBI_PAPELERA_PRUEBAS=<datos>/papelera` y comprueba que la carpeta desaparece de `biblioteca/` **y** aparece en esa papelera; nuevo caso con `fallar`: se ve el toast de error con "Copiar detalles" y la carpeta sigue en `biblioteca/`.
- [x] Ninguna prueba (unitaria ni E2E) llama a `shell.trashItem` real: búsqueda en `app/` documentada en las notas. Los directorios temporales `mkdtemp` de los E2E se borran al terminar cada prueba.
- [x] `app/README.md` documenta la variable.

## Notas de implementación
- `app/src/main/biblioteca/papelera.ts`: `shellConPapeleraDePruebas(shell, {env, empaquetada})` (pura, con test en `papelera.test.ts`: ruta, `fallar`, sin variable, empaquetada). Cableada en `app/src/main/index.ts`. Renombrado con respaldo copia + borrado ante `EXDEV`.
- `app/e2e/temporales.ts`: `crearTemporal()` crea el directorio y lo borra en `afterEach`; usado por todos los E2E antiguos. `biblioteca-acciones.spec.ts` siempre pasa `SHINOBI_PAPELERA_PRUEBAS` (por defecto `<datos>/papelera`), comprueba que la carpeta aparece allí y añade el caso `fallar`.
- Búsqueda de `trashItem` en `app/`: solo el servicio (inyectado), `papelera.ts` y mocks de vitest; ningún test llama al `shell.trashItem` real. Tras ejecutar playwright, `stat ~/.Trash` (mtime/tamaño) no cambió (`ls ~/.Trash` no está permitido en este entorno).
- Probar: `npm test` y `npm run test:e2e`. Documentado en `app/README.md`.
- Deuda: los E2E nuevos de otras tareas deben usar `crearTemporal` y la variable al lanzar la app.
