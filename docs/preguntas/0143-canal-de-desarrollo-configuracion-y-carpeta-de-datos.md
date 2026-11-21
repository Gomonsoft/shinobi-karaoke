# 0143 — Canal de compilaciones de desarrollo: configuración en GitHub y carpeta de datos compartida
- De: arquitecto
- Para: usuario
- Estado: Abierta
- Bloquea: no. Sin esta configuración, la compilación nocturna se omite en verde y lo demás de `0.2.0-alpha.2` funciona igual (ADR 0020, «Revisión para 0.2.0 — fase 10», §1 y §6). Solo bloquea que aparezcan compilaciones en `shinobi-karaoke-builds`.

## Contexto
La fase 10 añade un canal de compilaciones de `develop` en un repositorio aparte (ADR 0020, revisión de la fase 10; tareas 0251 y 0253). Para publicar en otro repositorio, el workflow necesita una credencial con escritura sobre él, y esa credencial solo puedes crearla tú. Además, al diseñar el canal sale una decisión de producto: si una compilación de desarrollo es la misma app que la versión publicada o una app aparte.

## Pregunta
1. **Configuración (pasos tuyos, cuando quieras activar el canal):**
   1. Crea el repositorio **público** `Gomonsoft/shinobi-karaoke-builds` con un commit inicial: el README que fija la spec 09 §3b. Opcional: activa *immutable releases* en él (Settings → General → Releases).
   2. Crea un **token *fine-grained*** (Settings de tu cuenta → Developer settings → Fine-grained tokens) con: propietario `Gomonsoft`; *Repository access*: **Only select repositories** → `shinobi-karaoke-builds`; permiso de repositorio **Contents: Read and write** (Metadata: Read se añade solo); caducidad de un año como máximo. Si la organización exige aprobar tokens, apruébalo.
   3. En `Gomonsoft/shinobi-karaoke` → Settings → Secrets and variables → Actions: crea el **secreto** `COMPILACIONES_TOKEN` con el token y la **variable** `COMPILACIONES_REPO` = `Gomonsoft/shinobi-karaoke-builds`.
   4. Recomendado: protege `develop` contra *force push* y borrado (Settings → Rules). La GPL obliga a que el código de cada compilación siga disponible, y cada compilación enlaza a su commit de `develop`.
   5. Apunta en tu calendario la renovación del token: si caduca, el trabajo `publicar-desarrollo` falla (en rojo) hasta que lo cambies.

   El disparador nocturno empieza a funcionar cuando `empaquetado.yml` llegue a `main`, con la fusión de `0.2.0-alpha.2`. Antes, una compilación se puede lanzar a mano con `gh workflow run empaquetado.yml --ref develop`.

2. **¿Una compilación de desarrollo es la misma app que la versión publicada?**
   - **A (provisional, recomendada):** misma app. Se instala en lugar de la versión que tengas y usa tu misma biblioteca y el mismo motor de audio ya descargado. Riesgo: si guardas canciones con una compilación que cambia el formato de la biblioteca, puede que la versión publicada anterior no las abra. El aviso de cada compilación pide copiar la carpeta `biblioteca` antes de instalar.
   - **B:** app aparte («Shinobi Karaoke (desarrollo)»), con otra carpeta de instalación, otra carpeta de datos y otro icono en el menú. Las dos conviven sin riesgo, pero la primera vez hay que descargar otra vez el motor de audio (de 1 a 6 GB según el equipo), y hace falta trabajo nuevo: otro `appId` y otro nombre en el empaquetado, en el instalador y en los textos. No entraría en `0.2.0-alpha.2`.

## Opción provisional tomada (si no bloquea)
Punto 2: **A**. Los textos de la spec 09 §3b ya la recogen. Si eliges B, se registra como propuesta para una versión posterior.

## Respuesta
