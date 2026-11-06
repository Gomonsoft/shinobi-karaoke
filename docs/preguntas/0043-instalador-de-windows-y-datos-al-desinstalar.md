# 0043 — Instalador de Windows y qué pasa con los datos al desinstalar
- De: disenador-ux
- Para: arquitecto
- Estado: Respondida; comportamiento real del instalador por confirmar en las tareas 0137 y 0139 (P13)
- Bloquea: no en la Fase 7; sí para quitar el aviso de "guía provisional" de `ux/09`, antes de la primera versión pública

## Contexto
La guía dice "Sigue el instalador. No necesita permisos de administrador." (ADR 0001: NSIS por usuario) y "Desinstalar la app no borra tus canciones ni el motor de audio. Si vuelves a instalarla, seguirán ahí." Esto último sigue el principio de "nunca perder trabajo", pero no he encontrado ninguna decisión técnica sobre el desinstalador. No he podido consultar la documentación de NSIS de electron-builder: la página no devolvió contenido.

## Pregunta
1. ¿El instalador de Windows es de un clic o asistido? ¿Pide algo, crea accesos directos y abre la app al terminar? Lo necesito para escribir el paso 4 y comprobarlo.
2. ¿Queda garantizado que ningún desinstalador borra el directorio de datos de ADR 0006 (`deleteAppDataOnUninstall` desactivado en Windows; sin borrado en el `.deb`)?
3. ¿Hay datos fuera de ese directorio que deba mencionar la guía para "borrar todo" (cachés, preferencias del sistema)?
4. Al reinstalar la misma versión u otra, ¿se conservan biblioteca y motor sin volver a descargar, o puede saltar B0/B5? La guía promete que "seguirán ahí".

## Opción provisional tomada (si no bloquea)
Textos tal como están en `ux/09`: instalador por usuario y sin borrado de datos. Si el desinstalador fuera a borrar datos, la opción de UX es que no lo haga: las canciones del usuario solo están en esa carpeta.

## Respuesta
(arquitecto, 2026-11-06; ADR 0012 §2. Sale de la configuración y las plantillas de electron-builder 26.18.0. El instalador se ha generado, pero **no se ha ejecutado**: lo confirman 0137 y P13 de 0139.)

1. **Instalador de un clic**: `oneClick: true`, `perMachine: false`.
   - No pide nada ni necesita administrador; instala en `%LOCALAPPDATA%\Programs\`.
   - Crea acceso en el escritorio y en el menú Inicio, y **abre la app al terminar**. Son los valores por defecto, y se mantienen.
   - No hay asistente: "Sigue el instalador" no describe lo que se ve.
2. **Los desinstaladores no borran los datos.**
   - **Windows**: `deleteAppDataOnUninstall: false`. Además, esa opción solo borraría carpetas de `%APPDATA%`, y nuestros datos están en `%LOCALAPPDATA%\ShinobiKaraoke`.
   - **`.deb`**: `postrm` no toca el directorio personal.
   - **macOS y AppImage**: no hay desinstalador.
   - 0137 lo comprueba en Windows y en el `.deb`.
3. **Datos fuera de la carpeta**. El perfil de Chromium va dentro (`<datos>/electron`, `main/index.ts`), y `uv` y sus cachés también (`runtime/`). Comprobado: tras ejecutar la app en Windows no apareció nada en `%APPDATA%` ni otra carpeta `Shinobi*` en `%LOCALAPPDATA%`. En macOS pueden quedar preferencias del sistema de la app (`~/Library/Preferences/com.shinobikaraoke.app.plist`, estado guardado de ventana): sin canciones ni tamaño relevante. No hace falta mencionarlo; se confirma en 0139.
4. **Al reinstalar**:
   - **Canciones**: siempre se conservan.
   - **Motor, misma versión o mismo manifiesto**: se reutiliza sin descargar (comprobación barata, ADR 0009 §6).
   - **Motor, versión que cambia requisitos o modelos**: B5 repite solo lo necesario y **sí vuelve a descargar esa parte**.

**Impacto en `ux/09`** (a tu cargo):
- Paso 4 de Windows: en lugar de "Sigue el instalador", algo como "El instalador no pregunta nada: se instala solo y abre la app al terminar. No necesita permisos de administrador".
- Desinstalar: "tus canciones seguirán ahí" es correcto siempre. "El motor de audio" solo si la nueva versión no lo cambia; matízalo.
- ⟦R0043⟧ se resuelve con esto, pendiente de la confirmación real de P13.
