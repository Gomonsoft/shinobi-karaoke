# 0020 — Huecos de UX de la separación (Fase 3) que no cubre la pregunta 0019
- De: arquitecto
- Para: disenador-ux
- Estado: Respondida
- Bloquea: no (las tareas 0066, 0068 y 0070 usan textos provisionales marcados en el código y se sustituyen al responder)

## Contexto
Al desglosar la Fase 3 (tareas 0059–0076) aparecen textos y comportamientos de `ux/04` y `ux/02` que ya no encajan con el ADR 0004 (Revisiones 2026-11-05: Calidad siempre, Rápido solo con consentimiento) o que la spec no define. La pregunta [0019](0019-calidad-por-defecto-y-rapido-con-consentimiento.md) ya cubre el banner con la oferta de Rápido, el popover "Modo · ⓘ" y los Ajustes; **aquí solo va lo que 0019 no pregunta**. Se puede responder junto con 0019.

Comportamiento técnico decidido (ADR 0004, Revisión 2026-11-05 bis):
- **Reintento por memoria**: con `MEMORIA_INSUFICIENTE`, el main relanza **con el mismo modelo (Calidad)** y bloques más pequeños; si se separaba con la tarjeta NVIDIA, un tercer intento en el procesador. Nunca cambia a Rápido sin consentimiento.
- **Modelo que falta al separar**: antes de lanzar el worker, el main comprueba el modelo del modo vigente. Si falta o no cuadra el tamaño, lo **vuelve a descargar automáticamente** (913 MB para Calidad) dentro del mismo trabajo, en una fase nueva `descargando_modelo` con bytes y porcentaje. Solo si esa descarga falla se muestra `MODELO_NO_DISPONIBLE` (con la oferta de Rápido de 0019 salvo con `SIN_CONEXION`).
- **Re-separar**: hoy solo existe para canciones *dañadas* porque faltan las pistas (`ux/02`, menú ⋯).

## Pregunta
1. **Texto del reintento por memoria** (`prog.reintento.memoria` = "Reintentando con un modo más ligero…") y del error definitivo (`prog.error.MEMORIA_INSUFICIENTE` = "Ya lo intentamos con un modo más ligero…"): "modo más ligero" sugiere que se ha pasado a Rápido, y ya no es así. ¿Qué texto ponemos para el reintento (mismo modelo, por partes más pequeñas / con el procesador) y para el error definitivo?
2. **Descarga del modelo dentro de la separación** (fase `descargando_modelo`): ¿qué ve el usuario en el subpaso "Separar voz e instrumental", en la tarjeta de la Biblioteca y en el panel de actividad? ¿Se puede cancelar con "Cancelar separación" (técnicamente sí; la descarga reanudable se conserva)? ¿Cambia el botón "Descargar y reintentar" de `prog.error.MODELO_NO_DISPONIBLE`, si la descarga ya se intentó sola?
3. **Re-separar con Calidad una canción separada con Rápido**: tras "Volver a Calidad" en Ajustes, las canciones separadas con Rápido conservan sus pistas. ¿Se ofrece "Re-separar pistas" también para ellas (menú ⋯ o editor), o sigue fuera del MVP como decidió `preguntas/0003`? Si se ofrece, ¿con confirmación (sustituye las pistas al terminar; tarda minutos)? Si crees que es una decisión de alcance, elévala al usuario.
4. **Reintento automático de red** en las descargas de YouTube (`SIN_CONEXION`/`SERVICIO_NO_DISPONIBLE`: hasta 3 reintentos a los 5, 15 y 45 s). `prog.reintento.red` = "Reintentando en {n} s…" existe; ¿se muestra igual en la tarjeta (`bib.*`) y en el panel de actividad? ¿"Cancelar descarga" durante la espera la cancela sin diálogo?
5. **Muerte del proceso por el sistema** (Linux mata el proceso cuando se queda sin memoria, sin mensaje de error): se trata como `MEMORIA_INSUFICIENTE`. Confirma que no hace falta otro texto.

## Opción provisional tomada (si no bloquea)
Textos provisionales, en `textos.ts` de cada vista y marcados `// PROVISIONAL preguntas/0020`:
1. Reintento: "Reintentando por partes más pequeñas…" (y con NVIDIA, en el tercer intento: "Reintentando con el procesador…"). Error definitivo: "**Tu equipo se quedó sin memoria.** Ya lo intentamos por partes más pequeñas. Cierra otros programas y vuelve a intentarlo." + [Reintentar] (+ la oferta de Rápido de 0019).
2. Subpaso: "Descargando el modelo de separación… {n} % · {x} MB de {y} MB" con barra determinada y "Cancelar separación" disponible (mismo diálogo). Tarjeta y panel: "Descargando el modelo… {n} %". El botón del error se queda en "Descargar y reintentar".
3. "Re-separar pistas" solo para dañadas, como dice `ux/02`.
4. El mismo texto en tarjeta y panel; cancelar durante la espera abre el mismo diálogo que con la descarga en curso.
5. Sin texto nuevo.

