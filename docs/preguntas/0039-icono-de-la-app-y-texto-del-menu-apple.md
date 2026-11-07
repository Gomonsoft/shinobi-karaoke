# 0039 — Icono de la app y texto "menú Apple" de B6b
- De: arquitecto
- Para: disenador-ux
- Estado: Respondida
- Bloquea: tareas 0140 (icono) y 0141 (texto). No bloquea construir instaladores, que entretanto llevan el icono de Electron. El icono sí es necesario para las capturas definitivas y para publicar.

## Contexto
1. **Icono**. No hay ningún icono en el repositorio: `electron-builder` avisa de "default Electron icon is used". La marca `◆ Shinobi Karaoke` aparece en B1, pero no hay un archivo. Si el icono necesitara una decisión de marca que exceda la spec, elévala al usuario.
2. **Texto de B6b**. Comprobado byte a byte:
   - `app/src/renderer/src/vistas/primer-arranque/textos.ts:118` usa `menú Apple (U+F8FF)`: un carácter de **uso privado** que solo se dibuja con fuentes de Apple;
   - `ux/01` (wireframe B6b y `pa.macos.pasos`) tiene `menú Apple ()`, con el **paréntesis realmente vacío**. Código y spec no coinciden;
   - `ux/09` §Accesibilidad ya prohíbe el símbolo y usa "menú Apple (la manzana de la esquina de la pantalla)".

   B6b solo se ve en macOS, así que el símbolo suele dibujarse bien; un lector de pantalla puede no leerlo.

## Pregunta
1. ¿Qué icono lleva la app? Necesito un PNG de 1024 × 1024 en `app/build/icon.png`, con licencia libre compatible o de creación propia, y si hace falta variantes para tamaños pequeños.
2. ¿Qué texto definitivo lleva `pa.macos.pasos`? Actualiza `ux/01`; la tarea 0141 lo aplica al código.

## Opción provisional tomada (si no bloquea)
Icono de Electron en los builds internos. Texto de B6b sin cambios hasta tu respuesta.

## Respuesta
(disenador-ux, 2026-11-06)

1. **Icono**: placa `#0E0F14` con el rombo rojo `#C8303B`, especificado con exactitud y con su SVG en `ux/sistema-visual.md` §1.1. Sale un único PNG de 1024 × 1024 en `app/build/icon.png`, de creación propia y sin variantes. No hace falta una decisión de marca para generarlo, porque usa el rombo y los colores ya definidos. El logotipo sigue siendo "provisional" en el sistema visual: si el usuario decide otra marca, solo cambia ese archivo.
2. **`pa.macos.pasos`** (ya en `ux/01`, wireframe y microcopy):
   > Para actualizar: menú Apple (la manzana de la esquina de la pantalla) → Ajustes del Sistema (o Configuración del Sistema) → General → Actualización de Software. Antes, conviene hacer una copia de seguridad. Cuando termines, vuelve a abrir Shinobi Karaoke.

   Comprobado el 2026-11-06 en Apple: [España](https://support.apple.com/es-es/108382) ("Ajustes del Sistema") y [México](https://support.apple.com/es-mx/108382) ("Configuración del Sistema"), ambas con General → Actualización de Software. Se quita "Preferencias del Sistema": como B6b solo se ve en macOS 13 (0041), no aplica. El texto no usa U+F8FF.

   La tarea 0141 debe cambiar también cualquier prueba que fije el texto anterior.
