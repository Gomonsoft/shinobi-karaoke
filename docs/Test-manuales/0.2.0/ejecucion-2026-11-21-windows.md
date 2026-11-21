# Ejecución automatizada de las guías manuales · 2026-11-21 · Windows 11

> Lo medido lleva su cifra y su artefacto; lo supuesto está marcado como «supuesto». Nada se da por aprobado si no se ejecutó.

## 1. Entorno

- Equipo: Windows 11 Pro 10.0.26200, CPU de 12 hilos, NVIDIA GeForce RTX 4070 (12 GB), **una sola pantalla** de 3440 × 1440 a escala 100 % (área de trabajo 3440 × 1392).
- Rama `alpha-2`, versión `0.2.0-alpha.1`, app **sin empaquetar** (`npm run build`, `electron .` desde `app/`); worker en modo desarrollo (`uv run`, `uv 0.13.7` de `app/resources/bin`). No se probó el instalador ni la app empaquetada (hay un `app/release/win-unpacked` del 2026-11-21 00:45, sin usar).
- Herramientas: ffprobe/ffmpeg de WinGet, Node 24, Playwright de `app/`.
- Datos reales: `C:\Users\Gogo\AppData\Local\ShinobiKaraoke` en **solo lectura** (solo se ejecutó `calibrar:silencios`, que es de lectura). Todo lo que escribe usó la copia `…\scratchpad\qa-datos` (9 canciones, `config.json`, `temas.json`) y `…\scratchpad\qa-datos-corto` (Final Ruin recortada a 40 s en su `cancion.json`); videos en `…\scratchpad\qa-salida`.
- La copia hereda de `config.json` el último perfil del usuario (WebM, 1080p, 60 FPS) y su `factor_corrector` (0,82) de exportación: las estimaciones del diálogo ya están corregidas con una exportación previa del usuario (no son «primera vez»).
- La sesión se reinició a mitad de la ejecución (se perdió el proceso de la suite E2E y la primera matriz): lo repetido se indica en cada bloque.

## 2. Calibración de silencios (guía fase 5 · calibración, y caso 15 de la guía de estilo)

Comando: `npm run calibrar:silencios -- C:/Users/Gogo/AppData/Local/ShinobiKaraoke/biblioteca --ids …` (solo lectura, 144 combinaciones). Salidas completas: `scratchpad/calib6.txt`, `calib-<id>.txt`, `calib-3.txt`.

La herramienta toma como «verdad» los **fines fijados a mano de las líneas sin tiempo por palabra** (`fin_ms` numérico). Eso limita mucho el material de las 6 canciones pedidas:

| Canción | Líneas usadas como verdad | Observación |
|---|---|---|
| Final Ruin (2d4a58e2) | **0** | 35 de 36 líneas con tiempo por palabra: la herramienta las ignora |
| A Pesar de Mí (73e3123a) | 30 | fines a mano |
| Arrópame (2be51a65) | 26 | fines a mano |
| Dedos Rotos y Funerales (d1652296) | 21 | **circular**: sus fines son el resultado de «Ajustar los silencios» con los valores actuales (el usuario la dio por perfecta); error 0 ms en todas las combinaciones, no discrimina |
| Valiente (e0b036c8) | 1 | 69 de 71 líneas con palabras |
| Assassins Creed Unity (c993bf84) | **0** | 101 líneas, todas con palabras |

Resultado agregado de las 6 (78 líneas, de las cuales solo 56 son informativas), valor actual `*` = −30 dB / 400 ms / 100 ms: error medio 438 ms, máximo 4708 ms, 6 cortes (propuesta > 150 ms antes de la verdad).

Con las dos canciones con verdad manual limpia (A Pesar de Mí + Arrópame, 56 líneas) y con ¿Y Ahora Qué? añadida (89 líneas; no estaba en la lista del usuario, 33 fines fijados, sin palabras):

| Combinación (umbral/silencio/margen) | 56 líneas: err. medio · máx · cortes | 89 líneas: err. medio · máx · cortes |
|---|---|---|
| −30 dB / 250 ms / 100 ms | 484 ms · 2922 · 5 | 459 ms · 2922 · 6 |
| −30 dB / 250 ms / 50 ms | 494 ms · 2972 · 5 | 458 ms · 2972 · 7 |
| −36 dB / 550 ms / 50 ms | 517 ms · 4708 · **1** | 461 ms · 4708 · **1** |
| `*` −30 dB / 400 ms / 100 ms (actual) | 590 ms · 4708 · 6 | 500 ms · 4708 · 6 |

**Lectura (medida frente a supuesta):** medido: ninguna combinación baja del ~360 ms de error medio y el valor actual está siempre entre los peores de las 10 primeras (590 frente a 484 ms con 56 líneas); en una sola canción (A Pesar de Mí) −30/250/100 da 162 ms frente a 332 ms del actual. Supuesto: que con tan pocas canciones con verdad independiente (2 o 3) se pueda recomendar un cambio. **Recomendación:** los datos **no sostienen** cambiar `PARAMETROS_SILENCIOS` todavía; sí sugieren, para el arquitecto, probar **silencio mínimo 250 ms** (menor error medio) y vigilar los cortes (5–6 frente a 1 con −36 dB / 550 ms, que casi no corta pero deja 14–21 líneas «sin silencio»). Hace falta repetir con más canciones sincronizadas **línea a línea sin tiempos por palabra** y **sin** haber aplicado antes «Ajustar los silencios». La cifra «fines que difieren más de 200 ms» (caso 15.2 de la guía de estilo) **no la imprime la herramienta**: no se midió.

