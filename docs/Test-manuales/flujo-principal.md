# Guía manual · Flujo principal

- Versión: todas · Se repite al cerrar cada fase
- Specs: [Primer arranque](../ux/01-primer-arranque.md) · [Biblioteca](../ux/02-biblioteca.md) · [Añadir canción](../ux/03-anadir-cancion.md) · [Progreso](../ux/04-progreso-pipeline.md) · [Letra](../ux/05-letra.md) · [Editor](../ux/06-editor.md) · [Reproductor](../ux/07-reproductor.md)
- Duración estimada: 15–20 min
- Requisitos: la app con el motor de separación instalado y un archivo de audio propio de 1–3 min (MP3, FLAC o WAV). Para probar la búsqueda de letra hace falta conexión.

Es el mismo recorrido que cubren automáticamente los tests críticos (`npm run test:e2e:criticos`), pero con el motor real, audio real y mirando la pantalla.

## Casos

### 1. Inicio

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 1.1 | Abre la app | Arranca sin errores y muestra la Biblioteca (o el primer arranque si es una instalación nueva) | ☐ |
| 1.2 | Si aparece el primer arranque, complétalo | Termina en la Biblioteca | ☐ |

### 2. Biblioteca

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 2.1 | Mira la Biblioteca | Las canciones existentes se ven con portada, título, artista y estado; la búsqueda filtra | ☐ |

### 3. Añadir canción

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 3.1 | «Añadir canción» → elige tu archivo → rellena título y artista → confirma | Empieza el progreso de la separación | ☐ |
| 3.2 | Espera a que termine | Se ofrecen Voz e Instrumental; se escuchan bien | ☐ |

### 4. Letra

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 4.1 | Busca la letra o pégala | El texto aparece por líneas y se puede corregir | ☐ |
| 4.2 | Continúa al editor | Abre el Editor con la letra | ☐ |

### 5. Editor

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 5.1 | Reproduce y marca el inicio y el fin de varias líneas | Los tiempos se guardan y la vista previa resalta en sincronía | ☐ |
| 5.2 | Cambia el estilo o el tema | La vista previa refleja el cambio | ☐ |
| 5.3 | Sal y vuelve a entrar | Los cambios siguen ahí | ☐ |
| 5.4 | «Marcar como lista» | La canción aparece como Lista en la Biblioteca | ☐ |

### 6. Reproductor

| # | Paso | Resultado esperado | OK |
|---|---|---|---|
| 6.1 | Reproduce la canción desde la Biblioteca | Pantalla completa, el instrumental suena y la letra se resalta a tiempo | ☐ |
| 6.2 | Pausa, busca, sube y baja el volumen y la voz guía | Responde sin cortes | ☐ |
| 6.3 | Deja que termine o sal con Esc | Vuelve a la Biblioteca | ☐ |

## Ejecuciones

| Fecha | Persona | Equipo y SO | Pantallas / audio | Resultado | Notas |
|---|---|---|---|---|---|
| | | | | ✅ / ⚠️ / ❌ | |

## Incidencias

| Caso | Qué pasó | Gravedad | Tarea o pregunta creada |
|---|---|---|---|
