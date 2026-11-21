# 0241 — Pruebas de integración, capturas e informe de la fase 6

- Estado: Hecha (pruebas, capturas, guía manual e [informe](../versiones/0.2.0/informe-fase-6.md) escritos; el **cierre formal espera a que el usuario ejecute la guía manual**; la tarea 0242 sigue pendiente y condicional)
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
3. **Con una sesión abierta** en pantallas simuladas: la exportación termina y la sesión sigue `reproduciendo` (V23). En una de las tres pruebas se usa `webm_vp9` y en otra `mkv_av1` (V16 por formato).

Ejecutar solo esta spec, `exportacion-captura.spec.ts` (0234) y los críticos.

### Lo que va a la guía manual (`docs/Test-manuales/0.2.0/fase-6-exportacion.md`, la escribe `qa`)
M1–M9 de la spec 10 (M9: suspensión del equipo) y, además: tiempo y tamaño de 1080p30 y 3840 × 2160 a 60 FPS en Windows y Linux (contrastar con la tabla del ADR 0019 §2 de la prueba); exportar durante una sesión en dos pantallas reales con un perfil modesto y con 4K/60 (cortes de audio, tirones de la secundaria, CPU, GPU y memoria). Si hay cortes, se abre una revisión del ADR 0019 §9 (tabla de `perfilCompatibleConSesion`).

## Capturas
Las de V29 en `docs/ux/revision-fase-6/` (sin `bloqueo-sesion`; con `nota-sesion`, `formato-webm` y `ayuda-formato`) con una spec *opt-in* (`e2e/exportacion-capturas.spec.ts`, `SHINOBI_CAPTURAS_6=1`), fuera del CI, y un `README.md`.

## Informe
`docs/versiones/0.2.0/informe-fase-6.md` con el formato de los anteriores: tareas, criterios V1–V30 (V24 retirado) con dónde se comprueba (Vitest, E2E o guía manual), CI en verde en los 3 SO y resultado de la guía manual.

## Criterios de aceptación
- [x] Las 3 pruebas pasan en local y en el CI (193 E2E en verde en Ubuntu, run 44858445678).
- [x] Capturas tomadas y README (20 PNG; faltan 4 estados de V29 y el ⋯ abierto de X7, ver el README).
- [x] Informe con cada criterio asignado ([informe-fase-6.md](../versiones/0.2.0/informe-fase-6.md)).

## Notas de implementación

### Pruebas y capturas (programador)
- `app/e2e/exportacion.spec.ts`, 3 pruebas (≈ 7,5 s en total en macOS, 2 pasadas en verde; 2,8 s + 1,6 s + 2,7 s), a 640 × 480 y 24 FPS por la API IPC (no existe `SHINOBI_EXPORTACION_PERFIL_PRUEBA`; el catálogo ya incluye 640 × 480):
  1. MKV: 3 s, 72 fotogramas, 1 flujo de audio, FPS y duración leídos con PyAV, sin temporales ni `en-curso.json`, y el barrido (V17): los píxeles del color de resaltado crecen entre el fotograma 53 (2,2 s) y el 69 (2,9 s).
  2. Cancelar a mitad (30 s de audio, tras 20 fotogramas) sobre un archivo previo: resultado `cancelada`, la carpeta solo contiene el previo con el mismo hash, sin diario. Usa `webm_vp9`.
  3. «Letra lista» a `webm_vp9`: 72 fotogramas y ningún píxel del color de resaltado (sin barrido).
  Los dos formatos quedan cubiertos (MKV en 1, WebM en 2 y 3). No se probó «exportar con sesión abierta» (V23) en E2E: se priorizó Letra lista; la nota con sesión sí se captura. La sonda mide color y no la diferencia media del fotograma (probé esa primero: con texto pequeño no separaba barrido de no barrido, 0,29 frente a 0,36).
- `app/e2e/exportacion-capturas.spec.ts` (`SHINOBI_CAPTURAS_6=1`): 20 PNG en `docs/ux/revision-fase-6/` y su `README.md` (qué estados faltan y por qué). 35 s en total.
- Requisito local: `npm run build` antes (el worktree no tenía `out/`; sin él `electron.launch` se queda esperando) y Playwright sin sandbox.
- Medidas de tiempo (macOS, local): 3 s a 640×480 24 FPS en MKV AV1 ≈ 2,8 s de prueba completa (arranque incluido); 5 s a 1080p30 MKV, «Tardó 3 s».
- Pendiente (no es del programador): guía manual (`qa`) e informe de la fase.

### Defectos / observaciones de UI (corregidos después: commits `03d81e8` y `6339db2`, capturas regeneradas; sin prueba automática, los vigila el caso 17 de la guía)
- El popover «Qué formato elegir» queda recortado por la zona con scroll del diálogo (borde izquierdo e inferior), visible sobre todo a 1280 × 720 al 125 %.
- A 720 de alto la columna de la muestra muestra su propia barra de scroll junto a la del formulario.

### Guía e informe (qa, 2026-11-20)

- Guía: `docs/Test-manuales/0.2.0/fase-6-exportacion.md` (17 casos, con el 17 «Criterios sin prueba automática»; se retira el aviso «pendiente de ajustar» tras revisar los textos contra lo implementado y se corrige el paso 1.19 según la pregunta 0124). **No se ha ejecutado.**
- Informe: `docs/versiones/0.2.0/informe-fase-6.md`. Partes sin prueba automática: V12, V14, V16–V19, V23, V29, X5–X7, EX1, EX2 y EX5. Pregunta **0124 sigue «Abierta»**.
