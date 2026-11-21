# 0238 — Diálogo de exportación: formulario, muestra y perfiles

- Estado: Pendiente
- Paso del pipeline: 6
- Depende de: [0230](0230-contratos-compartidos-de-la-exportacion.md) (contra la API falsa); integración real tras [0237](0237-servicio-de-exportacion-e-ipc.md)
- ADRs: [0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md) §5, §6 y §11
- Spec UX: [10](../ux/10-exportacion.md) wireframes A, E y F, §«Formulario», §«Perfil no soportado frente a bloqueo por evento», §«Notas del formulario», microcopy `exp.*`; [sistema visual](../ux/sistema-visual.md#020--exportación-de-video-fase-6)

## Objetivo
El diálogo «Exportar video» en su estado de formulario, con formato, audio, proporción, resolución, FPS, destino, estimación, notas y muestra.

## Contrato
- `renderer/src/exportacion/dialogo/` (nuevo): `DialogoExportacion` (contenedor de estados; este tarea implementa A, E, F, «Cargando perfiles» y «Validando»), `Formulario`, `MuestraExportacion` (fotograma fijo con `PantallaLetra` estático y `MarcaDeAgua` escalada), `textos.ts` con las claves `exp.*`.
- **Formato**: control segmentado con los dos formatos de `FORMATOS` (ADR 0019 §5, la spec preveía este caso); `exp.formato.ayuda` con los textos de compatibilidad del ADR.
- Perfiles no soportados con su motivo, cambio automático de FPS y proporción no disponible, según la spec. Sin candado de evento: con sesión activa solo la nota `exp.nota.sesion`.
- Destino con `destinoPropuesto`/`elegirDestino`; recordar opciones lo hace main al iniciar.
- Estimación con `exportacion.estimar` y aviso de espacio.

## Criterios de aceptación
- [ ] V3–V10 de la spec 10 con la API falsa.
- [ ] V23 (rama «pueden convivir»): con sesión activa, la nota aparece y «Exportar» sigue disponible.
- [ ] Estado F con `RUNTIME_NO_DISPONIBLE` (acción «Reparar el motor de audio») y con `SIN_CODIFICADOR`.
- [ ] A 1024 × 576 sin scroll horizontal (V29, parte del formulario).

## Pruebas de feedback
- Unitarias: Vitest + Testing Library de `DialogoExportacion` (A, E, F), `Formulario` (perfiles no soportados, cambio de FPS, notas en orden) y `MuestraExportacion`.
- E2E: ninguna.
- Críticos: no.
- Manual: nada (capturas en 0241).

## Notas de implementación
