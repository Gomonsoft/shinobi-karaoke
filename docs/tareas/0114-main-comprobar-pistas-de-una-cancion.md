# 0114 — Main: `ServicioBiblioteca.comprobarPistas(id)` (Dañada sin reiniciar)
- Estado: Hecha
- Paso del pipeline: 6
- Depende de: 0112
- ADRs: 0011 (§5), 0006 (canción Dañada)
- Spec UX: docs/ux/07-reproductor.md (estado de error, criterio 22); docs/ux/02-biblioteca.md (Dañada, "Faltan las pistas separadas")
- Pregunta: 0031 §4 (respondida)
- Archivos: `app/src/main/biblioteca/servicio.ts` (sustituye el método provisional de 0112) y su test. Sin archivos compartidos.
- Paralelizable con: todo el resto de la fase.

## Contexto para quien implementa
- `ServicioBiblioteca` mantiene un índice en memoria (`Entrada = { resumen, cancion }`). "Dañada por pistas" se calcula en `detectarDanada(carpeta, cancion)` al escanear (`leerCancion`) y tras cada escritura (`guardar` → `entradaDe`). Los cambios se emiten con `this.emitir({ id, resumen })` (canal `evento:cancion`, que la Biblioteca ya escucha). Las operaciones de una canción van en serie con `enSerie(id, …)`.

## Objetivo
Que el reproductor pueda pedir que se vuelvan a comprobar las pistas de una canción, y que la Biblioteca la muestre como Dañada al momento si faltan.

## Criterios de aceptación
- [ ] `comprobarPistas(id: string): Promise<ResumenCancion | null>`:
  - en serie con las escrituras de esa canción (`enSerie`);
  - `null` si la canción no está en el índice o está dañada por JSON (`cancion === null`);
  - recalcula la entrada con `entradaDe(id, cancion)`. Si el resumen cambia (`danada`, `motivo`, `sinMezcla`), actualiza el índice, registra `canción dañada (<id>): faltan pistas` como en el escaneo y emite el evento; si no cambia, no emite;
  - no escribe `cancion.json` ni cambia `estado` (sigue `lista`; "Dañada" es derivado, ADR 0006).
- [ ] Tests (con carpeta temporal): canción Lista con pistas → borrar `pistas/instrumental.flac` → `comprobarPistas` devuelve `danada: true, motivo: 'pistas'` y emite una vez; segunda llamada sin cambios no emite; id inexistente → `null`; también funciona si se borra solo `pistas/voz.flac` (comprueba qué hace hoy `detectarDanada` con la voz y documéntalo en las notas).
- [ ] El canal `biblioteca.comprobarPistas` de 0112 llega a este método (test de handlers o de integración ya existente).

## Verificación
```bash
cd app && npm run lint && npm run typecheck && npm run format:check && npm test
```

## Notas de implementación
- La comprobación se serializa con las escrituras, recalcula el resumen, lo actualiza y emite solo si cambian los campos de daño. No escribe el JSON ni altera el estado Lista.
- Tanto la falta de instrumental como la falta de voz producen el motivo derivado `pistas`, porque `detectarDanada` requiere ambas pistas.
- Verificado con 74 pruebas de biblioteca e IPC. La verificación global de la app está en curso.
