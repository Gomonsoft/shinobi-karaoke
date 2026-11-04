# 0001 — ¿Firmamos y notarizamos los instaladores (con coste) o publicamos sin firmar?
- De: arquitecto
- Para: usuario
- Estado: Respondida
- Bloquea: no (bloqueará las tareas de distribución, no las de desarrollo)

## Contexto
ADR 0001 empaqueta la app como instalador NSIS (Windows), DMG (macOS) y AppImage/.deb (Linux). Sin firma de código:
- **Windows** muestra SmartScreen ("Windows protegió su PC") y el usuario debe pulsar "Más información → Ejecutar de todas formas".
- **macOS** bloquea la app descargada ("no se puede abrir porque es de un desarrollador no identificado"); hay que abrirla con clic derecho → Abrir o desde Ajustes → Privacidad y seguridad. En versiones recientes de macOS esto es cada vez más disuasorio.
- **Linux** no requiere firma.

Firmar tiene coste y requiere una identidad responsable del proyecto:
- macOS: cuenta de Apple Developer (cuota anual de pago) para firmar y notarizar.
- Windows: certificado de firma de código de pago, o servicios de firma gratuitos para proyectos de software libre (p. ej. SignPath Foundation), sujetos a aceptación.

Esto afecta directamente al objetivo "instalable por un usuario no técnico", pero implica dinero y una entidad/persona titular: es una decisión de producto.

## Pregunta
¿Qué estrategia de distribución preferís para el MVP?
1. Sin firmar en ningún SO, con guía de instalación con capturas (coste 0).
2. Firmar en Windows mediante un programa gratuito para software libre (si nos aceptan) y macOS sin firmar.
3. Firmar y notarizar en Windows y macOS (coste anual).

## Opción provisional tomada (si no bloquea)
Desarrollo sin firma (opción 1). La configuración de electron-builder dejará preparada la firma para activarla sin cambios de arquitectura.

## Respuesta
Decisión del usuario (2026-11-03): **opción 1 — sin firmar** en el MVP. La instalación y el primer arranque deben incluir una guía para superar los avisos de Windows SmartScreen y macOS Gatekeeper. La firma se reevaluará después del MVP (la configuración queda preparada).