| Caso | Clasificación | Resultado | Evidencia |
|---|---|---|---|
| Calibración 1.1 (ejecutar y obtener tabla de 144 filas con `*`) | a | ✅ | tabla de 144 filas; la fila `*` aparece; sin avisos de caché de picos (las 6 canciones tienen `.picos-voz-v1-*.bin`) |
| Calibración 1.2 (interpretar error medio/cortes) | a | ⚠️ | interpretable solo para 2–3 canciones; ver lectura arriba |
| Calibración 1.3 / estilo 15.1 (copiar tabla al arquitecto) | b | no ejecutado | la tabla queda en este informe y en `scratchpad/calib*.txt`; entregarla al arquitecto es acción humana |
| Estilo 15.2 (difieren > 200 ms) | a/b | no ejecutado | la herramienta no lo calcula |
| Estilo 15.3–15.5 (aplicar en el editor, deshacer, comparar 5 líneas) | b | no ejecutado | requiere el editor y juicio humano |

## 3. Suite Playwright en Windows

Comando: `npx playwright test --workers=1` en `app/` (con `SHINOBI_UV` apuntando a `app/resources/bin/uv.exe`, porque la suite necesita `uv` en el PATH), tras `npm run build`. Salida completa: `scratchpad/e2e-w1.txt`.

**Resultado: 196 passed, 1 failed, 26 skipped (12,7 min).** Los 26 omitidos son las specs opt-in (capturas, red). La suite crítica (`@critico`, `flujo-principal.spec.ts`) **pasó** (22,7 s en la primera pasada). Pasaron en Windows, entre otras, `exportacion.spec.ts` (3 pruebas con PyAV real: exportar a MKV, cancelar conservando el previo, Letra lista a WebM), `exportacion-captura.spec.ts` a 640×480, `fase5.spec.ts` (5 pruebas), `sesion-main`/`sesion-flujo`, `reproductor`, `editor`, `editor-layout` y `temas-*`.

El único fallo:

- `exportacion-captura.spec.ts:34 › captura 3840x2160 exacta y en BGRA`: `La captura es de 3440×1392 y se esperaba 3840×2160.` **Defecto del producto en Windows (límite de pantalla), no de la prueba**: la ventana offscreen se recorta al área de trabajo de la pantalla (3440 × 1392), no solo en alto. La prueba solo se omite en Linux sin GPU con captura ≤ 2 px menor, así que en Windows con pantalla menor que 4K fallará siempre; en un equipo con pantalla ≥ 3840×2160 no se vería. Es el mismo defecto de la sección 4.1.

Primer intento con `--workers=2` (interrumpido por el reinicio del equipo): 68 pasaron y casi todo lo demás falló con `worker process exited unexpectedly (code=3221225794)` / `Process failed to launch!` (0xC0000142, agotamiento de recursos del sistema): **de entorno, no fiable**; la repetición con un solo worker lo descarta (esas pruebas pasan).

## 4. Guía fase 6 · Exportación (`fase-6-exportacion.md`)

Medios: la API real `window.shinobi.exportacion` conducida con Playwright/Electron (scripts en `scratchpad/`: `lib.mjs`, `mat.mjs`, `esc.mjs`, `esc3.mjs`, `ui1-4.mjs`, `mem.mjs`) contra la app compilada y la copia de datos; los videos se verifican con `ffprobe -count_frames`. Resultados crudos: `res-corto.jsonl`, `res-largo.jsonl`, `esc-salida.txt`, `log-esc.txt`, `ui*-salida.txt`. Videos en `scratchpad/qa-salida/videos/`.

### 4.1 Matriz de perfiles reales (hallazgo principal)

Clip de 40 s (Final Ruin recortada en la copia), «Solo instrumental» salvo indicación. Todos los completados: `yuv420p`, Opus 2 canales 48 kHz, FPS constantes (`r_frame_rate` = `avg_frame_rate`), nº de fotogramas = FPS × 40,00 exactos (960/1200/2400) y duración 40,01 s; ningún temporal ni diario sobrante.

| Perfil | MKV (AV1+Opus) | WebM (VP9+Opus) |
|---|---|---|
| 1280×720 · 24 / 30 / 60 | ✅ 19,0 / 23,3 / 45,1 s | ✅ 18,8 / 22,3 / 44,1 s |
| 1920×1080 · 24 / 30 / 60 | ✅ 29,4 / 36,6 / 73,4 s | ✅ 28,4 / 35,2 / 69,8 s |
| **2560×1440 · 30** | ❌ `PERFIL_NO_SOPORTADO` en 0,8 s: «La captura es de 2560×1392 y se esperaba 2560×1440.» | ❌ igual |
| **3840×2160 · 30** | ❌ `PERFIL_NO_SOPORTADO`: «La captura es de 3440×1392 y se esperaba 3840×2160.» | ❌ igual |
| 640×480 · 30 (4:3) | ✅ 18,4 s | ✅ 17,0 s |
| 1024×768 · 30 | ✅ 21,9 s | ✅ 21,2 s |
| 1600×1200 · 30 | ✅ 34,2 s | ✅ 34,2 s |
| **2880×2160 · 30** | ❌ «La captura es de 2880×1392 y se esperaba 2880×2160.» | ❌ igual |
| 1280×720 · 30 con «Instrumental y voz» | ✅ 23,4 s | ✅ 23,0 s |

- Alcance real del límite: es el **área de trabajo de la pantalla** (3440 × 1392) y no solo el alto: fallan **todos los perfiles con alto > 1392 o ancho > 3440** (aquí 3 resoluciones × 3 FPS × 2 formatos = **18 de las 48 combinaciones**, probadas 5 de ellas a 30 FPS; los 60/24 FPS de esas resoluciones se supone igual, no se ejecutaron). 1600×1200 sí funciona. Con una pantalla más pequeña (p. ej. portátil de 1080p o 1366×768 con barra de tareas) se esperaría que fallen también perfiles menores: **supuesto**, no probado.
- `exportacion.perfiles()` devolvió **0 de 48 no soportados**: el sondeo del equipo no detecta el problema, así que el formulario ofrece las 18 combinaciones como disponibles y solo falla al exportar (V5, caso 10.1, no se cumple en este equipo).
- Al fallar, el diálogo (UI real) dice «No se pudo exportar el video · Tu equipo no puede crear el video con estas opciones. Prueba con otra resolución, menos fotogramas por segundo u otro formato. · 2560 × 1440 · 30 FPS · Solo instrumental · MKV · Se detuvo mientras preparaba la canción.» con **solo** [Copiar detalles] y [Cambiar opciones] (sin [Reintentar], porque el error no es reintentable). El «motivo» («La captura es de…») solo está en los detalles.
- **Ningún fallo de exportación se escribe en `registros/app.log`** (revisado tras las 18 exportaciones fallidas, la cancelación, el fallo de permisos y la muerte del proceso: 0 líneas de exportación).
- Ninguna exportación de 4K/60 pudo hacerse, así que 8.3, 8.4, 8.9, 17.12 («no se asentaron») y la parte de 4K de 11.5 **no son verificables en este equipo** con esta pantalla.

