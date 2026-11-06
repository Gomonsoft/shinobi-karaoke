# Plan del MVP de Shinobi Karaoke

Documento de consulta rápida: qué se hace en cada fase, qué sale de ella y en qué estado está. El detalle vive en otros documentos:
- **Tareas y estado fino**: [`backlog.md`](backlog.md) y [`tareas/`](tareas/).
- **Decisiones técnicas**: [`adr/`](adr/) y [`arquitectura.md`](arquitectura.md).
- **Vistas y textos**: [`ux/`](ux/).
- **Qué entra y qué no en el MVP**: [`00-vision-y-alcance.md`](00-vision-y-alcance.md).

Última actualización: 2026-11-06 (desglose de la Fase 6).

## Resumen

| Fase | Qué se construye | Estado |
|---|---|---|
| 0 | Fundamentos: decisiones técnicas, arquitectura, diseño de vistas | ✅ Cerrada |
| 1 | Esqueleto: app, worker, persistencia, biblioteca | ✅ Cerrada |
| 2 | Fuente: primer arranque, archivo local, YouTube | ✅ Cerrada (0040 ejecutada el 2026-11-05) |
| 3 | Separación de voz e instrumental | ✅ Cerrada (0058 y 0062 esperan `runtime-real` en GitHub) |
| 4 | Letras | ✅ Cerrada (0077–0089) |
| 5 | Editor (sincronía y estilo) | ✅ Cerrada (0090–0110; 0111 manual pendiente) |
| 6 | Reproductor a pantalla completa | ⏳ Desglosada (0112–0126) |
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

## Fase 3 — Separación de pistas ✅ (cerrada el 2026-11-05: tareas 0055–0076, [informe](informe-fase-3.md))
**Objetivo**: obtener `voz.flac` e `instrumental.flac` de cada canción.

- **Antes de empezar**: 0055 (manifiesto: 4 GB en CPU, `bytes_disco` medidos, progreso de componentes) y 0056 (Calidad por defecto, sin elección de modo; en curso). **Al inicio**: 0057 (alternativa a Rápido con consentimiento) y 0059 (contratos compartidos), en paralelo. **En paralelo durante toda la fase**: 0058 (bytes de red y pico de disco en `runtime-real`) y 0073 (diálogo de cierre).
- **Worker** (0060–0062): comando `separar` sobre una interfaz `Separador`, separador falso para las pruebas y adaptador de audio-separator sin ffmpeg (parche + `use_soundfile`), CPU forzada en Apple Silicon, stems renombrados a `voz.flac`/`instrumental.flac` y progreso por `tqdm`. Test "sin ffmpeg en el PATH" en la CI de los 3 SO y prueba `pesado` con el modelo real en `runtime-real`.
- **Main** (0063–0067):
  - reintentos automáticos según `reintentable` y progreso interpolado con el factor;
  - servicio de separación en la cola pesada: se encola al completar la fuente, salida en `pistas.tmp/`, factor medido, limpieza al cancelar;
  - reintentos por memoria (bloques más pequeños y, con NVIDIA, procesador), descarga del modelo que falta dentro del trabajo y oferta de Rápido tras `MEMORIA_INSUFICIENTE`/`MODELO_NO_DISPONIBLE`;
  - estimación previa "Tardará unos N minutos".
- **Interfaz** (0068–0074):
  - vista de progreso de la separación (cola, fases, tiempo restante, cancelar, pendiente, errores, oferta de Rápido; terminado con escucha de las pistas);
  - en la Biblioteca, "Reintentar" que relanza, "Cancelar trabajo" y "Re-separar pistas";
  - panel de actividad, toasts y notificaciones del sistema, diálogo de cierre;
  - Ajustes informativos con "Volver a Calidad".
