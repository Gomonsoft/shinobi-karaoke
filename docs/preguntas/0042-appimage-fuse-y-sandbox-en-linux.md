# 0042 — AppImage en Linux: FUSE, sandbox y cuál recomendar
- De: disenador-ux
- Para: arquitecto
- Estado: Respondida en lo técnico; arranque en Ubuntu 24.04 con la restricción activa por medir en las tareas 0137 y 0139
- Bloquea: no en la Fase 7; sí para dar por definitiva la guía de Linux de `ux/09`, antes de la primera versión pública

## Contexto
ADR 0001 llama "principal" al AppImage, pero para un usuario no técnico hay dos riesgos:
- **FUSE**: la documentación de AppImage indica `libfuse2` y que en Ubuntu 24.04 el paquete pasa a ser `libfuse2t64`. No he podido confirmar si el runtime que usa nuestra versión de electron-builder sigue necesitándolo.
- **Sandbox**: según informes de usuarios y el error 2046844 de Launchpad, la restricción de AppArmor sobre los espacios de nombres sin privilegios en Ubuntu 24.04 impide arrancar muchas apps Electron empaquetadas como AppImage ("SUID sandbox helper"). No es documentación oficial y no está probado con nuestra app. Las soluciones que circulan (`--no-sandbox` o desactivar la restricción) debilitan la seguridad, y ADR 0008 exige `sandbox`.

## Pregunta
1. ¿Nuestro AppImage necesita `libfuse2`? Si es así, ¿son correctos los comandos de `ux/09` (`libfuse2t64` en Ubuntu 24.04 o posterior, `libfuse2` en Ubuntu 22.04 y Debian)?
2. ¿Arranca nuestro AppImage en Ubuntu 24.04 o posterior sin cambios en el sistema? ¿Y el `.deb`? Pido probar ambos en la tarea 0025.
3. Si el AppImage no arranca: ¿hay solución técnica en el paquete (por ejemplo, un perfil de AppArmor en el `.deb`)? Para el AppImage, ¿qué recomendamos sin desactivar el sandbox?
4. ¿Qué recomienda la guía: `.deb` en Ubuntu, Debian y Mint, y AppImage en el resto (provisional), o AppImage primero como dice ADR 0001?
5. ¿Qué distribuciones y versiones mínimas se pueden declarar (versión de glibc)? Hoy solo decimos "Linux de 64 bits".

## Opción provisional tomada (si no bloquea)
`.deb` para Ubuntu, Debian y Linux Mint, y AppImage para el resto. La guía incluye los comandos de FUSE. Ante un error de "sandbox", propone probar el `.deb` o abrir una incidencia, **sin** recomendar `--no-sandbox`.

## Respuesta
(arquitecto, 2026-11-06; ADR 0012. Probado en WSL2 con Ubuntu, sin AppArmor activo. **Falta medir en Ubuntu 24.04 con la restricción activa**: tareas 0137 y 0139.)

1. **`libfuse2`: no hace falta.** Se configura `toolsets.appimage: "1.0.3"` (runtime estático). Comprobado: nuestro AppImage arranca montado con FUSE en un sistema que solo tiene `libfuse3`. Sí necesita FUSE en el sistema; sin él, se puede ejecutar extraído. Electron-builder etiqueta ese conjunto como "beta": si fallara, volveríamos al heredado, que sí necesita `libfuse2` y siempre lanza `--no-sandbox`.
2. **Ubuntu 24.04 o posterior**:
   - **`.deb`**: instala un perfil de AppArmor propio (`userns`) con su `postinst`; se espera que arranque **con sandbox**. Sale del código de la plantilla. Lo prueba 0137 de verdad, instalando sin tocar el sistema.
   - **AppImage**: su `AppRun` ejecuta `unshare -Ur true` y, si falla, añade `--no-sandbox` por su cuenta. Con la restricción activa se espera que **arranque sin sandbox de SO**, sin que el usuario haga nada y sin avisarle. No se ha ejecutado con la restricción: lo mide 0137.
3. **Solución técnica**: el `.deb` ya la lleva. Para el AppImage no hay perfil posible sin privilegios. **Limitación provisional, pendiente de la decisión del usuario en `preguntas/0045`** (ADR 0012, Consecuencias): se mantienen el aislamiento de contexto y la ausencia de Node en el renderer, pero no el sandbox del SO que pide el ADR 0008. La guía no recomienda nada relacionado: ni `--no-sandbox` ni desactivar la restricción.
4. **Recomendación**: la tuya. **`.deb` en Ubuntu, Debian y Linux Mint; AppImage en el resto.** Sustituye a "AppImage (principal)" del ADR 0001 (Revisión 2026-11-06).
5. **Requisito**: glibc **≥ 2.28**, la que marcan las ruedas de PyTorch (`manylinux_2_28`). Electron pide 2.25 y `uv` 2.17 (medido con `objdump`). Pero **solo se prueba Ubuntu 24.04** (y 26.04, informativo). Propuesta: seguir con "Linux de 64 bits" y añadir, si quieres, "Probado en Ubuntu 24.04", sin nombrar glibc al usuario. La lista de distribuciones se puede ampliar con datos de 0139.

**Impacto en `ux/09`** (a tu cargo):
- **Quitar los comandos de `libfuse2` y `libfuse2t64`** de "¿Sigue sin abrirse?". Si el AppImage da un error de FUSE, remitir al `.deb` o a abrir una incidencia.
- "Sandbox": con el fallback automático este error debería ser raro. La entrada se puede dejar, sin `--no-sandbox`.
- ⟦R0042⟧ de "cuál elegir": se confirma el texto provisional.
- Valora si conviene decir, sin tecnicismos, que en Ubuntu es preferible el `.deb`. El motivo real es el sandbox. Esperaría al resultado de 0137 para redactarlo.
