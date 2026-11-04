# 0012 — Protocolo `shinobi-media://` para audio y miniaturas
- Estado: Pendiente
- Paso del pipeline: 0 (lo usarán editor y reproductor)
- Depende de: 0009
- ADRs: 0001, 0006
- Spec UX: —

## Objetivo
Servir al renderer los archivos de una canción (audio y miniatura) sin habilitar `file://`.

## Criterios de aceptación
- [ ] Esquema `shinobi-media` registrado como privilegiado (`standard`, `secure`, `supportFetchAPI`, `stream`) antes de `app.ready`, y manejado con `protocol.handle`.
- [ ] URL `shinobi-media://<id>/<ruta-relativa>`; solo sirve archivos dentro de `biblioteca/<id>/` y solo rutas de una lista blanca (`fuente/mezcla.flac`, `fuente/miniatura.jpg`, `pistas/voz.flac`, `pistas/instrumental.flac`). Cualquier intento de salir de la carpeta (`..`, rutas absolutas, enlaces simbólicos, id inexistente) → 404.
- [ ] Soporta peticiones `Range` (206 con `Content-Range`) y `Content-Type` correcto (`audio/flac`, `image/jpeg`).
- [ ] Tests: rango parcial, archivo completo, traversal rechazado, id inexistente.
- [ ] Prueba E2E: el renderer puede hacer `fetch('shinobi-media://<id>/pistas/instrumental.flac')` de una canción de la semilla y recibe audio.

## Notas de implementación
(las rellena el programador al terminar)