### 4.2 Tiempos y estimaciones (casos 8.1, 8.2, 8.7)

Canción completa Final Ruin (226,03 s, 6781 fotogramas a 30 FPS), equipo sin otra carga salvo la suite parada, GPU RTX 4070 (no se mide uso de GPU/CPU: no se midió):

| Perfil | Tiempo real | Estimación del diálogo | Tamaño real / estimado | ffprobe |
|---|---|---|---|---|
| MKV 1080p30 instrumental | **203,5 s** (0,90 × la duración) | 223 s (+10 %) | 9,6 MB / 22 MB | av1 1920×1080 30 fps, 6781 fotogramas, opus 2 ch 48 kHz, duración 226,03 s |
| WebM 1080p30 instrumental | **215,0 s** (0,95 ×) | 256 s (+19 %) | 10,7 MB / 26 MB | vp9, 6781 fotogramas, 226,03 s |
| MKV 720p30 con voz | **131,5 s** (0,58 ×) | 98 s (−25 %) | 8,6 MB / 17 MB | av1 1280×720, 6781 fotogramas |
| WebM 1080p60 instrumental | **408,8 s** (1,81 ×) | 549 s (+34 %) | 12,1 MB / 32 MB | vp9 1920×1080 60 fps, 13562 fotogramas, 226,03 s |

- Tiempos: dentro de ±50 % en las 4 canciones completas y en los 26 clips (rango −36 % a +36 % en los clips: p. ej. 720p60 estimó 33 s y tardó 45 s; 720p con voz, 15 s frente a 23 s). **8.7 ✅** (con la salvedad de que la copia hereda un `factor_corrector` de 0,82 del usuario: no es «primera vez»).
- **Tamaño**: la estimación sobrestima **2,2–2,7 ×** (22 MB frente a 9,6 MB; 26 frente a 10,7; 32 frente a 12,1; 17 frente a 8,6). No lo pide la guía, pero la estimación de espacio («Ocupará unos 24 MB») sale falsa por mucho para esta canción.
- 8.8 (la segunda exportación mejora la estimación): no se aisló; la copia ya traía corrección. No ejecutado.
- Memoria máxima (9.1, informativo; suma de los *working set* de `electron.exe`+`python.exe`+`ffmpeg.exe` muestreada cada 1 s, **sobrecuenta** páginas compartidas): reposo 383 MB, **pico 1568 MB con 7 procesos** exportando 40 s a 1080p30 MKV. El navegador de la ventana offscreen y el worker están incluidos; es una cota alta, no una medida exacta.

### 4.3 Escenarios de borde conducidos por la API (casos 5, 6, 12, 13, 16)

| Escenario | Resultado | Evidencia |
|---|---|---|
| Cancelar a mitad con archivo previo en el destino (12.2, 5.16) | ✅ | resultado `cancelada` a los 9,4 s; el archivo previo conserva tamaño, `mtime` y contenido («video anterior»); la carpeta no tiene temporal (se listaron también ocultos) ni `en-curso.json` |
| Sustituir terminando (12.3, 2.6 en API) | ✅ | `destinoExistia: true`, `completada`, 1 230 170 bytes, ffprobe correcto, sin restos |
| Dos exportaciones de la **misma canción** a la vez | ⚠️ distinto a la guía | la segunda se rechaza con código `ARGUMENTOS_NO_VALIDOS` y mensaje «La canción ya tiene una exportación en marcha.» (la guía 5.9 solo habla de otra canción; con otra canción ver siguiente fila). El código genérico no se corresponde con `DESTINO_OCUPADO` |
| Cola con **otra** canción (5.9–5.11) | ✅ | Arrópame queda `en_cola` posición 1 mientras Final Ruin está `en_curso`; «quitar de la cola» → `cancelada`; al ponerla otra vez **empieza sola** a los 35,2 s al terminar la primera y completa; mismo nombre de canción repetido en cola → rechazo («ya tiene una exportación») |
| Voz ausente con «Instrumental y voz» (2.9 en API) | ✅ | `CANCION_NO_DISPONIBLE`: «Falta la pista de voz.» (la inactividad de la opción en el formulario no se comprobó en la UI) |
| Carpeta sin permiso de escritura (6.3, icacls deny) | ⚠️ | falla al exportar con `DESTINO_NO_DISPONIBLE` («No se puede escribir en el destino», `posicionMs` 100) tras arrancar el codificador; **no** se detecta antes de iniciar |
| Carpeta recordada inexistente (2.8 en API) | ✅ | `carpetaRecordadaNoDisponible: true` y propone `C:\Users\Gogo\Videos\…` (solo se calculó la ruta, no se escribió) |
| **Matar el proceso** a mitad (13.5–13.7) | ✅ | antes: temporal oculto `.Final Ruin — … .mkv.<id>.shinobi-parcial` y `exportacion/en-curso.json`; tras `taskkill /F` el temporal desapareció solo (lo borró el proceso hijo al perder a su padre o la propia reapertura: la carpeta ya estaba vacía antes de reabrir); al reabrir sale **una vez** «La exportación de «Final Ruin» no terminó porque Shinobi Karaoke se cerró.» y en la segunda reapertura **no** vuelve |
| Cierre con exportación en curso (13.1–13.3) por el diálogo de cierre | no ejecutado | `app.exit` omite la confirmación; el diálogo (texto y foco) no se condujo |
| Protección contra suspensión (15.1) | ❌ no medible | `powercfg /requests` exige administrador; no se comprobó. Tampoco el efecto real de suspender el equipo |

