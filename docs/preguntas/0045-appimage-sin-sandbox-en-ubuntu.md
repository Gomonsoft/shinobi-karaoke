# 0045 — ¿Aceptamos que el AppImage arranque sin el sandbox del sistema en Ubuntu 24.04 o posterior?
- De: sesión principal (revisión de la Fase 7)
- Para: usuario
- Estado: Abierta
- Bloquea: tarea 0142 (primera versión pública). **No bloquea** construir ni probar los instaladores.

## Contexto
El ADR 0008 pide mantener el sandbox de Chromium. En Ubuntu 24.04 o posterior, el sistema restringe lo que ese sandbox necesita:

- **`.deb`**: instala un perfil de AppArmor propio, así que se espera que arranque **con** sandbox (a comprobar en la tarea 0137).
- **AppImage**: no puede instalar ese perfil. Su `AppRun` añade `--no-sandbox` por su cuenta si la comprobación falla, y **no avisa al usuario**. Aún no se ha ejecutado con la restricción activa: lo mide la 0137.

Sin ese sandbox se mantienen el aislamiento de contexto y la ausencia de Node en el renderer, pero una vulnerabilidad en el renderer quedaría menos contenida. Las letras y las miniaturas llegan de internet.

El ADR 0012 lo recoge como limitación aceptada por el arquitecto. Como se aparta de una decisión de seguridad existente, queda pendiente de tu decisión.

## Pregunta
- **A. Publicar el AppImage y recomendar el `.deb`** en Ubuntu, Debian y Mint, declarando el límite en la guía (recomendada). Conserva las dos formas decididas para Linux, y quien use el `.deb` no se ve afectado.
- **B. Publicar el AppImage solo si la 0137 demuestra que conserva el sandbox.** Es la opción más estricta; si la medición sale como se espera, en esas distribuciones el único paquete sería el `.deb`.
- **C. Hacer que la app avise** cuando arranca sin sandbox. Es más honesto, pero añade trabajo y un texto nuevo; se puede sumar a A.

## Opción provisional tomada (si no bloquea)
**A**, solo para los builds internos de esta fase. Nada se publica hasta tu respuesta.

## Respuesta
