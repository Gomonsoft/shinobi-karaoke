# Revisión visual — Fase 3 de 0.2.0 (temas y biblioteca)

- Specs de referencia: [06-editor.md, fase 3](../06-editor.md#fase-3-de-020--temas-y-biblioteca) (criterio T29), [02-biblioteca.md, fase 3](../02-biblioteca.md#fase-3-de-020--temas-y-biblioteca) (criterio B16), [08-ajustes-y-acerca.md, fase 3](../08-ajustes-y-acerca.md#fase-3-de-020--temas-y-biblioteca) (criterio A12) y [sistema-visual.md](../sistema-visual.md#020--temas-y-biblioteca-agrupada-fase-3).
- Estado: **tomadas** (tarea 0176, 2026-11-09). 50 capturas (editor 11 × 2, Biblioteca 9 × 2, Ajustes 10 × 1) con `SHINOBI_CAPTURAS_3=1 npx playwright test e2e/temas-capturas.spec.ts --workers=1` desde `app/` (Electron, `--force-device-scale-factor`, `setContentSize`, área de contenido sin marco). Equipo: Windows 11 Pro (compilación 26200), monitor de 3440 × 1440 a escala del sistema 100 %; el 125 % se simula con `--force-device-scale-factor=1.25`. Semilla: `sembrar(datos, { temas: true })` (0168), con los ajustes que cada estado indica abajo. Informe: [informe-fase-3.md](../../versiones/0.2.0/informe-fase-3.md).

## Datos de prueba
Semilla con al menos: 3 temas («Neón», «Noche ninja» predeterminado, «Sol»); «Queen» con tema de artista y un álbum «A Night at the Opera» con tema de álbum; dos álbumes «Greatest Hits» (ABBA y Queen); canciones sin artista y sin álbum; una canción personalizada de 0.1.0; una canción con referencia a un tema inexistente; una canción de YouTube con miniatura; una canción con procedencia «Tema predeterminado anterior» (se obtiene quitando y volviendo a poner el predeterminado).

## Capturas esperadas
Nombre: `{vista}-{ancho}x{alto}-{escala}-{estado}.png` (tamaño físico).

| Vista | Tamaños | Estados |
|---|---|---|
| `editor` | 1280 × 720 al 100 % y al 125 % | `tema-definidos`, `tema-asignado`, `tema-personalizado`, `tema-editando`, `tema-no-disponible`, `tema-catalogo-vacio`, `dialogo-guardar-impacto`, `dialogo-guardar-obsoleto`, `dialogo-nuevo-nombre`, `dialogo-eliminar`, `dialogo-salir-borrador` |
| `biblioteca` | 1280 × 800 al 100 % y 1280 × 720 al 125 % | `artista`, `album`, `sin-metadatos`, `busqueda-album`, `seleccion`, `dialogo-aplicar-tema`, `resultado-lote`, `dialogo-tema-grupo`, `foco-tras-mover` |
| `ajustes` | 1280 × 800 al 100 % | `temas`, `temas-sin-predeterminado`, `temas-vacio`, `temas-apartado`, `temas-solo-lectura`, `temas-borrado-pendiente`, `dialogo-predeterminado`, `dialogo-quitar-predeterminado`, `dialogo-eliminar-predeterminado`, `temas-faltan` |

## Observaciones de la revisión
(Se completan al revisar las capturas.)

Revisadas a ojo (tarea 0176): `editor-1280x720-125-dialogo-salir-borrador`, `editor-1280x720-100-tema-editando`, `biblioteca-1280x800-100-seleccion`, `biblioteca-1280x720-125-resultado-lote`, `ajustes-1280x800-100-dialogo-quitar-predeterminado` y `ajustes-1280x800-100-temas-borrado-pendiente`.

- **Corregido antes de tomarlas:** los tres botones del diálogo de salida con borrador no cabían en una fila y «Seguir editando» quedaba cortado; ahora pasan a dos filas (`flex-wrap` en `.acciones`). El pie de D3 con el panel a 300 px se apila en una columna.
- `editor-…-dialogo-salir-borrador` muestra «Lo usan 3 canciones» porque la captura `dialogo-guardar-obsoleto` hizo que otra canción heredase «Sol» antes (la secuencia comparte la sesión).
- `biblioteca-1280x720-125-*` muestra una barra de scroll horizontal de 11 px (viewport CSS de 1024 px con scroll vertical, por `body { min-width: 1024px }` de 0.1.0). Pregunta [0057](../../preguntas/0057-ancho-minimo-del-cuerpo-y-scroll-horizontal-a-1024-px.md).
- `ajustes-…-temas-solo-lectura` y `temas-apartado` no muestran lista porque el catálogo no se lee; solo se ve el aviso y los estados vacíos.
- `biblioteca-…-resultado-lote` incluye un fallo de escritura inyectado para mostrar «Revisar y reintentar».
