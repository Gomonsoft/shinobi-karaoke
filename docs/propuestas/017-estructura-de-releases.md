# 017 — Estructura de releases inspirada en RPCS3 y DroidDeck

- Estado: Aceptada (versión 0.2.0, fase 10)
- Origen: usuario (2026-11-21), tras la prueba de 0.2.0-alpha.1
- Fecha: 2026-11-21
- Relacionadas: [ADR 0020](../adr/0020-publicacion-en-github-releases-y-politica-de-versiones.md), [ADR 0013](../adr/0013-workflow-de-empaquetado-y-prueba-de-la-app-empaquetada.md), [spec 09](../ux/09-descarga-e-instalacion.md), preguntas 0036, 0037, 0040, 0044 y 0141, [feedback de alpha.1](../versiones/0.2.0/feedback-alpha-1.md)

## Problema

El proyecto ya tiene el workflow de publicación por etiqueta (ADR 0020), pero **todavía no hay ninguna etiqueta ni Release publicada**. Para probar 0.2.0-alpha.1 hubo que bajar el zip de artefactos de GitHub Actions, que Chrome bloqueó y que caduca a los 14 días. Tampoco hay forma de saber de qué commit salió una compilación: el error de exportación solo decía «Versión: 0.2.0-alpha.1».

## Qué hacen los referentes

Leído el 2026-11-21 en sus páginas de GitHub. La página de descargas de rpcs3.net no se pudo leer (HTTP 403).

| | RPCS3 | DroidDeck |
|---|---|---|
| Versiones | Etiquetas `v0.0.43`, título «v0.0.43 Alpha», cada dos meses aprox. Son hitos, no versiones estables: lo dicen las propias notas | Etiquetas `0.7.1` sin «v», título «DroidDeck 0.7.1», cada pocos días. Todas marcadas como *immutable release* |
| Compilaciones continuas | Un repositorio de binarios por sistema (`rpcs3-binaries-win`, `-linux`, `-mac`). Etiqueta `build-<hash>`, título `0.0.43-20291`, cuerpo con SHA-256 y tamaño | No en GitHub: las «preview builds» van por Discord |
| Notas | «What's Changed» con la lista de PR y autores, más el aviso de bajar siempre la última compilación de su web | Resumen en una frase, «Features», «Fixed», tabla de colaboradores, enlace «Full changelog» y qué ejecución de CI construyó y firmó |
| Archivos | Con versión y hash en el nombre (`rpcs3-v0.0.12-10987-ffea52dc_linux64.AppImage`) | Con versión en el nombre (`DroidDeck-0.7.1.apk`) y `SHA256SUMS.txt` |
| README | Remite a la web para descargar | Insignia de descarga directa a la última versión, capturas animadas y pasos de instalación numerados. Avisa de bajar solo desde Releases |

## Propuesta

Mantener lo que ya decide el ADR 0020 (etiqueta → borrador → recursos → publicar, `SHA256SUMS.txt`, *pre-release* para las alfas) y añadir cinco cosas:

1. **Publicar de verdad la primera Release.** Etiquetar `v0.2.0-alpha.1` (o `alpha.2` con las correcciones de la fase 7) para que la descarga salga de Releases y no de Actions. Es el paso que más cambia y no requiere trabajo nuevo.
2. **Canal de compilaciones de desarrollo, como RPCS3.** Un repositorio aparte, `shinobi-karaoke-builds`, con una Release por compilación de `develop`: etiqueta `build-<hash>`, título `0.2.0-alpha.1-<N>` y el SHA-256 en el cuerpo. Así las Releases del repositorio principal quedan limpias y «latest» sigue significando «última versión».
3. **Número de compilación visible.** `<versión>-<N>` con N = número de commits, mostrado en «Acerca de» y en los detalles de error que se copian. Un reporte indica entonces el commit exacto.
4. **Notas con dos partes, como DroidDeck.** Arriba las notas escritas a mano que ya existen (`docs/versiones/<X.Y.Z>/notas/`); debajo, siempre, «Qué cambió» generado por GitHub con los PR y el enlace de comparación, y la ejecución de CI que construyó los instaladores.
5. **README con descarga directa.** Insignia o botón por sistema que lleve al instalador de la última versión, pasos numerados y el aviso de bajar solo desde Releases. Mientras solo haya alfas, el enlace debe apuntar a la etiqueta concreta, porque `/releases/latest` ignora las *pre-releases* (ADR 0020 §5).

Lo que **no** se copia:

- El modelo de RPCS3 de «no hay versiones estables»: Shinobi Karaoke sí aspira a una 1.0 estable.
- Las compilaciones por Discord de DroidDeck: dejan fuera a quien no está en el canal.
- La autoactualización: sigue aplazada (pregunta 0037).

## Valor y coste

- **Valor.** Descargas desde un sitio con mejor reputación que los artefactos de Actions, enlaces que no caducan, reportes con el commit exacto y una página de versiones que se entiende de un vistazo. La página de descargas sirve además como «home page» para la solicitud de firma a SignPath.
- **Coste estimado.**
  - Punto 1: S. Solo etiquetar; el workflow ya existe y está ensayado.
  - Puntos 3, 4 y 5: S cada uno. Tocan `version.mjs`, `empaquetado.yml`, «Acerca de» y el README.
  - Punto 2: M. Repositorio nuevo, un secreto con permiso de escritura sobre él y un disparador nuevo en el workflow.
- **Riesgos o dudas abiertas.**
  - El punto 2 necesita un token con escritura en otro repositorio: es un secreto que custodiar. La alternativa sin secreto es publicar las compilaciones como *pre-releases* del repositorio principal, a costa de llenar su lista.
  - Empaquetar los tres sistemas en cada fusión gasta mucho tiempo de CI. Opción: una compilación nocturna solo si hubo cambios, o solo Windows y Linux.
  - Los nombres de instalador no llevan versión a propósito (pregunta 0040), para que los enlaces del README no cambien. Ponerla como hacen los dos referentes obliga a actualizar el README en cada versión, como le pasa a DroidDeck.
  - Mientras el instalador siga sin firmar, Chrome y SmartScreen avisarán también desde Releases.

## Decisión

Aceptada por el usuario el 2026-11-21 como fase «Detalles de release» de `0.2.0-alpha.2` ([plan, fase 10](../versiones/0.2.0/plan-2.md#fase-10--detalles-de-release)).

El usuario aprobó la propuesta en conjunto. En las dos dudas abiertas se aplican las recomendaciones de la sesión principal, que el usuario puede cambiar al revisar el desglose:

- Canal de desarrollo en un repositorio aparte, con compilación nocturna solo si hubo cambios.
- Los instaladores de las versiones conservan su nombre sin versión; solo los del canal de desarrollo la llevan.
