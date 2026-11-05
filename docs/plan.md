# Plan del MVP de Shinobi Karaoke

Documento de consulta rápida: qué se hace en cada fase, qué sale de ella y en qué estado está. El detalle vive en otros documentos:
- **Tareas y estado fino**: [`backlog.md`](backlog.md) y [`tareas/`](tareas/).
- **Decisiones técnicas**: [`adr/`](adr/) y [`arquitectura.md`](arquitectura.md).
- **Vistas y textos**: [`ux/`](ux/).
- **Qué entra y qué no en el MVP**: [`00-vision-y-alcance.md`](00-vision-y-alcance.md).

Última actualización: 2026-11-05.

## Resumen

| Fase | Qué se construye | Estado |
|---|---|---|
| 0 | Fundamentos: decisiones técnicas, arquitectura, diseño de vistas | ✅ Cerrada |
| 1 | Esqueleto: app, worker, persistencia, biblioteca | ✅ Cerrada |
| 2 | Fuente: primer arranque, archivo local, YouTube | ✅ Cerrada (0040 ejecutada el 2026-11-05) |
| 3 | Separación de voz e instrumental | ⏳ Siguiente |
| 4 | Letras | Pendiente |
| 5 | Editor (sincronía y estilo) | Pendiente |
| 6 | Reproductor a pantalla completa | Pendiente |
| 7 | Empaquetado y distribución | Pendiente |

```mermaid
flowchart LR
    F0[0 Fundamentos] --> F1[1 Esqueleto] --> F2[2 Fuente] --> F3[3 Separación]
    F3 --> F4[4 Letras] --> F5[5 Editor] --> F6[6 Reproductor] --> F7[7 Empaquetado]
```

Las Fases 3 y 4 pueden avanzar en parte a la vez: la búsqueda de letra no necesita las pistas separadas.

---

## Fase 0 — Fundamentos ✅
**Objetivo**: decidir cómo se construye antes de escribir código.

- Stack: app de escritorio **Electron + React + TypeScript** y un **worker Python** para el audio, instalado con **uv** en el primer arranque (ADR 0001).
- Licencia **GPL-3.0-or-later** (ADR 0002).
- Fuente: PyAV para archivos locales y **yt-dlp + Deno** para YouTube (ADR 0003).
- Separación: **audio-separator** con MelBand RoFormer (Calidad) o MDX-Net (Rápido) (ADR 0004). Desde 2026-11-05, Calidad en todos los equipos y Rápido solo con consentimiento.
- Letras: **LRCLIB** más entrada manual, sincronía por línea en un JSON propio (ADR 0005).
- Persistencia: una carpeta por canción con `cancion.json` (ADR 0006). Herramientas de desarrollo (ADR 0007).
- Diseño: mapa de vistas, sistema visual y una spec por vista (`ux/00`–`08`).

**Decisiones del usuario**: instaladores sin firma de código; sincronía solo por línea.

## Fase 1 — Esqueleto ✅
**Objetivo**: una app que arranca, guarda y muestra canciones, sin audio todavía.

- Repositorio, CI en Windows/macOS/Linux, licencia y avisos de terceros.
- Prueba técnica (spike) de separación: tiempos y tamaños **medidos en un M1**.
- Esquemas compartidos, escritura atómica de JSON, configuración, biblioteca (escaneo, crear, borrar).
- API IPC tipada, protocolo `shinobi-media://`, cliente del worker y gestor de trabajos (colas, progreso, cancelación).
- Sistema visual, componentes, 8 fuentes OFL, ventana con navegación y **vista Biblioteca completa**.
- Revisión técnica y visual: endurecimiento de Electron (ADR 0008), `shinobi-app://`, arreglos de UX.

**Resultado**: biblioteca navegable con canciones de ejemplo (`npm run semilla`).

## Fase 2 — Fuente ✅
**Objetivo**: meter audio en la app.

- **Primer arranque**: detecta el equipo y el espacio libre, instala Python, PyTorch y el modelo con uv, permite reanudar y repara instalaciones dañadas. Pantallas B0–B6b (ADR 0009).
- **Importar archivo local**: arrastrar o elegir, normalizar a `mezcla.flac`, igualar volumen, leer metadatos.
- **Importar desde YouTube**: aviso legal único, vista previa con miniatura, descarga en cola, actualización automática de yt-dlp.
- Información para soporte, E2E sin red de todo lo anterior y workflow manual con instalación real.

**Decisiones del usuario**: modelo Rápido de forma provisional, pidiendo aclaración de licencia a UVR (pregunta 0012); **Mac Intel fuera del MVP**; Apple Silicon requiere **macOS 14** (preguntas 0015–0017).

**Hecho después del cierre**: primera ejecución de `runtime-real.yml` (tarea 0040, 2026-11-05) en verde en los 3 SO; datos y decisiones en la pregunta 0018.

