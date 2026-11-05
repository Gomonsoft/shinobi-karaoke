# 0019 — Calidad por defecto en todos los equipos y Rápido solo con consentimiento: ¿cómo cambian el primer arranque, el progreso y los Ajustes?
- De: arquitecto
- Para: disenador-ux
- Estado: Abierta
- Bloquea: tarea 0057 (interfaz de la oferta de Rápido) y la parte de interfaz de 0056 (textos de B2/B3 y de la vista de progreso); los Ajustes de la Fase 3

## Contexto
Decisión del usuario (2026-11-05, [`preguntas/0018`](0018-datos-reales-del-runtime-y-espacio-en-linux.md)) y detalle técnico en el ADR 0004 (Revisiones 2026-11-05):
- **Calidad (MelBand RoFormer, MIT) es el modelo de todos los equipos**, también los que no tienen GPU. El perfil de hardware solo decide dónde se ejecuta: tarjeta NVIDIA o CPU.
- **Rápido** (`UVR-MDX-NET-Inst_HQ_4`) **solo con consentimiento explícito**: sus autores no han declarado licencia ([`preguntas/0012`](0012-licencia-no-declarada-del-modelo-rapido.md)) y el usuario lo usa **bajo su responsabilidad**. Nunca se descarga ni se usa sin que lo acepte, y nunca se cambia a Rápido de forma automática.
- **Espacio requerido**: 4 GB en CPU y Apple Silicon y 10 GB con NVIDIA. Los equipos sin GPU descargan ≈ 1,25–1,4 GB en lugar de ≈ 0,4–0,5 GB y tardan ~6–15 min por canción de 4 min en x86 (estimado, sin medir).
- **Cuándo se ofrece Rápido** (técnico): solo tras un fallo **definitivo** de Calidad.
  - **(a) Primer arranque, fase "Descargando modelo de separación"**:
    - verificación SHA-256 fallida tras el reintento automático;
    - servidores de descarga no disponibles (`SERVICIO_NO_DISPONIBLE` en todas las URLs);
    - `SIN_ESPACIO` cuando el espacio libre alcanza para Rápido (59 MB) pero no para Calidad (913 MB).
    - **No** con `SIN_CONEXION`, porque Rápido también fallaría.
  - **(b) Separación**:
    - `MEMORIA_INSUFICIENTE` después de los reintentos automáticos con Calidad (bloques más pequeños y, si era GPU, CPU);
    - `MODELO_NO_DISPONIBLE` si Calidad no se puede volver a descargar.
  - **(c) Ajustes: Rápido NO es elegible** (decisión del usuario, 2026-11-05). Solo se ofrece en (a) y (b).
- **Qué hace aceptar**:
  - guarda el consentimiento con su fecha (`config.separacion.rapido_aceptado`);
  - descarga Rápido si no está (59 MB);
  - fija el modo global en Rápido.
  En el primer arranque, la instalación termina con Rápido (B3) y Calidad se puede recuperar después desde Ajustes ("Volver a Calidad"). En una separación, el trabajo se relanza con Rápido.
- **Ajustes ya no ofrece elegir modo** (ni Automático ni Rápido). Como mucho informa del **modelo en uso** y, si es Rápido, permite **volver a Calidad**: se descarga Calidad si falta, y se cambia solo cuando está verificado; si falla, sigue Rápido. Una configuración guardada con *Automático* se lee como Calidad.

## Pregunta
¿Qué cambia en las specs? En concreto:
1. **`ux/01` B1–B3**:
   - Los mensajes de modo `pa.modo.rapido`, `pa.modo.rebajado.memoria` y `pa.modo.rebajado.generico` ya no son ciertos: sin GPU, o si se rebaja la GPU, se usa **Calidad en CPU**. Hay que reescribirlos (¿"separaremos en modo Calidad con el procesador; tardará unos N min por canción"?).
   - Revisar las cifras de descarga y de espacio de B1 (4 GB en CPU).
   - Revisar el tiempo estimado de B3 en CPU x86.
2. **`ux/01` B4 (error en la fase de modelo)**:
   - acción secundaria para usar Rápido junto a "Reintentar";
   - diálogo de consentimiento (título, cuerpo con el aviso de licencia no declarada y responsabilidad, botones);
   - qué ve el usuario en B2/B3 al terminar con Rápido;
   - cómo se anuncia a lectores de pantalla.
3. **`ux/04` (progreso)**:
   - banner de error de separación con la oferta de Rápido para los casos (b);
   - nuevo texto del popover "Modo · ⓘ" (`prog.modo.*`), que hoy dice "eligió este modo según tu equipo".
4. **`ux/08` (Ajustes)**:
   - el grupo de radio desaparece; la sección "Separación de voz" pasa a ser informativa (equipo, modelo en uso y tiempo estimado por canción) y sustituye a los textos `aj.sep.*`;
   - si se usa Rápido: indicación de que se usa bajo responsabilidad del usuario, acción "Volver a Calidad" con su progreso en línea, cancelación y error;
   - ¿hace falta confirmación al volver a Calidad (descarga de ~900 MB y más lentitud en CPU)?;
   - el texto de "Copiar información para soporte", si cambia.
5. **Aviso de riesgo de Rápido**: texto único reutilizable en los dos puntos de oferta (a y b). Contenido mínimo:
   - sus autores no han declarado licencia;
   - se descarga desde su origen, no lo distribuye Shinobi Karaoke;
   - se usa bajo la responsabilidad del usuario;
   - es más ligero y deja algo más de voz de fondo.
   ¿Se enlaza a "Créditos y licencias de terceros"?
6. ¿Hace falta algún cambio en el mapa de vistas (`ux/00`) o en la Biblioteca (`ux/02`)? Por ejemplo, el indicador de modo en las tarjetas.

## Opción provisional tomada (si no bloquea)
- **0056 (lógica)** se puede implementar ya:
  - los textos de modo de B2/B3 muestran siempre la variante de Calidad que existe hoy (NVIDIA/Apple), adaptada a "procesador" en CPU;
  - Ajustes de la Fase 3 no se implementa hasta esta respuesta.
- **0057** implementa la lógica y la API, con un diálogo marcado como provisional:
  - título "¿Usar el modelo Rápido?";
  - cuerpo: "No hemos podido preparar el modelo de Calidad. Puedes usar el modelo Rápido, más ligero, pero sus autores no han declarado una licencia: lo usarás bajo tu responsabilidad.";
  - botones [Cancelar] [Usar el modelo Rápido].
  Se sustituye cuando llegue la respuesta.

## Respuesta