## Respuesta
Respondida por el diseñador UX (2026-11-05), junto con [0019](0019-calidad-por-defecto-y-rapido-con-consentimiento.md). Se aceptan casi todas las opciones provisionales, con estos textos definitivos:

1. **Memoria**: se adoptan los textos provisionales (`ux/04`):
   - `prog.reintento.memoria`: "Reintentando por partes más pequeñas…"; en el tercer intento (NVIDIA → procesador): "Reintentando con el procesador… Tardará más.".
   - Error definitivo con Calidad (`prog.error.MEMORIA_INSUFICIENTE`): "**Tu equipo no tiene memoria suficiente para el modelo Calidad.** Ya lo intentamos por partes más pequeñas. Cierra otros programas y vuelve a intentarlo." + oferta de Rápido de 0019.
   - Con Rápido: `prog.error.MEMORIA_INSUFICIENTE.rapido` ("Tu equipo se quedó sin memoria…", sin oferta).
   - En la tarjeta y el panel, versión corta: "Reintentando la separación…" (`bib.paso.reintento.memoria`).
2. **`descargando_modelo`**:
   - Subpaso: `prog.fase.modelo` "Descargando el modelo Calidad… {n} % · {x} MB de {y} MB" (`prog.fase.modelo.rapido` tras aceptar Rápido), barra determinada. Se dice el nombre del modelo, a diferencia del texto provisional.
   - Tarjeta (`bib.paso.modelo`) y panel: "Descargando el modelo {n} %", barra determinada, sin tiempo restante.
   - "Cancelar separación" está disponible, con el mismo diálogo; lo descargado se conserva.
   - **Cambia el botón** de `prog.error.MODELO_NO_DISPONIBLE`: "Reintentar" (no "Descargar y reintentar"), porque la descarga ya se intentó sola. Texto: "**No hemos podido descargar el modelo de separación.** Hace falta para separar. Comprueba tu conexión y vuelve a intentarlo." + oferta de Rápido salvo con `SIN_CONEXION`.
3. **Re-separar con Calidad las canciones separadas con Rápido: fuera del MVP**, se mantiene la decisión de [0003](0003-elegir-calidad-o-rapidez-separacion.md) (d). "Re-separar pistas" sigue solo para canciones Dañadas sin pistas (`ux/02`, criterio 18). Motivo: añade estados, confirmación y sustitución de pistas, y afecta a pocas canciones (solo equipos donde Calidad falló). El modelo usado ya queda en `pistas.modelo`, así que se puede añadir después sin cambiar los datos. Si el usuario lo quiere en el MVP, es una decisión de alcance y habría que abrir una pregunta "Para: usuario".
4. **Reintento de red**:
   - Mismo texto en el subpaso, la tarjeta y el panel: "Reintentando en {n} s…" (`prog.reintento.red` / `bib.paso.reintento.red`), con cuenta atrás cada segundo y sin barra.
   - "Cancelar descarga" durante la espera abre **el mismo diálogo** que con la descarga en curso (el trabajo está vivo). Se acepta la opción provisional.
5. **Muerte por memoria del sistema**: confirmado, sin texto propio. Se trata como `MEMORIA_INSUFICIENTE` en todo: reintentos, textos y oferta (`ux/04`, criterio 20).

**Specs actualizadas**:
- `ux/04`: textos de la tabla de subpasos, panel de actividad, "Cancelar separación"/"Cancelar descarga", microcopy y criterios 8b, 8c, 18, 19 y 20.
- `ux/02`: nuevas filas en "Línea de paso", claves `bib.paso.modelo` y `bib.paso.reintento.*`, criterio 18.

**Tareas que deben ajustarse** (no editadas aquí):
- **0063, 0066, 0068 y 0070** (las dos últimas aún no estaban escritas al responder): sustituir los textos marcados `// PROVISIONAL preguntas/0020` por los de arriba. En concreto: el error de memoria con "no tiene memoria suficiente para el modelo Calidad", el subpaso con el nombre del modelo, y "Reintentar" en lugar de "Descargar y reintentar". Añadir `bib.paso.reintento.memoria` en la tarjeta y el panel. Comprobar los criterios 18–20 de `ux/04` y 18 de `ux/02`.
- **Cualquier tarea de la Fase 3 que contemple re-separar canciones hechas con Rápido**: queda fuera (punto 3).

