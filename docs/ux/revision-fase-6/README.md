# Capturas de revisión de la fase 6 (exportación de video)

Para el diseñador UX: criterio V29 de [10-exportacion](../10-exportacion.md). Tarea
[0241](../../tareas/0241-pruebas-de-integracion-capturas-e-informe-de-la-fase-6.md).

## Cómo se generan

```
cd app
npm run build
SHINOBI_CAPTURAS_6=1 npx playwright test e2e/exportacion-capturas.spec.ts --workers=1
```

La spec es opt-in (sin la variable se omite) y no corre en el CI. Usa la app real con el worker PyAV:
el progreso y el éxito son de una exportación de verdad (5 s de audio a 1920 × 1080, 30 FPS, MKV), no
de una maqueta. Carpeta de salida y datos temporales; no toca el equipo del usuario.

Nombre: `exportacion-{ancho}x{alto}-{escala}-{estado}.png`, a 1280 × 800 al 100 % y a 1280 × 720 al
125 % (ventana de 1024 × 576 CSS).

## Estados tomados (10 por formato)

| Estado | Qué muestra |
| --- | --- |
| `formulario` | Diálogo inicial con los valores por defecto (MKV, 16:9, 1080p, 30 FPS). |
| `formulario-4x3` | Proporción 4:3 elegida. |
| `formulario-webm` | Formato WebM (VP9 + Opus) elegido: pista, formato corto de la muestra. |
| `ayuda-formato` | Popover ⓘ «Qué formato elegir» abierto. |
| `archivo-existe` | Destino con un archivo previo: aviso de sustitución. |
| `nota-sesion` | Sesión abierta en otra pantalla: nota de recursos (sin bloqueo). |
| `exportando` | Seguimiento con el subpaso «Crear el video». |
| `confirmar-cancelar` | «¿Cancelar la exportación?». |
| `tarjeta-exportando` | Biblioteca con el diálogo cerrado y la tarjeta con «Exportando video N %». |
| `exito` | «Video exportado» con archivo, medidas, duración y carpeta. |

## Estados de V29 sin captura (y por qué)

- `en-cola`, `fallo`, `perfil-no-soportado`, `sin-perfiles`: necesitan un equipo o un doble del
  servicio que no existen en la app empaquetable (perfil no soportado, error forzado, dos
  exportaciones simultáneas). Están cubiertos por los tests de componente con la API falsa; si el
  diseñador los quiere en imagen, hay que añadir un doble en desarrollo.
- `bloqueo-sesion` no existe: V23 se retiró; exportar y la sesión conviven (queda `nota-sesion`).

## Observaciones al tomarlas (corregidas)

Las tres se corrigieron después de la primera tanda y las capturas están regeneradas:

- **Popover de ayuda recortado**: ahora se despliega en línea bajo la etiqueta «Formato» (ocupa el ancho
  de la columna) y se trae a la vista al abrirlo. A 1024 × 576 es más alto que la zona visible y se
  recorre con el scroll del cuerpo, sin recortes laterales.
- **Doble barra de scroll**: el diálogo tiene una sola zona con scroll (el cuerpo); la barra no se
  repite junto a la columna de la muestra.
- **Avisos bajo el pliegue**: «ya existe y se sustituirá», los errores y las notas (sesión, etc.) van
  pegados al borde inferior de la zona con scroll, encima de los botones, y se ven sin desplazarse
  (`nota-sesion` y `archivo-existe`). Con avisos largos a 1024 × 576 queda poco espacio para el resto
  de campos, que se recorren con el scroll.
- 1280 × 720 al 125 % equivale a una ventana de 1024 × 576 CSS, el mínimo de la app: no hace falta
  una captura aparte.
