# 0032 — Textos del "motor de audio incompleto" al separar
- De: arquitecto
- Para: disenador-ux
- Estado: Respondida (2026-11-06)
- Bloquea: no. La tarea 0125 lleva textos provisionales que se cambian en `textos.ts` sin tocar la lógica.

## Contexto
1. **Motor incompleto** (deuda detectada en desarrollo el 2026-11-06; ADR 0009, Revisión 2026-11-06). Si al separar falta una parte del motor de audio (p. ej. "No module named 'audio_separator'"), la separación termina hoy en `ERROR_INTERNO` ("Algo salió mal al separar"). A partir de la tarea 0124 termina en **`RUNTIME_NO_DISPONIBLE`** y la instalación pasa a `dañada`. La reparación es el B5 que ya existe ("Hay que reparar el motor de audio" → [Reparar]): se abre al reiniciar la app o desde la acción nueva del error. El código no tiene textos en `ux/00` §7 ni en `ux/04`.

## Pregunta
1. Textos de `RUNTIME_NO_DISPONIBLE`:
   - título del índice de errores (toast, línea de la tarjeta);
   - banner de la vista de progreso (`prog.error.RUNTIME_NO_DISPONIBLE`) y su acción;
   - ¿la tarjeta de la Biblioteca ofrece también la acción, o basta con [Ver] del toast → Progreso?

## Opción provisional tomada (si no bloquea)
1. Textos de `RUNTIME_NO_DISPONIBLE`:
   - título: «Hay que reparar el motor de audio»;
   - banner: «**Hay que reparar el motor de audio.** Falta una parte del motor que separa la voz. Repáralo y vuelve a intentarlo.», con la acción [Reparar el motor de audio] (primaria), que abre Primer arranque en B5. Sin [Reintentar], porque fallaría igual;
   - la tarjeta solo muestra el título del error y sus acciones de siempre.

## Respuesta
Diseñador UX, 2026-11-06. Se acepta la opción provisional con tres ajustes. Specs actualizadas: `ux/04` (microcopy, componente "Reparar el motor de audio", criterios 8b, 21–23), `ux/01` (estado "Instalación dañada a mitad de sesión", criterio 12b), `ux/00` §7 y `ux/02` (acción de la tarjeta).

1. **Título** (toast, tarjeta, índice): «Hay que reparar el motor de audio». Igual que `pa.reparar.titulo`, a propósito: el usuario ve la misma frase en el error y en B5.
2. **Banner** `prog.error.RUNTIME_NO_DISPONIBLE`: «**Hay que reparar el motor de audio.** Falta una parte del motor que separa la voz de la música. Al repararlo se descarga de nuevo lo que falta; después, vuelve a separar esta canción.»
   - [Reparar el motor de audio] (primario, foco) → B5 de Primer arranque. Sin [Reintentar] y sin oferta de Rápido, como en la provisional.
   - **Ajuste a**: añade [Copiar detalles] (secundario). Es un fallo inesperado ("No module named …") y los detalles sirven para abrir una incidencia.
   - **Ajuste b**: si hay otros trabajos en curso o en cola, antes de abrir B5 se pide confirmación con `prog.dialogo.reparar` («¿Reparar el motor de audio ahora? Hay {n} trabajo(s) sin terminar ({lista}). Si reparas ahora, se cancelarán y tendrás que repetirlos. Tu letra y tu estilo están guardados.» [Seguir trabajando] (foco) [Reparar ahora]). Reparar reinstala el entorno que también usan otros trabajos, como las descargas. Al confirmar, esos trabajos quedan `pendiente`, igual que al cancelarlos a mano. **Para el arquitecto**: si la reparación pudiera convivir con los trabajos activos, se quita el diálogo. No bloquea.
   - **Ajuste c**: después de reparar (`runtime.estado()` = `completa`), el error de la canción sigue guardado. Al volver a su vista de progreso, el banner pasa a `prog.error.RUNTIME_NO_DISPONIBLE.reparado` («**El motor de audio ya está reparado.** Vuelve a separar esta canción.» [Reintentar]). Así no se vuelve a ofrecer "reparar" sobre un motor sano.
3. **Tarjeta de la Biblioteca**: no ofrece la acción de reparar. Muestra el título del error y [Ver] (no [Reintentar], porque fallaría), que abre la vista de progreso. Basta con [Ver] del toast o de la tarjeta → Progreso.
4. **B5 a mitad de sesión**: usa los mismos textos (`pa.reparar.*`) y el mismo bloqueo de las otras vistas que al arrancar. B3 → "Empezar" vuelve a la Biblioteca con las canciones del usuario.

**Efecto en la tarea 0125**: los textos provisionales casi no cambian; hay que actualizar sus criterios:
- el cuerpo del banner (texto de arriba);
- [Copiar detalles] secundario (ya no es "una sola acción");
- la variante `.reparado` con [Reintentar];
- la tarjeta con [Ver] para este código (comprobar que `textosError.ts`/la tarjeta no lo tratan como reintentable);
- el diálogo `prog.dialogo.reparar` con trabajos activos (si el arquitecto lo mantiene; puede ir a una tarea aparte).
