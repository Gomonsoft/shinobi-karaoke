# 0210 — Herramienta de calibración del ajuste de silencios

- Estado: Hecha
- Paso del pipeline: 4
- Depende de: [0207](0207-deteccion-de-voz-y-propuesta-de-ajuste-de-silencios.md)
- ADRs: [0018](../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md) §6.4
- Spec UX: no aplica (herramienta de desarrollo, no se empaqueta)

## Objetivo

Que el usuario pueda medir, en su propio equipo, cómo se comportan los parámetros provisionales con sus 6 canciones sincronizadas a mano, y que se elijan los valores definitivos de `PARAMETROS_SILENCIOS` sin subir audio, letras ni resultados al repositorio.

## Contrato

- **`app/scripts/calibrar-silencios.ts`** (o `.mts`), con su entrada `npm run calibrar:silencios -- <carpeta> [--ids a,b,c]`:
  - lee, de cada canción indicada o de todas las que tengan picos, `cancion.json` y la caché `pistas/.picos-voz-v1-*.bin` válida, con el lector y validador de `main/picos/formato.ts` o una copia mínima sin Electron;
  - toma como verdad los fines **fijados** a mano (`fin_ms` numérico) de las líneas sin palabras;
  - borra esos fines en una copia y ejecuta `proponerAjusteSilencios` con una **rejilla** de parámetros (umbral relativo de −24 a −40 dB, silencio mínimo de 250 a 700 ms y margen de 50 a 200 ms);
  - informa por combinación: error medio y máximo (ms), líneas sin silencio detectado, cortes antes de la verdad (> 150 ms) y huecos largos;
  - imprime una tabla en la consola y no escribe nada en la carpeta;
  - **solo lectura**: abre los archivos en modo lectura y no toca la biblioteca.
- Documentación breve al principio del script y una línea en `docs/Test-manuales/` (guía de la fase 5) con cómo ejecutarlo y qué copiar al ADR.

## Archivos

`app/scripts/calibrar-silencios.ts` (nuevo), la entrada en `app/package.json` y una prueba mínima `app/scripts/calibrar-silencios.test.ts` con una carpeta temporal **generada en la prueba**: una canción sintética, sus picos sintéticos con el formato v1 y fines conocidos.

## Criterios de aceptación

- [ ] Con la carpeta sintética, la combinación de los parámetros por defecto da un error máximo ≤ 10 ms + margen y la tabla incluye todas las combinaciones.
- [ ] Una canción sin caché de picos se omite con un aviso.
- [ ] Ninguna ruta de la carpeta se modifica: se comprueban los `mtime` antes y después.
- [ ] El script no se incluye en el paquete de electron-builder.

## Pruebas de feedback

- Unitarias: `calibrar-silencios.test.ts` con datos generados en la prueba.
- E2E: ninguna.
- Críticos: no.
- Manual: el usuario lo ejecuta con sus 6 canciones (guía de la fase 5). El arquitecto actualiza `PARAMETROS_SILENCIOS` y la revisión del ADR 0018 con el resultado.

## Notas de implementación

### Qué se hizo
- `app/scripts/calibrar-silencios.ts`: `calibrar(carpeta, { ids })` y `formatearTabla`. Lee `<carpeta>/<id>/cancion.json` y `pistas/.picos-voz-v1-<hash>.bin` con `conPicos` y `leerVentana` de `main/picos/formato.ts` (solo lectura, nivel base completo). Verdad: fines fijados de líneas sin palabras. Los borra en una copia y recorre una rejilla de 9 umbrales (−24…−40 dB, de 2 en 2) × 4 silencios mínimos (250, 400, 550, 700 ms) × 4 márgenes (50…200 ms) = 144 combinaciones.
- `app/scripts/calibrar-silencios-cli.mjs`: entrada de `npm run calibrar:silencios -- <carpeta> [--ids a,b,c]` (registra `resolver-ts.mjs`, como `semilla`). Está aparte del `.ts` porque el test importa el `.ts`.
- `app/package.json`: script `calibrar:silencios`. No se empaqueta (`electron-builder.yml` solo incluye `out/**`).
- `app/scripts/calibrar-silencios.test.ts`: carpeta temporal generada en la prueba (una canción con picos v1 sintéticos y fines conocidos, otra sin caché). Comprueba las 144 filas, error máximo 0 con los valores actuales, el aviso de la canción sin picos y que ningún `mtime` cambia.
- Guía manual: `docs/Test-manuales/0.2.0/fase-5-calibracion-de-silencios.md` (archivo aparte para no pisar la guía que escribe `qa` en 0219).

### Cómo ejecutará el usuario la calibración
1. Abrir cada una de las 6 canciones sincronizadas a mano en el editor al menos una vez (genera la caché de picos).
2. En `app/`: `npm run calibrar:silencios -- <carpeta-de-la-biblioteca>` (la carpeta que contiene una carpeta por canción). Con `--ids a,b,c` se limita a esas canciones.
3. Se imprime una línea con las canciones usadas, avisos («AVISO … se omite» para las que no tienen caché) y una tabla de 144 filas ordenada por error medio. La fila de los valores actuales lleva `*`.
4. Columnas: umbral, silencio mínimo, margen, líneas evaluadas, error medio y máximo (ms), sin silencio, cortes (propuesta > 150 ms antes de la verdad) y huecos largos.
5. Copiar al arquitecto al menos las 10 primeras filas y la fila `*`. No se guarda nada en el repositorio. El arquitecto actualiza `PARAMETROS_SILENCIOS` y la revisión del ADR 0018.

### Decisiones y deuda
- «Sin silencio detectado» también incluye las líneas donde el fin propuesto coincide con el automático (el algoritmo no escribe nada). El error de esas líneas se mide contra el fin automático.
- La rejilla no varía percentil, piso, voz mínima ni umbral mínimo (el contrato solo pide umbral, silencio y margen).
- No se comprueba que la caché de picos corresponda a la pista de voz actual (no hay `generacion` sin Electron); se usa la primera caché válida.