### 4.4 Casos de la guía (por grupo)

Leyenda: a = automatizable aquí, b = solo humano, c = no ejecutable en este equipo.

| Caso | Cl. | Resultado | Evidencia breve |
|---|---|---|---|
| **1.1** ítem «Exportar video…» entre «Editar datos» y «Aplicar tema…» | a | ✅ | menú de la Lista: `…Editar datos, Exportar video…, Aplicar tema…` (`ui1-salida.txt`) |
| **1.2** borrador sin el ítem; Letra lista e incompleta con él | a | ⚠️ | borrador (Especial de Medianoche): menú «Continuar, Editar datos, Aplicar tema…, Mostrar en la carpeta, Eliminar…» ✅; Letra lista (Assassins Creed Unity) ✅. Incompleta (E): no se comprobó |
| **1.3** diálogo y «Comprobando qué puede exportar tu equipo…» | a | ✅ | se vio «Cargando la canción… / Comprobando qué puede exportar tu equipo…» y luego «Exportar video / «Final Ruin» · José Madero · 3:46» |
| **1.4** controles del formulario | a | ✅ | Audio, Proporción, Resolución, FPS 24/30/60, Formato, Guardar como [Cambiar…], estimación «Ocupará unos 24 MB · tardará unos 4 minutos», Muestra con «Shinobi Karaoke» |
| **1.5** valores por defecto la primera vez | a | no ejecutado | la copia trae el último perfil del usuario (WebM, 60 FPS); no se probó con `config.json` limpio. Foco inicial: en estado «cargando» estaba en «Cancelar»; con el diálogo ya cargado el script también devolvió «Cancelar» (la guía espera «Audio»): ⚠️ **posible diferencia**, no confirmada porque `Exportar` visible no garantiza fin de carga |
| **1.6** lista 16:9 | a | ✅ | «1280 × 720 · HD», «1920 × 1080 · Full HD», «2560 × 1440 · QHD», «3840 × 2160 · 4K UHD» (exacto) |
| **1.7** lista 4:3 | a | ✅ parcial | «640 × 480 · SD», «1024 × 768 · XGA», «1600 × 1200 · UXGA», «2880 × 2160 · 4:3 máxima»; con 1080p pasa a 1024 × 768 ✅ |
| **1.8** WebM | a | ✅ | pista «Se abre en más sitios: navegadores (también Safari), Windows y Android. Ocupa algo más.»; muestra «1280 × 720 · 60 FPS · WebM». La extensión `.webm` del nombre se verificó en los archivos (`…(karaoke).webm`) |
| **1.9** ⓘ con Intro, texto y Esc con foco en ⓘ | a | ✅ / ⚠️ | texto exacto con QuickTime y televisores ✅; Esc cierra el popover y el foco vuelve al ⓘ ✅. **Incidencia:** un segundo Esc (foco en ⓘ) **no cierra el diálogo** (ver incidencia I-5) |
| **1.10** Muestra | a | ✅ parcial | línea con barrido, siguiente, «Shinobi Karaoke», «1920 × 1080 · 30 FPS · MKV», «El video lleva la marca «Shinobi Karaoke» en esta esquina.»; la posición visual no se midió |
| **1.11** Cancelar / Esc cierran y el foco vuelve al ⋯ | a | ✅ | con Esc y con [Cancelar]: foco = «Más acciones de «Final Ruin»» |
| **1.12–1.16** editor: ítem, Ctrl+E, pausa, foco, bloqueos, F1 | a (editor) | no ejecutado | `editor.spec.ts`/pruebas de componente lo cubren; no se condujo a mano |
| **1.17** recuerda opciones | a | ⚠️ | el formulario abrió con las opciones del uso anterior en cada arranque (WebM/60 en la copia, luego las que dejaron mis exportaciones por API); no se probó el recuerdo con la UI «cambiar → exportar → cancelar → reabrir» |
| **1.18** diálogo «Guardar» del sistema | b | no ejecutado | diálogo nativo |
| **1.19**, **1.20** destino al cambiar formato; caracteres prohibidos | a | no ejecutado | sin tiempo; nombre propuesto con tildes y «—» verificado: «Final Ruin — José Madero (karaoke).mkv» |
| **2.1** nota Letra lista | a | ✅ | «Letra lista: en el video la letra cambiará línea a línea, sin barrido, igual que en el reproductor.» y muestra sin barrido |
| **2.2** incompleta; **2.3**, **2.4** borrador/tema sin guardar | a | no ejecutado | el borrador no tiene «Exportar» en la Biblioteca (2.3 exige abrir desde el editor) |
| **2.5** nota de perfil costoso (4K/60) | a | no ejecutado | el script no llegó a leer la nota (error de selector en el script) |
| **2.6** aviso «Ya hay un archivo…» / «Exportar y sustituir» | a | ⚠️ | en la API `existe: true` ✅; el texto del aviso y el botón no se leyeron en la UI esta vez (los cubre `exportacion-capturas`/pruebas) |
| **2.7** poco espacio | b | no ejecutado | requiere un disco casi lleno |
| **2.8** carpeta no disponible | a | ✅ API | `carpetaRecordadaNoDisponible: true` |
| **2.9** sin voz | a | ✅ API | `CANCION_NO_DISPONIBLE` |
| **3.1** 4 resoluciones MKV | a/b | ❌ en 2 de 4 | 720p y 1080p ✅ técnicamente; 1440p y 4K ❌ (ver 4.1). La nitidez/bandas es percepción (b) |
| **3.2** lo mismo en WebM | a/b | ❌ en 2 de 4 | igual |
| **3.3** 4:3 1024 y 2880 | a/b | ⚠️ | 1024×768 ✅ y 1600×1200 ✅; 2880×2160 ❌ |
| **3.4–3.7**, **3.8**, **3.9**, **3.10**, **3.12** aspecto, marca, comparación con reproductor, movimiento reducido | b | no ejecutado | percepción visual |
| **3.11 / 17.5** Letra lista sin barrido, borrador con barrido | a | no ejecutado aquí | cubierto por `exportacion.spec.ts` («Letra lista» a WebM), que **pasó** en Windows (ver 3) |
| **3.13** códecs, estéreo, 48 kHz, FPS y resolución | a | ✅ | ffprobe: MKV `av1`+`opus`, WebM `vp9`+`opus`, 2 canales, 48 000 Hz, FPS constantes, resoluciones elegidas, `yuv420p` |
| **3.14** duración igual a la canción | a | ✅ | 226,03 s del video frente a 226 027 ms de la canción; 40,01 s de 40 000 ms |
| **3.15** voz vs solo instrumental (nivel, sin saturación) | b | no ejecutado | la voz se exportó correctamente (completó), pero el volumen y la saturación no se midieron |
| **4.1–4.4** sincronía percibida a 6 min | b | no ejecutado | requiere escuchar; además no hay canción de 6 min |
| **5.1** diálogo de progreso y subpasos | a | ✅ | «Exportando video · «Final Ruin» · José Madero · 1280 × 720 · 30 FPS · Solo instrumental · MKV · Preparar la canción · Crear el video · Terminar el archivo» |
| **5.2** progreso | a | ✅ | a los 6 s «Creando el video… 24 % · Calculando tiempo… · 0:10 de 0:40» (no se comprobó que la barra no retroceda) |
| **5.3** ayuda y foco | a | ✅ | texto exacto; foco en «Seguir en segundo plano» |
| **5.4** segundo plano | a | ✅ | el diálogo se cerró y la exportación continuó (tarjeta con 31 %) |
| **5.5** tarjeta | a | ✅ | «Exportando video 31 %»; el «quedan unos n min» y la estabilidad del foco no se midieron |
| **5.6, 5.7** panel de actividad, [Ir] | a | no ejecutado | el script no halló el botón del panel (selector) |
| **5.8** editar durante la exportación | a | no ejecutado | |
| **5.9–5.11** cola | a | ✅ API | ver 4.3; los textos de la UI («En cola…», «Quitar de la cola») no se leyeron |
| **5.12** separación a la vez | a | no ejecutado | exigiría importar y separar (modelo) |
| **5.13–5.16** cancelar con confirmación | a | ✅ | «¿Cancelar la exportación? Se borrará lo que lleva hecho.», foco en «Seguir exportando»; tras confirmar: «Exportación cancelada.» y carpeta sin restos. No se vio «Cancelando y borrando el archivo temporal…» (la cancelación fue demasiado rápida) |
| **5.17** cancelar desde panel/⋯ | a | ⚠️ | el ⋯ de la tarjeta muestra «Ver exportación» y «Cancelar exportación…» ✅; el panel no se probó |
| **5.18** eliminar con exportación en curso | a | ✅ | diálogo: «¿Eliminar «Arrópame»? … Se cancelará la exportación de video en curso.»; tras confirmar, la carpeta de destino no tiene temporal |
| **5.19** teclado / **5.20** lector de pantalla | b | no ejecutado | |
| **6.1** éxito con diálogo abierto | a | ⚠️ | no se vio la pantalla «Video exportado» abierta; sí el aviso con el diálogo cerrado |
| **6.2** aviso con diálogo cerrado | a | ✅ parcial | ««Final Ruin»: video exportado.» con [Mostrar en la carpeta]; que no se cierre solo y la notificación del sistema no se comprobaron |
| **6.3** carpeta sin permiso | a | ⚠️ | falla pero al exportar, no antes (ver 4.3); el texto «No se puede guardar en esa carpeta.» no se vio en la UI |
| **6.4** disco lleno | b | no ejecutado | |
| **6.5** Copiar detalles | a | ✅ parcial | el portapapeles quedó con un bloque «…Formato: MKV (AV1 + Opus) / Posición: antes del primer fotograma / Versión: 0.…»; el aviso «Detalles copiados.» no se confirmó |
| **6.6** Cambiar opciones / Reintentar | a | ⚠️ | «Cambiar opciones» vuelve al formulario con 2560 × 1440 conservado ✅; **no hay [Reintentar]** en este error |
| **6.7**, **6.8** | a | no ejecutado | 6.8 (mismo archivo) no pudo provocarse sin «Cambiar…» nativo |
| **7.1–7.10** reproductores externos | b | no ejecutado | VLC, OBS, navegadores, Reproductor multimedia y TV son humanos. Solo se sabe que `ffprobe` lee los MKV/WebM |
| **8.1, 8.2** 1080p30 MKV/WebM | a | ✅ | 203,5 s y 215,0 s (ver 4.2) |
| **8.3, 8.4, 8.9** 4K/60 | a | ❌ | imposible aquí: `PERFIL_NO_SOPORTADO` |
| **8.5, 8.6** Linux, macOS | c | no ejecutable | otro SO |
| **8.7** estimación ±50 % | a | ✅ | ver 4.2 |
| **8.8** segunda exportación mejora | a | no ejecutado | |
| **8.10** Linux con GPU | c | no ejecutable | |
| **9.1** equipo modesto 720p | a/c | ⚠️ | medido en un equipo **potente**, no modesto: 131,5 s y 8,6 MB a 720p30 con voz, pico 1568 MB (ver 4.2). No sustituye al caso |
| **9.2–9.5** 4K/60, usabilidad, tirones, calor | b/c | no ejecutado | |
| **10.1–10.6** 8 GB | c | no ejecutable | equipo de 8 GB o menos; aquí la RAM no limita. **10.1** además muestra lo contrario: aparecen disponibles perfiles que fallan |
| **11.1–11.10** exportar con sesión en dos pantallas | c | **no ejecutable en este equipo** | una sola pantalla; no se simuló como aprobado |
| **12.1–12.3** sustituir | a | ✅ | ver 4.3 |
| **12.4** fallo a mitad con archivo previo | a/b | no ejecutado | |
| **12.5, 12.6** archivo abierto en VLC (Windows) | b | no ejecutado | exige un reproductor abierto sobre el archivo |
| **12.7** macOS/Linux | c | no ejecutable | |
| **13.1–13.3** diálogo de cierre | a/b | no ejecutado | ver 4.3 |
| **13.4** al abrir tras cierre limpio no sale aviso | a | no ejecutado | |
| **13.5–13.7** matar el proceso | a | ✅ | ver 4.3 |
| **13.8** macOS | c | no ejecutable | |
| **13.9** reparar el motor con exportación en curso | a | no ejecutado | |
| **14.1, 14.4** Mostrar en la carpeta (Explorador, archivo seleccionado) | b | no ejecutado | abre el Explorador en la pantalla del usuario |
| **14.2, 14.3** | c | no ejecutable | |
| **14.5** video borrado → «El video ya no está en esa carpeta.» | a | no ejecutado | |
| **15.1–15.4** suspensión | b | no ejecutado | ver 4.3 |
| **16.1, 16.2** sin motor | a | no ejecutado | exigía dañar una copia del runtime (gigas) |
| **17.1, 17.2** layouts 1024×576 | a | no ejecutado aquí | en el CI `exportacion-capturas` (opt-in) |
| **17.3** mismo archivo en dos exportaciones | a | ⚠️ | ver 4.3 (misma canción) |
| **17.4, 17.6, 17.7** comparación visual y volumen | b | no ejecutado | |
| **17.8** «Ver exportación» y «Cancelar exportación…» en el ⋯ | a | ✅ parcial | ítems de la tarjeta con exportación en curso: «…Editar datos, Ver exportación, Aplicar tema…, Volver a borrador, Mostrar en la carpeta, Cancelar exportación…, Eliminar…» (en el editor no se comprobó) |
| **17.9** eliminar con exportación en curso | a | ✅ | = 5.18 |
| **17.10, 17.11** | a/b | no ejecutado | |
| **17.12** «no se asentaron» tras 4K | a | no ejecutado | no hay exportaciones 4K; `registros/app.log` sin esa línea (ninguna exportación completó a 4K) |

