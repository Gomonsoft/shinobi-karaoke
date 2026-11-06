# 0127 — Dependencias de empaquetado, metadatos y ajustes del repositorio
- Estado: Hecha
- Paso del pipeline: 0 (distribución)
- Depende de: —
- ADRs: 0012 §1, §2
- ¿Red?: sí, solo `npm install` al actualizar `package-lock.json`. Los tests no la usan.

## Objetivo
Dejar `app/` lista para las demás tareas de la Fase 7, sin empaquetar todavía.

## Archivos
`app/package.json`, `app/package-lock.json`, `app/.gitignore`, `app/.prettierignore`, `app/eslint.config.mjs`, `app/vitest.config.mts`, `app/tsconfig.node.json`.

## Contratos
- `devDependencies` con versión **exacta**: `electron-builder` 26.18.0, `@electron/fuses` 2.1.3, `@electron/asar` 4.3.1, `license-checker-rseidelsohn` 5.0.1.
- `lucide-react` pasa de `dependencies` a `devDependencies`. En `dependencies` quedan `zod` y `yaml`.
- Campos nuevos en `package.json`:
  - `author`: `{ "name": "Gomonsoft", "email": "contacto@gomonsoft.com" }` (provisional hasta `preguntas/0035`, punto 4);
  - `homepage`: `https://github.com/Gomonsoft/shinobi-karaoke`;
  - `repository`: el mismo repositorio;
  - `desktopName`: `shinobi-karaoke.desktop`.
- `version` **no cambia** (`preguntas/0036`).
- `release/` ignorado en git, Prettier y ESLint. `resources/bin/uv` y `resources/bin/uv.exe` ignorados en git; `.gitkeep` se conserva.
- Vitest (proyecto `node`) incluye también `scripts/**/*.test.ts`.
- `tsconfig.node.json` incluye `e2e-paquete/**/*`, `scripts/**/*.ts` y `playwright.paquete.config.ts`.

## Criterios de aceptación
- [x] `npm ls --omit=dev --depth=0` muestra solo `zod` y `yaml`.
- [x] El renderer sigue compilando con `lucide-react` como dependencia de desarrollo.
- [x] `npx playwright test` y `npm test` no cambian de resultado.
- [x] `ci.yml` no se toca.

## Verificación
```bash
cd app
npm install
npm run lint && npm run typecheck && npm run format:check
npm test
npm audit --omit=dev --audit-level=high
npm run build
```

## Notas de implementación
Se añadieron las cuatro devDependencies exactas (electron-builder 26.18.0, @electron/fuses 2.1.3, @electron/asar 4.3.1, license-checker-rseidelsohn 5.0.1) y se movió lucide-react a devDependencies (el renderer lo empaqueta Vite, por lo que no se necesita en runtime). En dependencies quedan zod y yaml. Se añadieron author, homepage, repository y desktopName tras license; version no cambia. release/ queda ignorado en git, Prettier y ESLint; resources/bin/uv y uv.exe en git. Vitest (proyecto node) incluye scripts/**/*.test.ts y tsconfig.node.json incluye e2e-paquete, scripts/**/*.ts y playwright.paquete.config.ts. ci.yml no se tocó.

Archivos: app/package.json, app/package-lock.json, app/.gitignore, app/.prettierignore, app/eslint.config.mjs (Prettier reformateó el array de ignores), app/vitest.config.mts, app/tsconfig.node.json.

Verificación: lint, typecheck y format:check limpios; npm ls --omit=dev --depth=0 muestra solo yaml y zod; npm audit --omit=dev: 0 vulnerabilidades; npm run build correcto. npm test: en la primera pasada falló Reproductor.estados.test.tsx (prueba de tiempo sensible a la carga) y pasó al repetir el archivo (10/10); el resto pasó.

Deuda técnica: npm avisa de que electron-winstaller (install script select-7z-arch.js) no está cubierto por allowScripts; lo decidirá la tarea 0130 si hace falta.

**Cierre (2026-11-06).** En Node 24.22.1, lint, typecheck, format:check, `npm test`, `npm run build` y `npx playwright test --workers=1` terminaron correctamente. Playwright: 91 aprobados y 2 omitidos por depender de red. Ejecutarlo con un solo worker evitó el límite de memoria del equipo. `npm audit --omit=dev --audit-level=high` reportó 0 vulnerabilidades en la revisión previa. No se modificó `ci.yml`.
