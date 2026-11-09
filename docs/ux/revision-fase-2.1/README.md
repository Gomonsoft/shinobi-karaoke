# Revisión visual — Subfase 2.1 (tarea 0162)

- Specs de referencia: [06-editor.md, subfase 2.1](../06-editor.md#subfase-21--layout-adaptable-y-paneles) (criterio 25) y [sistema-visual.md](../sistema-visual.md)
- Informe: [informe-fase-2.1.md](../../versiones/0.2.0/informe-fase-2.1.md)
- Canción: «Editor: lista incompleta» de la semilla (8 líneas, separación completada). La forma de onda se tomó con picos (`worker/.venv` presente).

## Cómo se obtuvieron
Desde `app/`, con la app compilada (`npm run build`) y el entorno del worker disponible:

```powershell
$env:SHINOBI_CAPTURAS_2_1 = '1'
npx playwright test e2e/editor-layout.spec.ts --workers=1 -g "capturas de revisión"
```

El caso está en `app/e2e/editor-layout.spec.ts` y se omite sin esa variable (no escribe en CI). Cada caso lanza Electron con `--force-device-scale-factor` (1 o 1,25), ajusta el contenido con `setContentSize`, comprueba `devicePixelRatio`, `innerWidth` e `innerHeight` y toma `page.screenshot()` del área de contenido (sin el marco del sistema). El nombre usa el tamaño **físico**: `editor-{ancho}x{alto}-{escala}-{estado}.png`.

Nota: a 125 % Windows entrega hasta 4 px de contenido de más (p. ej. 1285 × 723 en lugar de 1280 × 720). Los E2E aceptan esa holgura y las capturas conservan el tamaño real.

## Capturas

Seis viewports × `defecto` (Sincronía, con picos) y `estilo`:

| Archivo | Qué muestra |
|---------|-------------|
| `editor-1280x720-100-defecto.png` / `-estilo.png` | 1280 × 720 CSS al 100 % |
| `editor-1280x720-125-defecto.png` / `-estilo.png` | 1280 × 720 físicos al 125 % (≈ 1024 × 576 CSS) |
| `editor-1720x1440-100-defecto.png` / `-estilo.png` | 1720 × 1440 CSS al 100 % |
| `editor-1720x1440-125-defecto.png` / `-estilo.png` | 1720 × 1440 físicos al 125 % (≈ 1376 × 1152 CSS) |
| `editor-1920x1080-100-defecto.png` / `-estilo.png` | 1920 × 1080 CSS al 100 % |
| `editor-1920x1080-125-defecto.png` / `-estilo.png` | 1920 × 1080 físicos al 125 % (≈ 1536 × 864 CSS) |

Solo a 1280 × 720 al 100 % y al 125 % (prefijos `editor-1280x720-100-` y `editor-1280x720-125-`):

| Estado | Qué muestra |
|--------|-------------|
| `lista-min` | Lista de líneas minimizada al riel de 72 px (número, total, tiempo, ↑ ↓ e I); la previa ocupa el ancho liberado |
| `panel-min` | Panel minimizado al riel de 120 px (Inicio, Fin, «Fijar fin» y «Bloquear enunciado») |
| `timeline-min` | Línea de tiempo minimizada a la fila de 44 px (40 en compacto) con el minimapa informativo |
| `todo-min` | Los tres modos minimizados a la vez |
| `sync` | Modo sincronizar: banner con la cuenta atrás y la fila minimizada, sin scroll de página |
| `foco-divisor` | Foco de teclado en el divisor del panel (franja con anillo de foco) |
| `panel-300` | Panel a su mínimo de 300 px con la fila del desplazamiento de toda la letra en una sola línea |
| `bajo-minimo` | Zoom 150 %: disposición B por debajo del mínimo de diseño, solo con scroll vertical (el contenido mide 853 × 480 CSS) |

## Observaciones de la revisión
- Con el panel en 300 px y la ventana de 1024 × 576 CSS (`editor-1280x720-125-panel-300.png`) la zona superior queda en su mínimo de 136 px: el lienzo 16:9 es pequeño y su texto se recorta por abajo dentro del propio lienzo (la línea «Abre los ojos» no cabe). No hay recorte de la interfaz, pero conviene que UX confirme si el lienzo mínimo debe reducir el texto. Ver el informe.
- Las capturas se toman sin el *tooltip* del botón enfocado (se quita el foco antes de capturar, salvo en `foco-divisor`).