### 4.5 Paquete (`npm run test:paquete`, relacionado con fase 4 · 11.4)

Con `SHINOBI_PAQUETE_BIN=app/release/win-unpacked/Shinobi Karaoke.exe` (paquete **ya existente** del 2026-11-21 00:45; no se reconstruyó, así que puede no corresponder al último commit): **4 pasaron, 2 fallaron** (`scratchpad/e2e-paquete.txt`):

- ❌ `paquete.spec.ts:69 › B1 usa el manifiesto…`: no encuentra `Descarga: unos 1,3 GB para tu equipo` en 5 s.
- ❌ `paquete.spec.ts:137 › la Biblioteca carga la semilla…`: no aparece el encabezado «Biblioteca» (`exact: true`) en 5 s.
- Pasaron: textos legales empaquetados, «instalación completa sin runtime llega a Reparar», fuses y segunda instancia.
- **Sin clasificar**: puede ser un paquete obsoleto (hipótesis), un problema de arranque del paquete en Windows o inestabilidad de carga. No se investigó más; el caso 11.4 de la guía de la fase 4 queda ⚠️ sin confirmar (el paquete arranca y responde IPC, pero la Biblioteca no se vio en esas 2 pruebas). Hay que reconstruir con `npm run empaquetar:dir` y repetir.

