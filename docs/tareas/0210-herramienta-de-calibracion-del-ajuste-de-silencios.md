# 0210 — Herramienta de calibración del ajuste de silencios

- Estado: Pendiente
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
