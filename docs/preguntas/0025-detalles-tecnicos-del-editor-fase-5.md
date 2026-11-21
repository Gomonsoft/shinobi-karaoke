# 0025 — Detalles técnicos del editor (Fase 5)
- De: disenador-ux
- Para: arquitecto
- Estado: Respondida
- Bloquea: no. `ux/06-editor.md` (revisión 2026-11-05) lleva una opción provisional en cada punto; basta con confirmarla o corregirla en el desglose de la Fase 5.

## Contexto
Al poner al día `ux/06-editor.md` para la Fase 5 han salido puntos que dependen de decisiones técnicas o del plan de fases. Aquí solo van esos; el resto de la spec es de presentación y comportamiento.

## Preguntas
1. **"Probar a pantalla completa" y [▶ Reproducir] del toast** dependen del reproductor (Fase 6). ¿Entra en la Fase 5 una versión mínima del reproductor (el motor de render ya se construye para la vista previa), o se dejan para la Fase 6? **Provisional**: si no hay reproductor, el botón y la tecla F no se muestran y el toast `bib.toast.lista` sale sin acción; criterio 42 y la acción del toast se verifican en la Fase 6.
2. **Regla de una marca en el modo "Sincronizar al ritmo"** (`ux/06` §"Modo", criterios 13–14): al marcar la línea "Siguiente" en `t`, (a) si `t` ≤ inicio del elemento anterior con tiempo, no se marca; (b) los elementos posteriores con inicio ≤ `t` pierden su tiempo (líneas con `borrarTiemposLinea`; pausas, solo `inicio_ms: null`); (c) se aplica `moverInicioLinea` (que ya admite una línea sin inicio). ¿Se añade como función pura compartida (p. ej. `marcarInicioLinea(letra, id, t) → { letra, borrados, palabrasDescartadas, finesAutomaticos }`) junto a las de la tarea 0006? Quitar el inicio de una pausa es válido según los invariantes de ADR 0006, pero cambia el fin automático de la línea anterior; ¿alguna objeción?
3. **Desplazamiento global** (`ux/06` §"Datos que usa" y criterio 26): la UI muestra `inicio_ms + offset_ms` y al marcar en `t` guarda `t − offset_ms` (mínimo 0). Si dos marcas acabaran en 0 por ese mínimo, la segunda incumpliría "inicios estrictamente crecientes": la regla (a) del punto 2 lo evita, ¿basta? Rango propuesto para `offset_ms`: −30 000 … +30 000 (hoy el esquema solo exige entero); ¿se añade al validador?
4. **Guardado del editor**:
   - API: el escritor único de `letra` es `letras.*` (main). El editor necesita guardar tiempos, `offset_ms`, `estilo` y `estado` (marcar como lista / volver a borrador) con *debounce* de ~1 s. ¿Qué forma tiene (p. ej. `editor.guardar({ cancionId, letra?, estilo? })` validado con `letraSchema` + invariantes, y `canciones.marcarLista` que comprueba las condiciones en main)?
   - Salida: la spec pide vaciar el guardado pendiente antes de navegar y, si falla, un diálogo. ¿Viable también al **cerrar la ventana** (el main espera a que el renderer vacíe lo pendiente, con un tope de p. ej. 2 s, antes de cerrar), integrado con el diálogo de cierre de la tarea 0073?
5. **Velocidad < 1×**: ADR 0005 deja para un spike de la Fase 5 usar `<audio>` con `preservesPitch`. El tooltip `edi.velocidad.tooltip` tiene dos variantes; ¿cuál queda? Si se conserva el tono, el criterio de 20 ms (criterio 12) debe seguir cumpliéndose a 0,5×.
6. **Tres pistas en memoria**: Original, Voz e Instrumental decodificadas son ~250 MB para 4 min. La spec pide que cambiar de pista mantenga la posición y que, si la pista aún carga, siga sonando la anterior con un spinner en su opción. ¿Se decodifican bajo demanda y se libera la que no suena, o las tres al entrar?
7. **Pausa al perder el foco** durante el modo sincronizar (evento `blur` de la ventana): ¿algún problema con el diálogo de cierre o con la pantalla completa?
8. **Volumen del editor**: la spec usa el mismo `config.reproductor.volumen`/`silenciado` que el reproductor (un solo volumen en la app). ¿De acuerdo?

## Opción provisional tomada (si no bloquea)
La indicada en cada punto, tal como está en `ux/06-editor.md`.

## Respuesta
**Respondida por el arquitecto (2026-11-05).** Decisiones en el nuevo [ADR 0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md); tareas 0090–0111.

