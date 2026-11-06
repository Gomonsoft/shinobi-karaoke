# 0095 — Audio de prueba: FLAC largo, pista de clics y canciones del editor en la semilla
- Estado: Pendiente
- Paso del pipeline: 4 (pruebas)
- Depende de: — (**puede empezar ya**)
- ADRs: 0010 (§1 "Pruebas"), 0009 §8 (dobles sin red), 0005 (letras inventadas en el repositorio)
- Spec UX: docs/ux/06-editor.md (criterio 12: "prueba manual con una pista de clics")
- Archivos: `app/src/main/biblioteca/flac.ts` (+ test nuevo `flac.test.ts`), `app/src/main/biblioteca/semilla.ts`, `app/src/main/biblioteca/semilla.test.ts`. **No toca archivos compartidos.**
- Paralelizable con: todas salvo 0110 y 0111, que la usan.

## Contexto para quien implementa
- `flac.ts` genera un FLAC mínimo válido: silencio estéreo de 16 bits a 44,1 kHz, en bloques de 4096 muestras con subtramas `CONSTANT`. El número de trama se escribe en un solo byte (`n & 0x7f`), así que como mucho hay 127 bloques (≈ 11,8 s). La semilla (`semilla.ts`, `npm run semilla`, que también usan los E2E con `sembrar(datos)`) escribe ese silencio de ~1 s como `fuente/mezcla.flac` y `pistas/*.flac`.
- El editor necesita audio de **varias decenas de segundos** para el transporte y el E2E, y una **pista de clics** (pulsos periódicos audibles) para la prueba manual de precisión (0111).
- Las letras del repositorio son **inventadas** (ADR 0005).

## Objetivo
Generar FLAC largos (silencio y clics) sin dependencias y sembrar canciones pensadas para el editor.

## Criterios de aceptación
- [ ] `flac.ts`:
  - número de trama en **UTF-8 de FLAC** (1 byte < 0x80, 2 bytes < 0x800, 3 bytes < 0x10000), con el CRC-8 sobre toda la cabecera;
  - `silencioFlac(bloques)` admite hasta 65535 bloques; el valor por defecto (11) no cambia;
  - nueva `silencioFlacSegundos(segundos)`;
  - nueva `pulsosFlac({ segundos, periodoMs = 1000, duracionPulsoMs = 15, amplitud = 0.5, desfaseMs = 0 })`: los bloques que contienen un pulso usan subtrama **VERBATIM** (cabecera 0x02 y muestras de 16 bits con signo, big-endian) con una ráfaga de onda cuadrada de 1 kHz; los demás, `CONSTANT` 0;
  - la cabecera `STREAMINFO` lleva el total de muestras correcto, porque la duración debe salir bien en `decodeAudioData` y en PyAV.
- [ ] `flac.test.ts`:
  - analiza el flujo generado con un decodificador mínimo escrito en el propio test (recorre tramas y verifica los CRC-8 y CRC-16);
  - comprueba el número de tramas de 30 s y la posición de los pulsos (muestra de inicio = `round((desfaseMs + k·periodoMs) · 44,1)`, ±1 bloque si el pulso empieza en mitad de un bloque: el pulso está **dentro** del bloque que le toca);
  - si el entorno de pruebas tiene `uv` y el worker, un test opcional decodifica con PyAV. Si no, se omite.
- [ ] **Semilla**: tres canciones nuevas con ids correlativos tras las existentes (`idN(17…19)`), con letras inventadas y audio de **30 s** (`metadatos.duracion_ms = 30000`):
  - 17 «Editor: pista de clics», artista «Shinobi Pruebas»:
    - `mezcla.flac`, `voz.flac` e `instrumental.flac` = `pulsosFlac({ segundos: 30, periodoMs: 2000, desfaseMs: 2000 })`;
    - letra `manual` de 12 líneas ("Clic 1" … "Clic 12") sin tiempos y una pausa tras la 6;
    - separación completada. Sirve para la prueba manual: la línea *k* debería marcarse en `2000·k` ms;
  - 18 «Editor: separando», separación `en_curso` con `progreso: 0.42`, sin pistas, letra sincronizada de 6 líneas y `mezcla.flac` = 30 s de silencio;
  - 19 «Editor: lista incompleta», `estado: 'lista'`, pistas de 30 s y 8 líneas con una sin inicio.
- [ ] Las canciones existentes no cambian (los E2E de fases anteriores cuentan tarjetas: actualiza **solo** los recuentos que dependan del total de la semilla, por ejemplo en `e2e/biblioteca.spec.ts`, y anótalo en las notas).
- [ ] `semilla.test.ts`: las 19 canciones validan, y los FLAC de 17–19 duran 30 s según `STREAMINFO`.

## Verificación
```bash
cd app
npm run lint && npm run typecheck && npm run format:check
npx vitest run src/main/biblioteca
npm run semilla && npm run dev   # abrir «Editor: pista de clics» y escuchar los clics en Progreso → Escucha
export SHINOBI_UV=$(which uv)
npm run build && npx playwright test e2e/biblioteca.spec.ts
```

## Notas de implementación
(las rellena el programador al terminar)
