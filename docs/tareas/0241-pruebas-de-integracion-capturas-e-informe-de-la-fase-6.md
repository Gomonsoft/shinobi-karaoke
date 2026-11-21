# 0241 — Pruebas de integración, capturas e informe de la fase 6

- Estado: Pendiente
- Paso del pipeline: 6
- Depende de: [0230](0230-contratos-compartidos-de-la-exportacion.md)–[0240](0240-puntos-de-entrada-de-la-exportacion.md)
- ADRs: [0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md) §13
- Spec UX: [10](../ux/10-exportacion.md) V16, V17, V23, V29 y M1–M8
- Estrategia de pruebas: [docs/pruebas.md](../pruebas.md)

## Objetivo

Cerrar la fase con la mínima integración en Electron real que Vitest no da, las capturas para el diseñador y el informe.

## Pruebas de feedback

### E2E: `e2e/exportacion.spec.ts` (secundaria), como mucho 3 pruebas, < 90 s

Worker real en desarrollo, audio generado de 3 s, letra inventada con tiempos conocidos, perfil de prueba diminuto `SHINOBI_EXPORTACION_PERFIL_PRUEBA` (solo sin empaquetar, p. ej. 320 × 240 a 24 FPS).

1. **Exportar y leer**: el archivo existe en el destino, sin temporales; leído con PyAV (ayudante que lanza el Python del worker) tiene el formato, los fotogramas, el FPS y la duración (V16), y una sonda de color en la zona del barrido cambia entre un fotograma antes y otro después del inicio de la línea (V17, tolerancia ± 16).
2. **Cancelar a mitad** con un archivo previo en el destino: temporal borrado, archivo previo con el mismo hash (V13).
3. **Con una sesión abierta** en pantallas simuladas: la exportación termina y la sesión sigue `reproduciendo` (V23).

Ejecutar solo esta spec, `exportacion-captura.spec.ts` (0234) y los críticos.

### Lo que va a la guía manual (`docs/Test-manuales/0.2.0/fase-6-exportacion.md`, la escribe `qa`)

M1–M8 de la spec 10 y, además: tiempo y tamaño de 1080p30 y 3840 × 2160 a 60 FPS en Windows y Linux (contrastar con la tabla del ADR 0019 §2 de la prueba); exportar durante una sesión en dos pantallas reales con un perfil modesto y con 4K/60 (cortes de audio, tirones de la secundaria, CPU, GPU y memoria). Si hay cortes, se abre una revisión del ADR 0019 §9 (tabla de `perfilCompatibleConSesion`).

## Capturas

Las de V29 en `docs/ux/revision-fase-6/` con una spec _opt-in_ (`e2e/exportacion-capturas.spec.ts`, `SHINOBI_CAPTURAS_6=1`), fuera del CI, y un `README.md`.

## Informe

`docs/versiones/0.2.0/informe-fase-6.md` con el formato de los anteriores: tareas, criterios V1–V29 con dónde se comprueba (Vitest, E2E o guía manual), CI en verde en los 3 SO y resultado de la guía manual.

## Criterios de aceptación

- [ ] Las 3 pruebas pasan en local y en el CI.
- [ ] Capturas tomadas y README.
- [ ] Informe con cada criterio asignado.

## Notas de implementación
