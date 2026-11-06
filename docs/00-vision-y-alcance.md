# Shinobi Karaoke — Visión y alcance del MVP

## Visión
Software **libre y gratuito** para convertir cualquier canción en un karaoke personalizado: obtener el audio, separar la voz del instrumental, conseguir y sincronizar la letra, darle estilo y reproducirlo a pantalla completa.

## Usuario objetivo
Personas que quieren cantar sus canciones favoritas sin depender de catálogos de karaoke de pago. No necesariamente técnicas.

## Alcance del MVP

### 1. Biblioteca (vista inicial)
- Colección de canciones del usuario, con su estado: **Borrador** o **Lista**.
- Botón **"Añadir canción"**.
- Reproducir una canción lista a **pantalla completa** para probarla.
- Abrir un borrador para seguir trabajando.

### 2. Pipeline de creación
| Paso | Qué hace |
|------|----------|
| 1. Fuente | Obtener el audio desde **archivo local** o **YouTube** (primer alcance). |
| 2. Separación | Separar **voz** e **instrumental (melodía)** en pistas distintas. |
| 3. Letra | Buscar la letra en un servicio (idealmente ya sincronizada); si no, permitir pegarla. |
| 4. Edición | Ajustar sincronización y estilo del karaoke. |
| 5. Guardado | Guardar como borrador en cualquier momento; marcar como lista para añadirla a la biblioteca. |

Detalle en [`01-pipeline.md`](01-pipeline.md).

### 3. Editor (opciones simples)
- Fondo: **color sólido** o **degradado**.
- **Color de letra** (y del resaltado de la parte cantada).
- **Fuente** de la letra.
- Herramientas para **sincronizar** la letra con el audio.

### 4. Borradores
- El estado de una canción se guarda como borrador y se puede retomar cuando se quiera, en cualquier paso del pipeline.

### 5. Reproductor
- Pantalla completa: instrumental + letra sincronizada con el estilo definido.
- **Voz guía** opcional: la voz separada suena sobre el instrumental con su propio volumen (de nada a mucha guía) y una tecla para silenciarla; el nivel se recuerda (decisión del usuario, pregunta 0030).

## Fuera de alcance (MVP)
- Cuentas de usuario, nube, sincronización entre dispositivos.
- Compartir/publicar karaokes o catálogo público.
- Puntuación de afinación, micrófono, efectos de voz.
- Fuentes distintas de archivo local y YouTube (Spotify, etc.).
- Imágenes/vídeo de fondo, animaciones avanzadas, plantillas.
- Apps móviles.

## Restricciones
- Licencia de software libre (a definir por el arquitecto — ADR).
- Sin costes para el usuario: nada de APIs de pago ni claves obligatorias.
- Uso personal: el usuario es responsable del contenido que aporta (ver riesgos legales en los ADRs de fuente y letras).
