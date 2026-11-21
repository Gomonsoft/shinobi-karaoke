# 006 — Exportar varias canciones a video de una vez

- Estado: Idea
- Origen: diseño de la fase 6 de 0.2.0 (spec [10 · Exportar a video](../ux/10-exportacion.md))
- Fecha: 2026-11-20
- Relacionadas: feature 7 (exportar a video), selección múltiple de la Biblioteca (fase 3), [pregunta 0131](../preguntas/0131-contratos-tecnicos-de-la-exportacion.md)

## Problema
En 0.2.0 cada video se exporta desde su canción, una a una. Quien prepara un evento o quiere llevarse un repertorio entero en un USB tiene que abrir el diálogo, elegir opciones y destino para cada canción.

## Propuesta
Desde la selección múltiple de la Biblioteca, «Exportar video…» con las mismas opciones para todas y una carpeta de destino; cada canción entra en la cola de exportación con su nombre propuesto, y al final se muestra un resultado por canción (como «Aplicar tema…»).

## Valor y coste
- Valor: ahorra tiempo a quien exporta repertorios; aprovecha la cola de exportación que ya existe.
- Coste estimado: M. Toca la barra de selección (02), el diálogo de exportación (variante de carpeta en lugar de archivo), la cola y el resumen de resultados.
- Riesgos o dudas abiertas: tiempo total y espacio en disco de muchas canciones en 4K; nombres repetidos en la carpeta; qué hacer si falla una a mitad del lote.

## Decisión
