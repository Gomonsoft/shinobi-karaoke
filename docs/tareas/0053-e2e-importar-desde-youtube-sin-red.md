# 0053 — E2E: importar desde YouTube sin red (doble de yt-dlp) y prueba opcional con red
- Estado: Hecha
- Paso del pipeline: 1
- Depende de: 0045, 0050, 0051, 0052
- ADRs: 0003, 0007, 0009 §8
- Spec UX: docs/ux/03-anadir-cancion.md (criterios 4–8, 11, 13); docs/ux/04-progreso-pipeline.md (subpasos de la fuente)

## Objetivo
Probar de punta a punta el flujo de YouTube con la app compilada y el worker real de desarrollo usando el doble `SHINOBI_YTDLP_FALSO` (ADR 0009 §8), sin acceso a Internet en CI; y dejar preparada una prueba con red que solo se ejecuta a mano.

## Criterios de aceptación
- [x] Fixtures E2E en `app/e2e/fixtures/youtube/` (JSON sintéticos de 0047 + miniaturas generadas): vídeo normal (35 s, descarga simulada de ~3 s con progreso), vídeo no disponible, vídeo bloqueado una vez (la actualización es un no-op en desarrollo, 0050; el doble falla solo el primer intento y guarda ese estado en una copia temporal de las fixtures), vídeo bloqueado siempre, directo.
- [x] Recorridos:
  1. Primera vez: pestaña YouTube → aviso legal → "Usar un archivo en su lugar" (no se guarda) → YouTube otra vez → aviso → "Entendido" → `config.json` con `aviso_youtube_aceptado`; tras relanzar la app el aviso no vuelve a aparecer.
  2. URL de otro sitio → `URL_NO_VALIDA` sin lanzar el worker (comprobar que no hay entradas nuevas en `registros/worker-*.log`); URL de lista → `URL_NO_SOPORTADA`.
  3. Pegar URL válida → vista previa con miniatura, título y canal → editar título → "Descargar y continuar" → vista de progreso con "Descargar de YouTube" en curso (%, MB) → "Preparar el audio" → completado; en disco `cancion.json` (`fuente.tipo = youtube`, `pasos.fuente = completado`), `fuente/mezcla.flac`, `fuente/miniatura.jpg` y ningún `descarga.*`; la tarjeta de la Biblioteca muestra la miniatura.
  4. Vídeo no disponible → `add.error.VIDEO_NO_DISPONIBLE` en la vista previa; no se crea ninguna canción.
  5. Bloqueado una vez → texto de "actualizando el descargador" y termina bien. Bloqueado siempre → paso `error` con `prog.error.YOUTUBE_BLOQUEADO`/`add.error.YOUTUBE_BLOQUEADO` y "Reintentar".
  6. Cerrar la app durante la descarga → al relanzar, la tarjeta y la vista muestran "interrumpido" → "Reintentar" completa la descarga con la misma URL.
  7. Cancelar descarga desde la vista de progreso → paso `pendiente` sin `descarga.*` → "Continuar" en la tarjeta ("Falta descargar el audio") abre el wireframe E → "Usar otro enlace" con otro vídeo de las fixtures → la **misma** carpeta `biblioteca/<id>/` termina `completado` con la URL y la miniatura nuevas, y la Biblioteca sigue con una sola canción (`preguntas/0014` §3).
  8. Bloqueado una vez con `SHINOBI_YTDLP_ACTUALIZAR_MS` (0050): durante la espera, una segunda descarga en cola muestra `prog.cola.descarga.mantenimiento`.
- [x] Se ejecutan en el job E2E de la CI (Linux) sin red (la CI no bloquea la red, pero ninguna petición sale: comprobar que el doble está activo con un `log` del worker).
- [x] Prueba opcional con red `e2e/youtube-red.spec.ts`, omitida salvo `SHINOBI_TESTS_RED=1`, con el vídeo libre de 0047: aviso → vista previa → descarga real → `mezcla.flac`. No se ejecuta en `push`/PR; puede añadirse al workflow manual de 0040.

## Notas de implementación
- **Qué se hizo**: `app/e2e/importar-youtube.spec.ts` (9 pruebas: aviso legal y su persistencia tras relanzar; URL de otro sitio/lista sin tocar el worker; descarga completa con progreso, `mezcla.flac`, `miniatura.jpg`, sin `descarga.*` y miniatura en la tarjeta; no disponible y directo; bloqueado una vez; bloqueado siempre con Reintentar; cierre durante la descarga + Reintentar; cancelar + Continuar + "Usar otro enlace" reutilizando la misma carpeta; cola con `prog.cola.descarga.mantenimiento`), fixtures en `app/e2e/fixtures/youtube/` (JSON sintéticos y 2 miniaturas copiadas de `scripts/fixtures`) y `app/e2e/youtube-red.spec.ts` (omitida salvo `SHINOBI_TESTS_RED=1`; Big Buck Bunny, CC BY).
- **Cambios fuera del E2E**: (1) el doble del worker (`worker/shinobi_worker/youtube.py`) gana `error_descarga_una_vez` (falla solo el primer intento y lo recuerda con un marcador `<id>.intentado` en la copia temporal de las fixtures) con test en `test_descargar_youtube.py`; (2) **fallo corregido que el E2E destapó**: "Continuar"/"Reintentar" de la tarjeta con la fuente sin completar abría una vista Añadir vacía (`{tipo:'anadir'}` sin canción); ahora abre `{tipo:'cancion', id, paso:'fuente'}` (wireframe E, `Biblioteca.tsx`); (3) README de `app`.
- **Decisiones**: el aviso legal se acepta escribiendo `aviso_youtube_aceptado` en el `config.json` inicial salvo en la prueba del aviso. "Doble activo": la vista previa muestra título/canal/duración que solo pueden venir de la fixture (sin red); los registros `worker-*.log` se usan para comprobar que una URL no válida no lanza el worker (la lista de archivos no cambia). El caso 8 (cola con mantenimiento) se consigue cancelando la descarga durante `actualizando` (la actualización sigue, cola libre) y pulsando "Descargar ahora": una descarga detrás de otra en curso no muestra el motivo de mantenimiento, solo la que entra con la cola libre. Con `SHINOBI_YTDLP_ACTUALIZAR_MS` el no-op dura lo indicado.
- **Cómo probarlo** (desde `app/`, con uv): `SHINOBI_UV=/ruta/uv npm run build && SHINOBI_UV=/ruta/uv npx playwright test e2e/importar-youtube.spec.ts` (~1 min). Con red: `SHINOBI_TESTS_RED=1 npx playwright test e2e/youtube-red.spec.ts`.
- **Deuda técnica**: la prueba con red no está en el workflow manual de 0040 (solo documentada); solo verificado en macOS; las miniaturas están duplicadas respecto a `scripts/fixtures`.