## 5. Guía fase 5 · Estilo, espera y Letra lista (`fase-5-estilo-espera-y-letra-lista.md`)

Medios: la suite Playwright (sección 3, en concreto `fase5.spec.ts`, 5 pruebas pasadas en Windows) y `ui5.mjs` (editor real sobre la copia de datos). Los casos marcados «✅ por E2E» lo son por **la prueba automática que ya existe**, no por una ejecución manual equivalente.

| Caso | Cl. | Resultado | Evidencia |
|---|---|---|---|
| **1** controles de degradado y movimiento (1.1–1.13) | a/b | no ejecutado | `editor.spec.ts` cubre parte (pasó); no se condujo cada paso |
| **2** cónico sin costura (2.1–2.5) | b | no ejecutado | percepción visual |
| **3.1–3.3** misma fase en editor y reproductor | a | ✅ por E2E | `fase5.spec.ts › la misma fase del fondo a 12,3 s en la vista previa del editor y en el reproductor` pasó (1,5 s) |
| **3.4–3.7** pausa, buscar, final, portada | a/b | no ejecutado | |
| **4** fluidez del fondo en equipo modesto | c/b | no ejecutable | exige equipo modesto y mirar; aquí hay RTX 4070 |
| **5** velocidades en TV a 5 m | c/b | no ejecutable | sin TV; es opinión |
| **6** cuenta y barra a 5 m, TV y proyector | c/b | no ejecutable | |
| **7.2–7.4** movimiento reducido | a | ✅ por E2E (emulado) | `fase5.spec.ts › movimiento reducido: el fondo queda en la fase 0, con su nota y sin botón de detener` pasó (2,5 s). **No** se alteró el ajuste real de Windows (7.1, 7.8: humano); 7.5–7.7 no ejecutados |
| **8** indicadores de espera (8.1–8.16) | a/b | no ejecutado | el script `ui5.mjs` no encontró la pestaña «Estilo» por su rol (error del script) |
| **9** secundaria con dos pantallas en equipo modesto | c | **no ejecutable en este equipo** | dos pantallas |
| **10** marcar como Letra lista (10.3, 10.6, 10.9, 10.11) | a | ✅ por E2E | `fase5.spec.ts › Letra lista de punta a punta` pasó (1,7 s). Textos exactos y comprensión del diálogo (10.3), persistencia tras reiniciar (10.13/10.14) y el resto: no ejecutado |
| **11** Letra lista en canción rápida | b | no ejecutado | |
| **12** cambiar de modalidad y contraste | a | no ejecutado | 12.9 requiere sesión |
| **13** Letra lista en cola y secundaria | a/c | ⚠️ | `fase5.spec.ts › Letra lista en la sesión` pasó con pantallas **simuladas** (12,2 s); con dos pantallas reales es no ejecutable |
| **14.1** botón con texto | a | ✅ | A Pesar de Mí: botón «Ajustar los silencios» visible |
| **14.10, 14.11** diálogo y recuentos | a | ✅ | «¿Ajustar los silencios?» con el texto esperado; «Cambiará el fin de 5 de 31 líneas.», «5 de ellas tenían un fin fijado (a mano o con la letra). También se ajustarán.», «Quedará 1 silencio de 4,0 s o más, con la cuenta 3·2·1 que ya tiene esta canción.», «Puedes deshacerlo de una vez con Ctrl+Z.» (no se aplicó) |
| **14.12** ver las líneas | a | ✅ | 5 filas «Línea 10 · «Que hasta con diez tazas de café» 01:26.46 → 01:27.34 · fijado»; la 17 lleva «· silencio largo» |
| **14.15** Esc cierra y devuelve el foco | a | ✅ parcial | foco en «Ajustar los silencios»; `cancion.json` de la copia quedó idéntico al original (`cmp`) |
| **14.2–14.9, 14.13–14.14, 14.16–14.37** resto de «Ajustar los silencios» | a/b | no ejecutado | aplicar/deshacer/rehacer, B «Seguidas», con tema, lector de pantalla. `editor.spec.ts` (0215) pasó |
| **15.1** tabla de calibración | a | ✅ | sección 2 |
| **15.2** fines que difieren > 200 ms | a | no ejecutado | la herramienta no lo imprime |
| **15.3–15.5** | b | no ejecutado | |
| **16.1–16.6** abrir con 0.1.0 | a/b | no ejecutado | no hay 0.1.0 instalada aquí |
| **17.1–17.4** aspectos pendientes | a/b | no ejecutado | |
| **18.2** abrir y mirar no escribe `cancion.json` (IE1) | a | ✅ | abrir en el editor A Pesar de Mí y su diálogo «Ajustar los silencios»: el archivo de la copia sigue **byte a byte idéntico** al original (`cmp`), con la fecha 10:40:53; la canción no tiene `espera` (formato antiguo) |
| **18.1, 18.3–18.9** | a/b | no ejecutado | |
| **18.10** capturas a 1920×1080 | a | no ejecutado | la prueba escribe en `docs/ux/revision-0.2.0-fase-5/` (archivos del repo): no se hizo. La pantalla de este equipo (3440×1392 útiles) sí permitiría 1080 px de alto |

