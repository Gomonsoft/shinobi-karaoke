# Revisión visual — Fase 3 de 0.2.0 (temas y biblioteca)

- Specs de referencia: [06-editor.md, fase 3](../06-editor.md#fase-3-de-020--temas-y-biblioteca) (criterio T29), [02-biblioteca.md, fase 3](../02-biblioteca.md#fase-3-de-020--temas-y-biblioteca) (criterio B16), [08-ajustes-y-acerca.md, fase 3](../08-ajustes-y-acerca.md#fase-3-de-020--temas-y-biblioteca) (criterio A12) y [sistema-visual.md](../sistema-visual.md#020--temas-y-biblioteca-agrupada-fase-3).
- Estado: **pendiente**. Las capturas las toma el programador al cerrar la fase, con el mismo procedimiento que [revision-fase-2.1](../revision-fase-2.1/README.md) (Electron, `--force-device-scale-factor`, `setContentSize`, área de contenido sin marco, sin tooltips salvo que el estado lo pida).

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
