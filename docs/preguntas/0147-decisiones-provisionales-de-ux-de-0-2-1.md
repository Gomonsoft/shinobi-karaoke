# 0147 — Decisiones provisionales de UX de 0.2.1 (fases 8 y 9)

- De: disenador-ux
- Para: usuario
- Estado: Abierta
- Bloquea: no (opciones provisionales aplicadas en [06 · Fase 8](../ux/06-editor.md#fase-8-de-021--sincronía-y-editor-más-simples), [06 · Fase 9](../ux/06-editor.md#fase-9-de-021--editor-preciso-de-línea), [02 · Fase 8](../ux/02-biblioteca.md#fase-8-de-021--estados-y-fecha-de-añadido) y [07 · Fase 8](../ux/07-reproductor.md#fase-8-de-021--sin-palabras-importadas-ni-desplazamiento-y-barra-de-carga))

## Contexto

Pediste avanzar sin parar: donde había una duda de producto he aplicado la opción que recomiendo y la he marcado en la spec como «decisión provisional». Puedes cambiar cualquiera al revisar; ninguna cambia datos guardados de forma irreversible.

## Pregunta

1. **Doble clic en la línea de tiempo.** ¿Qué hace al terminar la línea?
   - **A (provisional).** Suena de 0,5 s antes a 0,5 s después de la línea y se pausa ahí. El doble clic en la **lista** sigue como hoy (2 s antes, sin pausa).
   - B. Suena desde 0,5 s antes y sigue sonando (como la tecla L).
2. **Canciones con desplazamiento distinto de 0** (no hay ninguna en tu biblioteca). Al quitar el control, ¿se muestra algo?
   - **A (provisional).** Nada: se sigue aplicando sin aviso.
   - B. Una nota en el panel con el valor y un botón para ponerlo a 0.
3. **«Marcar como lista» / «Marcar como letra lista» en una canción ya terminada** (botón junto a «Hecho»).
   - **A (provisional).** Cambia el modo y vuelve a la Biblioteca, como al terminar un borrador. Para cambiar el modo sin salir, está la pestaña «Funciones».
   - B. Cambia el modo y se queda en el editor.
4. **Editor preciso: ¿modal o no?**
   - **A (provisional).** No modal, como las subventanas de Adobe: se ve la vista previa y se puede pasar de línea con la lista. Mientras está abierta, la línea que edita no se puede cambiar desde fuera.
   - B. Modal: el resto del editor queda tapado hasta cerrarla.
5. **Editor preciso: Esc y ✕.**
   - **A (provisional).** Cierran **aplicando** lo marcado (se deshace con Ctrl+Z). Para descartar está «Cancelar».
   - B. Cierran descartando (con confirmación si hay cambios).
6. **Botón «Editar» en la Biblioteca.** Lo pediste para «Letra lista».
   - **A (provisional).** También en las tarjetas «Lista», porque son el mismo estado y la tarjeta debe ser igual.
   - B. Solo en «Letra lista».
7. **Agrupar por «Fecha de añadido»: canciones sin fecha válida.** Dijiste «dejar en sin agrupar».
   - **A (provisional).** Un grupo final llamado «Sin agrupar» con la explicación «No tienen fecha de añadido válida».
   - B. Un grupo final llamado «Sin fecha».
8. **Barra de espera en «Letra lista»** (allí no se usa el color de lo ya cantado).
   - **A (provisional).** Pista con el color de la letra al 35 % y relleno con el color de la letra.
   - B. Usar también ahí el color de lo ya cantado solo para la barra.

Grupos de fecha (sin pregunta, por si quieres otros): Hoy · Ayer · Esta semana (desde el lunes) · Este mes · un grupo por mes y año · Sin agrupar.

## Opción provisional tomada (si no bloquea)

1A, 2A, 3A, 4A, 5A, 6A, 7A y 8A.

## Respuesta