## 6. Guía fase 4 · Ventana secundaria y cola (`fase-4-ventana-secundaria-y-cola.md`)

Con una sola pantalla, **todo lo que exige una segunda pantalla real queda «no ejecutable en este equipo»**. Las pruebas E2E de la fase 4 usan pantallas **simuladas**: que pasen **no** equivale a haber hecho la guía.

| Caso | Cl. | Resultado | Evidencia |
|---|---|---|---|
| **1** abrir en la segunda pantalla (1.1–1.13) | c | **no ejecutable** | `sesion-main.spec.ts` y `sesion-flujo.spec.ts` (simuladas) pasaron: roles y ventanas, un `fin` repetido cuenta una vez, cierre conservando la cola y caída de la secundaria. No sustituyen a 1.2 (resoluciones reales), 1.3 (foco sin robar), 1.5 (un solo audio) ni 1.8 |
| **2** macOS | c | no ejecutable | otro SO |
| **3** Wayland | c | no ejecutable | otro SO |
| **4** cuenta entre canciones (4.1–4.8) | b/c | no ejecutable / no ejecutado | la lógica de fin y cuenta (con `transicion_s` = 2) pasó en `sesion-flujo.spec.ts`; ver y cronometrar con la secundaria real: humano |
| **5** desconectar y reconectar el cable | c | **no ejecutable** | |
| **6** audio por HDMI | c | **no ejecutable** | |
| **7** escalas distintas | c | **no ejecutable** | |
| **8** reposo en un evento largo | b/c | no ejecutado | requiere esperar con la pantalla apagándose y, por diseño, dos pantallas |
| **9** sesión larga (30 min) con separación | c | **no ejecutable** | |
| **10** salir con el reproductor abierto (macOS) | c | no ejecutable | `sesion-main.spec.ts` (`ses.salir`) cubre la lógica común |
| **11.1** sin scroll de página en el editor | a | ✅ por E2E | la suite crítica comprueba `scrollHeight ≤ innerHeight` en Biblioteca y Editor (pasó) y `editor-layout.spec.ts` pasó; no se maximizó a mano a 3440×1392 |
| **11.2, 11.3** foco al cerrar el reproductor | a | no ejecutado | |
| **11.4** arranque de la app empaquetada en Windows | a | ⚠️ sin confirmar | ver 4.5: 2 de 6 pruebas del paquete fallan con un paquete posiblemente obsoleto |
| **12.1–12.5** cola a 1024×576, guardar antes de abrir, foco, teclas, arrastrar | a/b | no ejecutado | |

## 7. Incidencias nuevas (por gravedad)

