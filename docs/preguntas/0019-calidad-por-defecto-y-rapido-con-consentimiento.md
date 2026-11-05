# 0019 — Calidad por defecto en todos los equipos y Rápido solo con consentimiento: ¿cómo cambian el primer arranque, el progreso y los Ajustes?
- De: arquitecto
- Para: disenador-ux
- Estado: Respondida
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
Respondida por el diseñador UX (2026-11-05). Decisión del usuario aplicada: **Calidad en todos los equipos, sin Automático**; **Rápido solo tras un fallo de Calidad** (primer arranque o separación), con aviso de licencia no declarada y consentimiento explícito; **Ajustes no permite elegir modelo**: informa del modelo en uso y ofrece "Volver a Calidad" si se usa Rápido; **4 GB** mínimos. Los textos de la opción provisional se sustituyen por los de las specs.

**Terminología**: en la interfaz se habla de **modelo** ("modelo Calidad", "modelo Rápido"), no de "modo": el aviso de licencia es sobre un archivo de terceros y ya no hay modos que elegir. Las claves `pa.modo.*`/`prog.modo.*` conservan el nombre.

1. **`ux/01` B1–B3**:
   - `pa.modo.calidad.nvidia` / `.apple` reescritos ("Separaremos las pistas con el modelo Calidad usando…"); `pa.modo.rapido` se sustituye por **`pa.modo.calidad.cpu`** ("…con el modelo Calidad usando el procesador. Es más lento: una canción de 4 minutos tardará entre {a} y {b} minutos."). `pa.modo.rebajado.memoria`/`.generico` dicen lo mismo con su causa. La rebaja ya no recalcula el tamaño ni la barra total.
   - B1: ejemplo CPU "unos 1,3 GB" y "al menos 4 GB"; valores de ejemplo por perfil actualizados; `pa.req.descarga.generica` pasa a `entre {a} y {b} GB` calculado del manifiesto. Parte A: "entre 4 y 10 GB libres".
   - B3: `pa.listo.modelo` (modelo + con qué se ejecuta) y `pa.listo.tiempo.aprox` cuando el factor no está medido (CPU x86: 6–15 min).
2. **`ux/01` B4 y diálogo** (nuevos wireframes "B4 con oferta", "Diálogo de consentimiento" y "B3 con el modelo Rápido"):
   - Con `ofrecerRapido`, el banner añade `rapido.oferta` (o `rapido.oferta.espacio` con `SIN_ESPACIO`) y el botón secundario **"Usar el modelo Rápido…"** junto a "Reintentar" (primario, foco inicial). `pa.error.verificacion` se reescribe (ya hubo reintento) y se añade `pa.error.servidor.todos`.
   - Diálogo `aviso-rapido`: título "¿Usar el modelo Rápido?", motivo según el origen (`rapido.motivo.preparar`/`.memoria`/`.descarga`), `rapido.cuerpo`, recuadro `aviso` con las tres viñetas, enlace a créditos, `rapido.alcance`; botones [Cancelar] (foco inicial) y [Usar el modelo Rápido]. Pulsar el botón **es** el consentimiento (sin casilla).
   - Tras aceptar: B2 con `pa.fase.modelo.rapido` y "X MB de 59 MB", mensaje `pa.modo.rapido.aceptado`, y B3 con `pa.listo.rapido` ("Usas el modelo Rápido bajo tu responsabilidad…").
   - Lectores de pantalla: banner completo una vez, diálogo con `aria-describedby`, anuncio `rapido.anuncio.descargando`. Criterios 18–22 nuevos; 5, 5b y 5c revisados.
3. **`ux/04`**: wireframe "Error de separación con oferta" (`MEMORIA_INSUFICIENTE` tras los reintentos o `MODELO_NO_DISPONIBLE` salvo por `SIN_CONEXION`, solo si se separaba con Calidad), con [Reintentar] + [Usar el modelo Rápido…] y `rapido.oferta.separacion`; el toast y la notificación nunca llevan la oferta. Indicador "Modelo Calidad · ⓘ" con `prog.modo.ayuda.calidad` (dispositivo, sin enlace) y `prog.modo.ayuda.rapido` (responsabilidad + "Ir a Ajustes"). `prog.reintento.memoria` y los errores de memoria/modelo reescritos (adopta el texto provisional de [0020](0020-huecos-ux-de-la-separacion-fase-3.md) §1: "por partes más pequeñas" / "con el procesador"); `prog.fase.modelo`/`.rapido` para la descarga dentro del trabajo. Criterios 8b, 8c y 13.
4. **`ux/08`**: desaparece el grupo de radio y los `aj.sep.*` anteriores. Sección informativa (equipo, modelo en uso, tiempo). Variante Rápido con aviso (fecha del consentimiento + créditos), descripción de Calidad y **"Volver a Calidad…"**. **Sí hay confirmación siempre** (`aj.sep.dialogo`): descarga de ~900 MB si falta, más lentitud en CPU y, sobre todo, **desde Ajustes no se puede volver a Rápido**. Progreso en línea con Cancelar, error con [Reintentar] y "Sigues usando el modelo Rápido", toast al terminar. "Copiar información para soporte" copia el **modelo en uso** (`rapido (aceptado el AAAA-MM-DD)`) y el dispositivo en lugar del "modo". Créditos de Acerca de: MelBand RoFormer (Kimberley Jensen) y UVR solo para Rápido.
5. **Aviso de riesgo**: texto único `rapido.*` definido en `ux/01` y reutilizado por `ux/04`. **Sí se enlaza** a "Créditos y licencias de terceros" (se abre encima y devuelve el foco al enlace).
6. **`ux/00`**: solo cifras del diagrama (~1–6 GB) y "modelo Calidad" en "Todo listo". **`ux/02`**: sin cambios; las tarjetas no muestran el modelo (el modelo usado se ve en la vista de progreso y en Ajustes).

**Pregunta técnica derivada**: [0021](0021-detalles-tecnicos-de-la-oferta-de-rapido-y-volver-a-calidad.md) (Reintentar tras fallar Rápido, descarga de "Volver a Calidad" fuera de Ajustes, origen de la estimación, VRAM/rebaja en Ajustes). No bloquea.

**Tareas que deben ajustarse** (no editadas aquí):
- **0056**: sustituir los "textos provisionales" por `pa.modo.calidad.*`, `pa.modo.rebajado.*`, `pa.listo.modelo`, `pa.listo.tiempo(.aprox)` y `pa.req.descarga.generica` de `ux/01`; la rebaja no cambia tamaños (criterio 5b); B1 con 4 GB en CPU (5c).
- **0057**: el diálogo deja de ser provisional (textos `rapido.*` en el módulo `aviso-rapido`, motivo por origen, enlace a créditos, foco en Cancelar); banner de B4 con `rapido.oferta`/`.oferta.espacio`; B2/B3 variante Rápido; criterios 18–22 de `ux/01`; Reintentar tras fallo de Rápido según 0021 §1.
- **Tareas de la Fase 3** de separación (las de [0020](0020-huecos-ux-de-la-separacion-fase-3.md)): banner con oferta y criterios 8b, 8c y 13 de `ux/04`; textos de memoria y `MODELO_NO_DISPONIBLE` ("Reintentar", no "Descargar y reintentar").
- **Tarea de Ajustes de la Fase 3**: implementar `ux/08` nuevo (criterios 1–5 y 9).
- **0054** (información para soporte): "modelo en uso" + dispositivo en lugar de "modo de separación".
- **README / página de descarga** (Parte A §2 de `ux/01`): "entre 4 y 10 GB libres".