1. **Probar a pantalla completa → Fase 6.** La Fase 5 construye el motor de audio (`MotorAudio`, 0094) y el render (`PantallaLetra`, 0098) ya pensados para el reproductor. El reproductor (controles que se ocultan, volumen, `rep.incompleta`, Esc que vuelve a la posición) es la Fase 6, y una versión mínima ahora sería trabajo que se tira. Se confirma la opción provisional:
   - en la Fase 5, el botón y la tecla F no se muestran;
   - `bib.toast.lista` sale sin [▶ Reproducir];
   - el criterio 42 y la acción del toast se verifican en la Fase 6 (anotado en [backlog del MVP](../versiones/0.1.0/backlog.md)).
2. **Sí: `marcarInicioLinea(letra, id, t)`** en `app/src/shared/letras/tiempos.ts`, junto con el resto de operaciones del editor (tarea 0092). Hace las reglas (a), (b) y (c) y devuelve `{ letra, cambiado, limite, borrados, palabrasDescartadas, finesAutomaticos }`, con `limite: 'demasiado_pronto'` para `edi.sync.pronto`.
   - Sin objeción a quitar el inicio de una pausa: es válido y el fin automático de la línea anterior se recalcula al dibujar.
   - Matiz: la pausa pierde inicio **y** fin, porque un fin exige inicio (ADR 0006). En la práctica las pausas no tienen fin.
3. **La regla (a) basta.** Con `t ≤ inicio anterior` no se marca. Si dos marcas acabaran en 0 por el mínimo, la segunda tendría `t ≤ 0 = inicio anterior` y no se marcaría. El "fijar aquí" usa los mismos límites (0092).
   - **Rango −30 000 … +30 000** (`OFFSET_MAXIMO_MS`).
   - Se valida en el contrato de entrada (`guardarTiemposSchema`, 0090), **no** en `letraSchema`, para no volver ilegible ninguna canción ya guardada (lectura tolerante).
4. **API de guardado** (tareas 0090, 0091 y 0104):
   - `letras.guardarTiempos({ cancionId, offset_ms, tiempos: [{ id, inicio_ms, fin_ms, palabras }] })`:
     - va en `ServicioLetras`, que sigue siendo el único escritor de `letra`;
     - no puede cambiar textos, ids ni el orden;
     - valida con `letraSchema`;
     - responde `LETRA_DESACTUALIZADA` si la letra guardada ya no tiene los mismos elementos;
   - `biblioteca.guardarEstilo(id, estilo)`;
   - `biblioteca.marcarLista(id)`: el main comprueba las condiciones con `puedeMarcarseLista`;
   - "Volver a borrador" usa el `biblioteca.volverABorrador` que ya existe.
   No se hace un `editor.guardar` combinado: mezclaría dos escritores.
   - **Debounce** en el renderer (1 s, como mucho 2 s) y escritura **inmediata** en el main. Así "vaciar el guardado" es enviar ya y esperar la respuesta, y el diálogo `edi.dialogo.salir` sale solo si esa respuesta es un error.
   - **Cerrar la ventana: sí, viable.** El renderer avisa con `app.guardadoPendiente(true/false)`. Con cambios pendientes, el control de cierre (`main/cierre.ts`) trata la ventana como "algo en curso", pide `app:solicitudCierre`, y el renderer vacía (tope de 2 s) y confirma. Si hay trabajos, antes se ve el diálogo de 0073.
5. **Sin spike de `preservesPitch`: el tono baja** (lo que ya decía el ADR 0005). Con `<audio>` + `preservesPitch` el reloj del elemento no garantiza los 20 ms, y conservar el tono con buena precisión exigiría un *time-stretch* en WASM. Queda como mejora futura, sin impacto en los datos. El tooltip es la variante "A menor velocidad, el tono también baja. Los tiempos que marques valen igual a cualquier velocidad.".
6. **Bajo demanda, con un máximo de 2 pistas decodificadas (LRU)**: ≈ 170 MB con canciones de 4 min y ≈ 420 MB con las de 10 min. Se decodifica la primera vez que se escucha cada pista. Mientras se prepara una, sigue sonando la anterior, con un spinner en su opción (`cargandoPista`, 0094). Volver a la pista descartada la decodifica otra vez (< 1 s).
7. **Pausa al perder el foco: sin problema.** El diálogo de cierre de 0073 es de la propia ventana: al abrirse no hay `blur` y, si lo hubiera, pausar es inocuo. La pantalla completa es de la Fase 6. Solo se activa durante el modo sincronizar (0107).
8. **De acuerdo: un solo volumen** en la app (`config.reproductor.volumen`/`silenciado`). El editor lo lee y lo guarda con `config.actualizar`, agrupando como mucho una escritura cada 500 ms (0105).
