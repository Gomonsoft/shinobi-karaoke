# 0003 — ¿Se expone al usuario la elección "Calidad / Rápido" de la separación?
- De: arquitecto
- Para: disenador-ux
- Estado: Respondida
- Bloquea: no (afecta a las specs de Primer arranque, Progreso del pipeline y quizá Ajustes)

## Contexto
ADR 0004 selecciona automáticamente el modelo de separación según el hardware:
- **Calidad** (MelBand RoFormer) si hay GPU NVIDIA o Apple Silicon: ~0,5–6 min por canción.
- **Rápido** (MDX-Net) si solo hay CPU: ~3–7 min, con algo más de voz residual en el instrumental.
- Forzar **Calidad en CPU** es posible pero lento (~15–40 min) y requiere descargar ~0,9 GB más.

Técnicamente podemos: (a) no mostrar nada (automático), (b) mostrar el modo elegido de forma informativa, (c) permitir cambiarlo en ajustes globales, o (d) ofrecer "Re-separar con más calidad" por canción.

## Pregunta
¿Qué nivel de control queréis dar al usuario sobre el modo de separación, y dónde (primer arranque, ajustes, por canción)? Si se ofrece, ¿cómo comunicar el coste de tiempo y descarga?

## Opción provisional tomada (si no bloquea)
Automático e invisible (a), con el modo registrado en cada canción para poder ofrecer (c) o (d) más adelante sin cambios de datos.

## Respuesta
**Respondida por disenador-ux (2026-11-03).** Opción **(b) + (c)**; (d) queda para después del MVP.

1. **(b) Informativo, siempre visible y sin jerga**:
   - Primer arranque: al terminar el diagnóstico de hardware se muestra el modo elegido y por qué ("Tu equipo tiene una tarjeta gráfica NVIDIA: separaremos las pistas en modo Calidad" / "…no tiene una tarjeta gráfica compatible: modo Rápido. Funciona bien, aunque puede quedar algo de voz de fondo"), y en "Todo listo" el tiempo esperado para una canción de 4 min. Ver `docs/ux/01-primer-arranque.md`.
   - Vista de progreso: etiqueta "Modo Calidad / Modo Rápido" con ayuda "Shinobi Karaoke eligió este modo según tu equipo. Puedes cambiarlo en Ajustes." Ver `docs/ux/04-progreso-pipeline.md`.
   - No se pregunta nada en el primer arranque: la elección automática es la correcta para casi todos y añadir una decisión a una espera de 5–25 min solo genera dudas.
2. **(c) Ajuste global** en Ajustes → "Separación de voz": *Automático (recomendado)* / *Calidad* / *Rápido*, cada uno con su estimación de tiempo **para ese equipo** y el tamaño de descarga si el modelo no está. En equipos solo CPU, *Calidad* aparece marcada como "muy lento en tu equipo: unos 15–40 min por canción. Requiere descargar unos 900 MB" y exige confirmar un diálogo. El cambio se aplica a las próximas separaciones (incluidas las de la cola); las ya separadas no cambian. Ver `docs/ux/08-ajustes-y-acerca.md`.
3. **(d) "Re-separar con más calidad" por canción**: fuera del MVP (añade estados y decisiones en la tarjeta y el editor). Como el modo queda registrado en cada canción (`pistas.modelo.perfil`), se podrá añadir después en el menú ⋯ de la tarjeta sin cambios de datos.

**Cómo se comunica el coste**: siempre en minutos por canción en *este* equipo y en MB/GB de descarga, nunca con nombres de modelos. La calidad se explica por su efecto audible ("algo de voz de fondo" / "menos voz de fondo").

Dudas técnicas derivadas (estimaciones por perfil sin haber medido, tamaño del modelo Rápido, efecto en la cola) → `docs/preguntas/0005-viabilidad-detalles-ux-fase-0.md`.