| # | Gravedad | Descripción | Causa probable y lugar |
|---|---|---|---|
| I-1 | **Alta** (en este equipo) | **Las exportaciones de 1440p, 4K y 4:3 máxima (2880×2160) fallan con `PERFIL_NO_SOPORTADO`** (18 de 48 combinaciones; 6 probadas a 30 FPS en los dos formatos) porque la ventana offscreen se recorta al área de trabajo del monitor (3440×1392): «La captura es de 2560×1392 y se esperaba 2560×1440» y «de 3440×1392 y se esperaba 3840×2160». El límite es el tamaño de la pantalla, **en ancho y en alto**, no solo el alto. Afecta a cualquier usuario con un monitor menor que el perfil. Que falle también 1080p con un portátil de 1366×768 es **supuesto**, no probado | `app/src/main/exportacion/ventana.ts:123-138`. Se ve también en `exportacion-captura.spec.ts:34` (único fallo de la suite) |
| I-2 | **Alta** | **El sondeo de perfiles no detecta I-1**: `perfiles()` devuelve 0 de 48 no soportados, así que el formulario ofrece como disponibles opciones que siempre fallan. Se descubre solo al exportar («Tu equipo no puede crear el video con estas opciones…») y sin [Reintentar]. Contradice V5 y el caso 10.1 | sondeo de perfiles en `app/src/main/exportacion/servicio.ts`: debería probar la captura del tamaño real, o la ventana no debería depender del monitor |
| I-3 | **Media** | **Los fallos de exportación no se registran en `app.log`** (0 líneas tras 18 fallos, una cancelación, un fallo de permisos y un cierre brusco); el motivo («La captura es de…») solo está en «Copiar detalles». Impide diagnosticar a distancia | `app/src/main/exportacion/servicio.ts:920-930` (ya conocido; aquí se mide) |
| I-4 | **Media** | La **estimación de tamaño** del diálogo sobrestima 2,2–2,7 × (22 MB frente a 9,6 MB; 26 / 10,7; 32 / 12,1; 17 / 8,6) con una canción de 226 s. Los tiempos sí están dentro de ±50 % | estimador de tamaño en `app/src/shared/exportacion.ts` |
| I-5 | **Baja** | Con el foco en el botón ⓘ de «Formato» (tras el primer Esc, que cierra el popover), **Esc ya no cierra el diálogo**: hay que usar [Cancelar] | `app/src/renderer/src/exportacion/dialogo/Formulario.tsx:211-268`: el `onKeyDown={cerrarAyuda}` del ⓘ hace `stopPropagation` en cada Esc aunque el popover esté cerrado |
| I-6 | **Baja** | Carpeta sin permiso de escritura: `DESTINO_NO_DISPONIBLE` («No se puede escribir en el destino») llega **después** de arrancar el codificador (`posicionMs: 100`), no al iniciar | servicio de exportación |
| I-7 | **Baja** | Dos exportaciones de la **misma canción** se rechazan con el código genérico `ARGUMENTOS_NO_VALIDOS` («La canción ya tiene una exportación en marcha.»), no con `DESTINO_OCUPADO`; el texto puede diferir del de la guía (6.8 / 17.3) | `iniciar` en el servicio de exportación |
| I-8 | **Baja (herramienta)** | `calibrar:silencios` solo usa líneas **sin** tiempo por palabra y toma como verdad cualquier `fin_ms` fijado, incluidos los que salieron de «Ajustar los silencios»: con las canciones del usuario, 3 de 6 aportan 0–1 líneas y Dedos Rotos es circular (error 0 ms). La calibración no es concluyente | `app/scripts/calibrar-silencios.ts` (selección de líneas) |
| I-9 | **A confirmar** | Paquete de Windows: 2 de 6 pruebas de `test:paquete` fallan (Biblioteca no visible, B1 sin la línea de descarga). Posible paquete obsoleto | `app/e2e-paquete/paquete.spec.ts:69,137`; ver 4.5 |
| I-10 | **Informativa** | Foco inicial del diálogo de exportación: el script lo midió siempre en «Cancelar»; la guía (1.5) espera «Audio». No confirmado | `DialogoFormulario.tsx` |

## 8. Lo que sigue necesitando a una persona

- **Todo lo de dos pantallas** (no ejecutable aquí; **no probado**): fase 4 casos 1, 4 (parte real), 5, 6, 7, 9; fase 6 caso 11 (11.1–11.10); fase 5 casos 9 y 13 (real), 6.6; fase 5 caso 4 en equipo modesto.
- **Percepción y audio**: nitidez, bandas, marca de agua y comparación con el reproductor (fase 6, caso 3 y 17.4 / 17.6 / 17.7); sincronía a 6 min (caso 4); volumen y saturación de la voz (3.15); reproductores externos (caso 7: VLC, OBS, navegadores, Reproductor multimedia con y sin AV1, TV); cónico sin costura, velocidades y legibilidad de la cuenta a 5 m (fase 5 casos 2, 5, 6, 11).
- **Sistemas y equipos que no están aquí**: Linux y macOS (8.5, 8.6, 8.10, 12.7, 13.8, 14.2, 14.3); equipo modesto (9.x) y de 8 GB (10.x).
- **En este equipo pero con una persona**: diálogo «Guardar» nativo (1.18), «Mostrar en la carpeta» en el Explorador (14.1, 14.4), sustitución con el archivo abierto en VLC (12.5 / 12.6), notificación del sistema (6.2), suspensión y apagado de pantalla (15.x, fase 4 caso 8), cierre con exportación en curso por el diálogo de cierre (13.1–13.3), disco lleno o poco espacio (2.7, 6.4), lectores de pantalla (5.19, 5.20), abrir con 0.1.0 (fase 5 caso 16).
- **Repetir tras un arreglo**: 1440p, 4K y 2880×2160 en este equipo (I-1) y con ello 8.3, 8.4, 8.9 y 17.12; reconstruir el paquete y repetir `test:paquete` (I-9).
- `npm test` (Vitest) no se ejecutó: es del CI.

## 9. Limpieza

Datos reales de `C:\Users\Gogo\AppData\Local\ShinobiKaraoke`: no modificados (solo `calibrar:silencios`, de lectura; el `cancion.json` de A Pesar de Mí conserva la fecha 10:40:53). `C:\Users\Gogo\Videos` no se tocó (el `Final Ruin — José Madero (karaoke).mkv` de las 10:00 es del usuario). Videos de prueba, copias de datos y registros en `…\scratchpad\qa-salida`, `qa-datos` y `qa-datos-corto`. Sin cambios en código, pruebas ni guías.