- **E2E** (0075–0076) con un separador falso, sin PyTorch, modelos ni red. La CI normal nunca descarga los modelos reales.
- **Modelo Calidad en todos los equipos**, también solo CPU. El modelo Rápido solo se usa si el usuario lo acepta bajo su responsabilidad tras un fallo de Calidad (en el primer arranque, por memoria insuficiente o por modelo no disponible); nunca de forma automática ni como elección libre.
- **Ajustes**: sin elección de modelo. Informan del modelo en uso y, si es Rápido, ofrecen **Volver a Calidad**. Incluyen Acerca de.

**Decidido (pregunta 0018, usuario, 2026-11-05)**: modelo Calidad por defecto en todos los perfiles; Rápido solo como alternativa con consentimiento tras un fallo de Calidad (no elegible en Ajustes); 4 GB de espacio mínimo en CPU.

**Decidido (preguntas 0019–0021, 2026-11-05)**:
- textos definitivos de la oferta de Rápido, de los reintentos y de Ajustes (diseñador UX);
- re-separar con Calidad las canciones separadas con Rápido queda fuera del MVP;
- detalles técnicos de "Rápido pendiente", de "Volver a Calidad" fuera de Ajustes, del origen de la estimación y de la descripción del equipo (arquitecto; ADR 0004, Revisión 2026-11-05 bis).

**Sin preguntas abiertas en la fase.**

## Fase 4 — Letras ✅ (tareas 0077–0089, cerrada el 2026-11-05)
**Objetivo**: tener la letra de la canción, con tiempos si es posible.

- **Contratos** (0077): API `letras.*` (buscar, guardar, editar texto, leer archivo), candidatos, el código `ARCHIVO_SIN_LETRA`, la regla del paso Letra (completado con ≥ 1 línea) y una API falsa para la interfaz.
- **Dominio** (0078–0080):
  - conversores puros de texto plano, LRC y LRC mejorado, con la normalización del ADR 0005;
  - diff LCS para editar el texto sin perder la sincronía de lo que no cambia;
  - Lyricsfile (YAML de LRCLIB, con palabras), solo en el proceso principal.
- **Main** (0081–0083):
  - cliente de LRCLIB **sin clave**: `get` + `search` en serie, 10 s como máximo, respeta los límites (429), `User-Agent` genérico del proyecto sin datos personales;
  - búsqueda con candidatos ordenados (palabra > línea > texto y por duración);
  - guardado de la letra en `cancion.json`;
  - importación de `.lrc`/`.txt` con detección de codificación.
- **Interfaz** (0084–0087):
  - vista Letra con resultados, vista previa y banners; pegar e importar con confirmación de sustituir; letra elegida editable con autoguardado;
  - integración con el stepper, la vista de progreso ("Buscar la letra mientras tanto"), "Continuar" y la Biblioteca.
- **E2E** (0088) sin red, con un servidor HTTP local que hace de LRCLIB (solo sin empaquetar), y una prueba opcional con LRCLIB real (0089).
- **Legal**: LRCLIB sigue sin declarar licencia de las letras. Uso personal, nada se redistribuye, atribución "Letra: LRCLIB" y letras inventadas en las pruebas (ADR 0005, Revisión 2026-11-05).

**Pregunta abierta**: [0022](preguntas/0022-huecos-ux-de-la-vista-letra-fase-4.md) (diseñador UX; no bloquea).

**Resultado**: la letra se busca sola en LRCLIB al llegar al paso Letra (palabra > línea > texto), se puede pegar o importar (`.lrc`/`.txt`), y se edita con autoguardado sin perder la sincronía de lo que no cambia. E2E sin red con un doble de LRCLIB y prueba opcional con LRCLIB real. Detalle en [`informe-fase-4.md`](informe-fase-4.md).

**Resuelto al empezar la Fase 5**: pregunta 0024 (✓ de Letra en el stepper, tarea 0101) y el texto de 512 KB (`ux/05` §10, tarea 0102).

## Fase 5 — Editor ✅ (cerrada el 2026-11-06: tareas 0090–0110, [ADR 0010](adr/0010-editor-motor-de-audio-reloj-y-guardado.md))
**Objetivo**: ajustar la sincronía y el aspecto del karaoke (`ux/06`, reescrita para la fase).

