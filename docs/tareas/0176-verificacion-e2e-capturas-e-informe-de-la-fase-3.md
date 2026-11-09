# 0176 — Verificación E2E sin red, capturas e informe de la fase 3

- Estado: Pendiente
- Paso del pipeline: 1, 4 y 5
- Depende de: [0163](0163-modelo-puro-de-temas-e-identidad.md)–[0175](0175-ajustes-seccion-temas.md)
- ADRs: [0016](../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md) («Pruebas»), [0006](../adr/0006-persistencia-y-modelo-de-datos.md#revisión-para-020--fase-3)
- Specs: [Editor · Fase 3](../ux/06-editor.md#fase-3-de-020--temas-y-biblioteca) (T19, T22b, T29), [Biblioteca · Fase 3](../ux/02-biblioteca.md#fase-3-de-020--temas-y-biblioteca) (B5b, B16), [Ajustes · Fase 3](../ux/08-ajustes-y-acerca.md#fase-3-de-020--temas-y-biblioteca) (A7c, A12–A15), [Revisión visual](../ux/revision-fase-3/README.md)

## Objetivo

Comprobar el conjunto en Electron real y sin red, con datos sembrados, tomar las capturas de revisión y escribir el informe de cierre. Solo añade pruebas, ayudantes de E2E, capturas e informe; los defectos que encuentre se corrigen en la tarea responsable (reabriéndola) o, si son menores, aquí con nota en el informe.

## Escenarios E2E (Playwright + Electron, sin red)

1. **Biblioteca de esquema 1** (`e2e/temas-migracion.spec.ts`): copiar una biblioteca de 0.1.0 (fixture con tiempos sincronizados, palabras, pausas, estilos propios variados y uno igual al de fábrica) y un `config.json` con `estilo_predeterminado` cambiado. Al arrancar: tema «Mi estilo» predeterminado; cada canción con procedencia «Tema personalizado» y el mismo aspecto; **hash de cada `cancion.json` idéntico** tras abrir la Biblioteca, el editor (sin tocar nada) y el reproductor; los tiempos se reproducen igual (mismo `inicio_ms`/`fin_ms` leídos del archivo). Otra variante con estilo de fábrica → «Shinobi». Las de YouTube con estilo igual al heredado conservan la miniatura.
2. **Editor** (`e2e/temas-editor.spec.ts`): asignar, heredar, personalizar, editar tema y guardar con impacto (T8–T9 con los recuentos exactos), confirmación obsoleta creando una canción durante el diálogo (T10), guardar como nuevo y usarlo, renombrar, duplicar, eliminar con congelación (T18), fallo inyectado en la 3.ª de 5 y reanudar o cancelar (T19: `tema.eliminar.parcial` nombra la 3.ª y dice «Faltan 3 canciones», 3 filas —✕ con [Copiar detalles] y dos «Pendiente» sin él—, nota `tema.parcial.notaPendientes`, foco en [Reintentar]; fallo en la última → una fila, sin nota, variante f = 1; un fallo nuevo al «Terminar de eliminar» desde Ajustes muestra la lista de ese intento), carpeta copiada con tema inexistente (T22), destino `respaldo` al volver a heredar (T22b: canción asignada cuya base «al azar» apunta a un tema que no está; `tema.heredar.destino.respaldo` sin nombre de tema, D4 sin diálogo, `tema.anuncio.heredar.respaldo`, Ctrl/Cmd + Z), salir y cerrar con borrador (T12, T23).
3. **Biblioteca** (`e2e/temas-biblioteca.spec.ts`): agrupación persistente tras reiniciar (B1), identidad (B2–B3), búsqueda por álbum (B4), tema de artista y álbum con herencia (B5–B6), quitar el tema de un álbum con una canción cuya base apunta a un tema inexistente (B5b: «destinos distintos» + `bib.grupo.impacto.noDisponible` con r = 1, y «quitar, todas no disponibles» con las dos; tras aplicar, «⚠ Tema no disponible» en esas tarjetas), editar datos que mueve la tarjeta (B7), lote con fallo y cambio concurrente (B10–B11).
4. **Ajustes** (`e2e/temas-ajustes.spec.ts`): cambiar el predeterminado (A1 de 0052) y quitarlo sin cambio visible (B1 de 0052, A13: mismas capturas de portada y vista previa antes y después, procedencia «Tema predeterminado anterior» en el editor y «predeterminado anterior» en la tarjeta, y editar ese tema después las cambia); fallo inyectado en la 2.ª de 4 al quitarlo (A15: `aj.temas.ninguno.parcial` con el título de la 2.ª y «Faltan 3 canciones», 3 filas —una ✕ con [Copiar detalles], dos «Pendiente»—, nota, foco en [Reintentar], selector en el tema, ningún cambio de aspecto, [Reintentar] con 3); «Volver a heredar» de una canción con base «predeterminado anterior» (T2b, con el texto de `tema.heredar.destino`); un predeterminado nuevo no cambia las de al azar ni las de estilo incluido (C1); canción nueva aleatoria estable al reiniciar (A5); borrar el predeterminado (A4); `temas.json` ilegible (A7 y A7c: aviso que sigue tras reiniciar si no se cierra, y que no vuelve tras cerrarlo con ✕ y reiniciar); catálogo de esquema 2 en solo lectura (A7, archivo intacto byte a byte); referencias que faltan (A8); borrado pendiente tras matar el proceso a mitad (A9).

Los fallos de escritura se inyectan con el mecanismo de pruebas existente de la persistencia (o uno nuevo solo activo con una variable de entorno de E2E, documentado en el informe). Las canciones con base que apunta a un tema inexistente (T22b, B5b) se siembran en `e2e/fixtures/temas.ts` escribiendo su `cancion.json` con un `tema_id` de base que no está en `temas.json`, como una carpeta copiada de otro equipo; no hace falta cambiar la semilla de 0168.

## Capturas

En `docs/ux/revision-fase-3/`, con el procedimiento de [revision-fase-2.1](../ux/revision-fase-2.1/README.md) y los nombres y tamaños del [README de la fase 3](../ux/revision-fase-3/README.md): 11 estados del editor (1280 × 720 al 100 % y 125 %), 9 de la Biblioteca (1280 × 800 al 100 % y 1280 × 720 al 125 %) y 10 de Ajustes (1280 × 800 al 100 %), entre ellos `dialogo-quitar-predeterminado` (`aj.temas.dialogo.ninguno` con la lista revelada).

**Semilla**: la de 0168, que cumple los datos de prueba del README e incluye una canción con procedencia «Tema predeterminado anterior» y otra asignada con esa base (T2b). Si la captura `temas` o la tarjeta de la Biblioteca deben mostrarla, se usa esa canción y no se recrea a mano. Actualizar el README con el estado «tomadas» y el equipo usado.

## Informe

`docs/versiones/0.2.0/informe-fase-3.md`, con el formato de [informe-fase-2.1](../versiones/0.2.0/informe-fase-2.1.md): tareas, criterios T1–T30 (con T2b y T22b), B1–B16 (con B5b) y A1–A15 (con A7b y A7c) con su resultado (verificado en E2E, en Vitest o a mano), desviaciones, medidas de rendimiento (usos y agrupación con 500 canciones), riesgos abiertos y preguntas pendientes. Actualizar el estado de la fase en [plan-2](../versiones/0.2.0/plan-2.md) y en el [backlog](../versiones/0.2.0/backlog.md).

## Archivos

- `app/e2e/temas-migracion.spec.ts`, `temas-editor.spec.ts`, `temas-biblioteca.spec.ts`, `temas-ajustes.spec.ts` (nuevos).
- `app/e2e/fixtures/temas.ts` (nuevo: catálogos, bibliotecas de 0.1.0, inyección de fallos) y `app/e2e/fixtures/biblioteca-010/` si hace falta una copia real.
- `docs/ux/revision-fase-3/*.png`, `docs/ux/revision-fase-3/README.md`.
- `docs/versiones/0.2.0/informe-fase-3.md` (nuevo), `plan-2.md`, `backlog.md`.

## Criterios de aceptación

- [ ] Los cuatro archivos de E2E pasan en CI (Windows, macOS y Linux) sin red y sin ventanas de sistema.
- [ ] El escenario 1 demuestra con hashes que una biblioteca de esquema 1 no se reescribe y conserva tiempos y estilos.
- [ ] El escenario de B1 demuestra que quitar el predeterminado no cambia ningún aspecto ni portada y mantiene el vínculo vivo, y el de A15 que un fallo a mitad no cambia ningún aspecto.
- [ ] Existen las 50 capturas de la tabla del README (editor 11 × 2, Biblioteca 9 × 2, Ajustes 10 × 1) con el nombre esperado, incluida `ajustes-1280x800-100-dialogo-quitar-predeterminado.png`.
- [ ] El informe lista cada criterio de las specs con su resultado y enlaza las capturas.
- [ ] `tsc`, Vitest, lint y la suite E2E completa en verde.

## Notas de implementación
