# 0012 — ¿Aceptamos el modelo Rápido (UVR-MDX-NET-Inst_HQ_4) aunque sus pesos no declaran licencia?
- De: arquitecto
- Para: usuario
- Estado: Respondida
- Bloquea: no para la Fase 2; sí para fijar el modelo del perfil Rápido en la Fase 3 (integración de la separación)

## Contexto
El spike 0005 identificó el modelo exacto del perfil **Rápido** (equipos sin GPU): `UVR-MDX-NET-Inst_HQ_4.onnx` (59 MB, ONNX, factor medido 0,70–0,79 en CPU M1). El **código** de UVR es MIT, pero el repositorio de **pesos** (`TRvlvr/model_repo`) **no declara ninguna licencia**; la afirmación "MIT con atribución" de los ADR 0002 y 0004 no tiene fuente explícita. Estrictamente, sin licencia no hay permiso de uso declarado.

Es el mismo caso por el que el ADR 0004 **excluyó** BS-RoFormer viperx ("licencia de pesos sin declarar"). Aceptarlo sería una excepción al criterio del proyecto (ADR 0002: toda dependencia o modelo con licencia libre verificable), y eso es una decisión de producto/riesgo, no técnica.

Atenuantes: no lo redistribuimos (se descarga desde su origen público en la máquina del usuario), es un modelo ampliamente distribuido por UVR y audio-separator (ambos MIT) para uso libre, y se acreditaría a UVR. El modelo **Calidad** (MelBand RoFormer de Kimberley Jensen) sí declara MIT en Hugging Face y no está afectado.

## Pregunta
¿Qué hacemos con el perfil Rápido?
- **A. Aceptar `Inst_HQ_4` con el riesgo documentado** (excepción explícita en ADR 0002/0004; descarga desde origen, créditos a UVR, se retira si aparece una licencia incompatible). Mejor experiencia sin GPU.
- **B. No usar modelos sin licencia: todos los equipos usan el modelo Calidad (MIT).** Sin GPU es más lento: ≈ 4,5–5 min por canción de 4 min en un M1 (medido); en un PC x86 típico se estima ~6–15 min (sin medir). Desaparece el modo "Rápido" de Ajustes y se simplifica el runtime (sin ONNX Runtime). Primer arranque sin GPU: ≈ +0,85 GB de descarga.
- **C. (Recomendada por el arquitecto) A de forma provisional + pedir aclaración**: se pregunta a los autores (issue en el repositorio de UVR/`model_repo`) si los pesos están bajo MIT; si la respuesta es negativa o no llega antes de publicar la primera versión, se pasa a B.

## Opción provisional tomada (si no bloquea)
C: el manifiesto de runtime y el diseño siguen con `Inst_HQ_4` marcado como "licencia no declarada"; nada se publica con él hasta tu respuesta.

## Respuesta
Decisión del usuario (2026-11-04): **opción C**. Se usa `UVR-MDX-NET-Inst_HQ_4` de forma provisional para el perfil Rápido, marcado como "licencia no declarada" en el manifiesto y en `THIRD_PARTY_NOTICES.md`, y se pide aclaración de licencia a los autores de UVR. No se publica ninguna versión con este modelo hasta tener respuesta; si no la hay o es incompatible, se pasa a la opción B (solo Calidad).