**Pendiente**: abrir el issue a UVR (pregunta 0012).

## Fase 3 — Separación de pistas ⏳
**Objetivo**: obtener `voz.flac` e `instrumental.flac` de cada canción.

- **Antes de empezar**: tareas 0055 (manifiesto: 4 GB en CPU, `bytes_disco` medidos, progreso de componentes) y 0056 (Calidad por defecto, sin elección de modo). **Al inicio**: 0057 (alternativa a Rápido con consentimiento, reutilizada por la separación y los Ajustes). **En paralelo**: 0058 (bytes de red y pico de disco en `runtime-real`).
- Comando del worker `separar` sobre audio-separator, sin ffmpeg y forzando CPU en Apple Silicon (preguntas 0009 y 0010).
- Trabajo en la cola pesada con progreso interpolado, tiempo restante, cancelación y reintentos automáticos.
- Estimación previa ("Tardará unos N minutos"), "Re-separar pistas" y "Cancelar trabajo".
- Vista de progreso completa para el paso de separación y panel de actividad.
- **Modelo Calidad en todos los equipos**, también solo CPU. El modelo Rápido solo se usa si el usuario lo acepta bajo su responsabilidad tras un fallo de Calidad (en el primer arranque, por memoria insuficiente o por modelo no disponible); nunca de forma automática ni como elección libre.
- **Ajustes**: sin elección de modo. Informa del modelo en uso y, si es Rápido, ofrece **Volver a Calidad**. Incluye Acerca de (`ux/08`, cambios pendientes en la pregunta 0019 para el diseñador UX).

**Decidido (pregunta 0018, usuario, 2026-11-05)**: modelo Calidad por defecto en todos los perfiles; Rápido solo como alternativa con consentimiento tras un fallo de Calidad (no elegible en Ajustes); 4 GB de espacio mínimo en CPU. Ya no queda pendiente la decisión del modelo según el modo.

## Fase 4 — Letras
**Objetivo**: tener la letra de la canción, con tiempos si es posible.

- Búsqueda en **LRCLIB** por título, artista y duración, mostrando los resultados (`ux/05`).
- Pegar la letra a mano o importar `.lrc` / `.txt`.
- Conversores LRC, LRC mejorado y Lyricsfile al formato interno, con normalización (ADR 0005).
- Edición del texto conservando la sincronía de las líneas que no cambian.

## Fase 5 — Editor
**Objetivo**: ajustar la sincronía y el aspecto del karaoke (`ux/06`).

- Sincronía **"al ritmo"** por línea: Intro marca el inicio y mantenerlo marca el final. Deshacer, ajuste fino, desplazamiento global y velocidad 0,5× / 0,75× / 1×.
- Escucha de la mezcla, la voz o el instrumental.
- **Estilo**: fondo sólido o degradado, color de letra, color de resaltado y fuente, con vista previa y aviso de contraste.
- Guardado automático como borrador y **"Marcar como lista"**, que explica lo que falta.

## Fase 6 — Reproductor
**Objetivo**: cantar (`ux/07`).

- Pantalla completa desde la Biblioteca con un clic.
- Instrumental y letra sincronizada: línea actual y siguiente, cuenta atrás antes de cada entrada.
- Controles que se ocultan solos, atajos de teclado y volumen recordado.
- Legible a unos 5 m en un televisor de 55".

## Fase 7 — Empaquetado y distribución
**Objetivo**: que un usuario no técnico pueda instalarla.

- **electron-builder** con *fuses* de seguridad (ADR 0008): NSIS (Windows), **DMG arm64** (macOS) y AppImage/.deb (Linux).
- Worker, requisitos y manifiesto empaquetados en `resources/`.
- Sección "Descargar" en el README, apuntando a las Releases, y guía `INSTALAR.md` para superar los avisos de una app sin firma.
- Modelo Rápido: **se puede publicar** porque no se descarga sin el consentimiento explícito del usuario, que acepta el aviso de licencia no declarada (pregunta 0018; sustituye a la condición anterior de la pregunta 0012). Si UVR responde con una licencia incompatible, se retira la oferta. El issue a UVR sigue siendo recomendable.
- Mediciones pendientes antes de publicar: bytes de descarga reales y pico de disco (tarea 0058), separación con Calidad en Windows y Linux CPU, NVIDIA y otros chips Apple.

---

## Cómo se trabaja en cada fase
1. El **arquitecto** divide la fase en tareas y decide la tecnología (ADR).
2. El **diseñador UX** completa o ajusta las specs de las vistas afectadas.
3. Los **programadores** implementan las tareas, en paralelo cuando no dependen unas de otras.
4. Las dudas van a [`preguntas/`](preguntas/). Las de producto las decides tú.
5. Al cerrar la fase hay un informe (`informe-fase-N.md`), un commit y la fusión a `main` tras tu revisión.