- Sincronía **"al ritmo"** por línea:
  - Intro marca el inicio y mantenerla marca el final;
  - Retroceso deshace;
  - cuenta atrás de 3 s;
  - una marca que adelanta a las líneas siguientes borra sus tiempos.
  Además, ajuste fino de ±10/±100 ms con campos editables, desplazamiento global de ±30 s, deshacer/rehacer y velocidad 0,5× / 0,75× / 1× (el tono baja).
- Escucha de la mezcla, la voz o el instrumental, con Web Audio y un reloj preciso (≤ 20 ms con cable o altavoces).
- **Estilo**: fondo sólido o degradado, color de letra, color de resaltado y fuente, con vista previa (el mismo render que usará el reproductor) y aviso de contraste.
- Autoguardado (1 s), sin perder nada al salir ni al cerrar la ventana. **"Marcar como lista"** explica lo que falta. Al volver, la Biblioteca resalta la tarjeta 2 s.
- Va con la fase: ✓ de Letra en el stepper (0024) y el texto "demasiado largo" de la vista Letra.
- **A la Fase 6**: "Probar a pantalla completa" y [▶ Reproducir] en el toast de "lista".

**Preguntas**: 0024, 0025 y [0026](preguntas/0026-textos-pendientes-del-editor-fase-5.md) respondidas; ninguna abierta.

**Orden**: 0090 y 10 tareas independientes en paralelo → 0091, 0093, 0098, 0103 y 0104 → 0105 (vista) → 0106 → 0107, en paralelo con 0108 y 0109 → E2E 0110 y prueba manual 0111. Detalle en [`backlog.md`](backlog.md).

**Resultado**: editor completo con sincronía al ritmo, ajuste fino, estilo con contraste, autoguardado y marcar como lista. Detalle en [`informe-fase-5.md`](informe-fase-5.md). Pendiente: prueba manual 0111. Pregunta 0029 respondida al empezar la Fase 6.

## Fase 6 — Reproductor (desglosada el 2026-11-06: tareas 0112–0126, [ADR 0011](adr/0011-reproductor-pantalla-completa-y-reutilizacion-del-motor.md))
**Objetivo**: cantar (`ux/07`, puesta al día para la fase).

- Desde la Biblioteca (tarjeta, menú ⋯ o el toast «lista para cantar»), un clic abre el reproductor **encima** de la Biblioteca: la ventana pasa a pantalla completa y al salir vuelve a como estaba. Esc sale con una pulsación.
- **Instrumental con voz guía**: la voz separada suena a un volumen propio, se silencia con una tecla y el nivel se recuerda (decisión del usuario, pregunta 0030).
- Letra sincronizada: línea actual y siguiente, `●●●` antes de cada entrada. Si la letra empieza enseguida, hay unos segundos de silencio con el título para prepararse.
- Controles que se ocultan solos, atajos de teclado, volumen compartido con el editor, pantalla final con vuelta automática y pantalla que no se apaga mientras suena.
- Si faltan las pistas, se avisa y la canción pasa a Dañada al momento.
- **Desde el editor**: "Probar a pantalla completa" (o F) sin perder nada del editor. El desplazamiento que se ajusta allí se deshace de una vez.
- Legible a unos 5 m en un televisor de 55" (sin tope de tamaño de letra).
- Deuda: un motor de audio incompleto ya no dice "Algo salió mal": ofrece "Reparar el motor de audio".

**Preguntas**: 0029 y 0031 respondidas (arquitecto); 0030 decidida por el usuario (voz guía); [0032](preguntas/0032-textos-de-motor-de-audio-incompleto.md) respondida (diseñador UX). Sin preguntas abiertas.

**Orden**: 0112, 0115, 0116, 0117 y 0124 a la vez → 0113 ‖ 0114 ‖ 0118 → 0119 (núcleo) → 0120 ‖ 0121 ‖ 0122 → E2E 0123 y prueba manual 0126 (0125 en cualquier hueco tras 0124). Detalle en [`backlog.md`](backlog.md).

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
