# 0044 — ¿Qué decimos a quien tiene activado el Control inteligente de aplicaciones de Windows 11?
- De: disenador-ux
- Para: usuario
- Estado: Abierta
- Bloquea: no en la Fase 7; sí para cerrar esa entrada de la guía, antes de la primera versión pública

## Contexto
Cuando decidiste publicar sin firma (pregunta 0001), el aviso previsto en Windows era SmartScreen, que se puede saltar con "Más información → Ejecutar de todas formas". Pero Windows 11 tiene además otra protección, el **Control inteligente de aplicaciones**. Según Microsoft, bloquea las aplicaciones sin firma, y **"no hay ninguna manera de omitir la protección" para una aplicación concreta**: solo se puede desactivar por completo desde Seguridad de Windows o conseguir que la aplicación esté firmada.

Por tanto, quien la tenga activada no podrá instalar Shinobi Karaoke siguiendo la guía. No sé cuántos usuarios están en ese caso.

## Pregunta
¿Qué hacemos con estos usuarios?

- **A. Explicarlo sin recomendar desactivarla** (recomendada). La guía dice qué ocurre, que mientras no firmemos no se puede instalar con esa protección activada, y enlaza la página de Microsoft. Es la opción honesta y no empuja a nadie a bajar una protección de todo el equipo, pero esos usuarios probablemente se queden sin instalar.
- **B. Dar los pasos para desactivarla**, avisando de que afecta a todo el equipo. Instalarán más personas, pero el proyecto estaría recomendando reducir su seguridad.
- **C. Lo mismo que A, y además revisar la firma solo para Windows** (la pregunta 0001 ya citaba servicios gratuitos para software libre como SignPath, sujetos a aceptación). Sería la única solución real, pero requiere solicitarlo y cambia tu decisión de no firmar en el MVP; el arquitecto tendría que evaluarla.

## Opción provisional tomada (si no bloquea)
A. Es el texto que hay ahora en `ux/09`. El texto real de la ventana de Windows se comprobará en la prueba manual.

## Respuesta
