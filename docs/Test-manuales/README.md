# Test manuales

Guías para que **una persona** verifique a mano las features y las fases. Son independientes de las tareas de los agentes: los agentes implementan y se dan feedback con pruebas mínimas ([estrategia de pruebas](../pruebas.md)); estas guías cubren lo que no merece la pena automatizar o necesita hardware real (varias pantallas, audio por HDMI, Wayland, la sensación de uso).

## Estructura

```
Test-manuales/
├── README.md                 este archivo
├── plantilla.md              copia esta plantilla para una guía nueva
├── flujo-principal.md        recorrido básico de la app; se repite al cerrar cada fase
└── 0.2.0/
    └── fase-N-<nombre>.md    una guía por fase de la versión
```

- Una guía por fase en la carpeta de su versión. Si una feature es grande, puede tener guía propia en esa carpeta (`feature-<nombre>.md`).
- La escribe el agente `qa` al desglosar o cerrar la fase, a partir de los criterios de aceptación de las specs UX y del ADR. El usuario la ejecuta.
- Cada ejecución se registra al final de la guía (tabla «Ejecuciones»). Los fallos se apuntan en «Incidencias» y la sesión principal los convierte en tareas o preguntas.

## Cuándo ejecutar

| Guía | Cuándo |
|---|---|
| [Flujo principal](flujo-principal.md) | Al cerrar cada fase, con la app de desarrollo (`npm run dev`) o empaquetada |
| Guía de la fase | Al cerrar la fase, antes de fusionar su PR en `develop` |

## Guías

| Versión | Guía | Estado |
|---|---|---|
| — | [Flujo principal](flujo-principal.md) | Lista |
| 0.2.0 | [Fase 4 · Ventana secundaria y cola](0.2.0/fase-4-ventana-secundaria-y-cola.md) | En preparación |
