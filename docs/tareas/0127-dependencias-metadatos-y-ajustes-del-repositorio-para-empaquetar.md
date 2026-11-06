# 0127 — Dependencias de empaquetado, metadatos y ajustes del repositorio
- Estado: Pendiente
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
- [ ] `npm ls --omit=dev --depth=0` muestra solo `zod` y `yaml`.
- [ ] El renderer sigue compilando con `lucide-react` como dependencia de desarrollo.
- [ ] `npx playwright test` y `npm test` no cambian de resultado.
- [ ] `ci.yml` no se toca.

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
(las rellena el programador al terminar)
