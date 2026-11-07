# 0132 — Avisos de terceros: dependencias JS y `uv`
- Estado: Hecha
- Paso del pipeline: 0 (distribución)
- Depende de: 0127
- ADRs: 0012 §7; 0002
- ¿Red?: no, una vez hecho `npm ci`.

## Objetivo
Completar `THIRD_PARTY_NOTICES.md` con lo que el instalador distribuye de verdad. La regeneración es reproducible y comprobable.

## Archivos
- `app/scripts/licencias-js.mjs` y `app/scripts/licencias-js.test.ts`;
- scripts `licencias` y `licencias:comprobar` en `app/package.json`;
- `THIRD_PARTY_NOTICES.md`.

## Contratos
1. **Paquetes distribuidos** = unión de:
   - los `node_modules/<paquete>` citados en los `.map` de `electron-vite build --sourcemap --outDir <temporal>`. Comprobado hoy: `lucide-react`, `react`, `react-dom`, `scheduler`, `zod`;
   - `npm ls --omit=dev --all --json`: hoy `yaml`, `zod`.
   
   `license-checker --production` **no basta**: omite `react-dom` y `scheduler`, y añade `@types/react` y `csstype`, que no se distribuyen.
2. Para cada uno, nombre, versión, licencia y texto completo de `license-checker-rseidelsohn` 5.0.1, sobre `node_modules`. Se excluye `shinobi-karaoke`.
3. Licencias admitidas: MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, 0BSD, BlueOak-1.0.0. Otra licencia o un texto ausente: error. Una ampliación pasa por el arquitecto (ADR 0002).
4. El resultado va entre `<!-- inicio:dependencias-js -->` y `<!-- fin:dependencias-js -->`, ordenado y sin fechas, para que sea estable en los 3 SO.
5. Texto fijo que se añade:
   - **`uv`** 0.13.7, Apache-2.0 o MIT, © Astral Software Inc., con el texto de las dos licencias. Tomar los textos del repositorio de `astral-sh/uv` en la etiqueta 0.13.7, comprobar el titular y guardarlos en `app/resources/licencias/`;
   - **Electron**: remite a `LICENSE.electron.txt` y `LICENSES.chromium.html`, incluidos en cada paquete.
6. Se quitan "lista completa pendiente de la tarea de empaquetado" y la frase de que React es la única dependencia de ejecución.
7. `--comprobar` regenera en memoria y falla si difiere del archivo.

## Criterios de aceptación
- [ ] Tests sin red: extracción de paquetes desde mapas con rutas POSIX y Windows, paquetes con ámbito, licencia prohibida, licencia sin texto, comparación estable.
- [ ] `npm run licencias:comprobar` pasa en Linux y Windows.
- [ ] El archivo se sigue viendo como texto en `ux/08`: nada de HTML en bruto (ADR 0008).
- [ ] `textoLegal.test.ts` sigue en verde.
- [ ] Si otra tarea añade un paquete distribuido, la comprobación falla hasta regenerar.

## Verificación
```bash
cd app
npx vitest run licencias-js
npm run licencias:comprobar
```

## Notas de implementación
Se creó `app/scripts/licencias-js.mjs`: genera mapas de fuentes en un directorio temporal, extrae paquetes de rutas POSIX/Windows (incluidos nombres con ámbito), los une con el árbol de `npm ls --omit=dev --all`, y obtiene versiones, licencias y textos completos con `license-checker-rseidelsohn`. Falla ante paquetes no registrados, licencias no admitidas o textos ausentes. El bloque es estable, ordenado y queda entre marcadores; `--comprobar` lo regenera en memoria y compara el archivo. También se fijaron los scripts `licencias` y `licencias:comprobar`.

Se añadieron los textos oficiales Apache-2.0 y MIT de Astral en la etiqueta `uv` 0.13.7 (`app/resources/licencias/`); el texto MIT confirma © 2025 Astral Software Inc. `THIRD_PARTY_NOTICES.md` ahora lista las seis dependencias distribuidas hoy (`lucide-react`, `react`, `react-dom`, `scheduler`, `yaml`, `zod`), sus textos completos, los dos textos de licencia de `uv` y dónde consultar los avisos de Electron. Se quitaron la frase de React como única dependencia y la lista pendiente. `leerTextoLegal` oculta solo las líneas de marcadores para no mostrarlas en el diálogo como HTML.

Archivos: `app/scripts/licencias-js.mjs`, `app/scripts/licencias-js.d.mts`, `app/scripts/licencias-js.test.ts`, `app/resources/licencias/LICENSE-APACHE.txt`, `app/resources/licencias/LICENSE-MIT.txt`, `app/package.json`, `app/src/main/textoLegal.ts`, `app/src/main/textoLegal.test.ts`, `THIRD_PARTY_NOTICES.md`.

Verificación: `npx vitest run licencias-js textoLegal` (10/10), `npm run licencias`, `npm run licencias:comprobar`, lint, typecheck y format:check pasan. La suite completa serial con permisos para fixtures locales: 134 archivos aprobados, 1 omitido, 1 test fallido por una carrera en `Editor.test.tsx` (motor de prueba aún no había recibido opciones); repetido aislado, el archivo pasó 12/12. Los tests de las licencias y `textoLegal` pasan.

Deuda: la verificación completa en Linux y Windows queda para CI (0136–0137); no se añadieron paquetes.
