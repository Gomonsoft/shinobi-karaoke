# 0140 — Icono de la app en los instaladores
- Estado: Pendiente
- Paso del pipeline: 0 (distribución)
- Depende de: 0130
- ADRs: 0012
- Spec UX: la que resulte de `preguntas/0039`
- ¿Red?: no.

## Objetivo
Sustituir el icono de Electron. Hoy no hay ningún icono en el repositorio: electron-builder avisa de "default Electron icon is used".

## Archivos
`app/build/icon.png` (1024 × 1024) y, si hace falta, `icon.icns` e `icon.ico`.

## Criterios de aceptación
- [ ] Icono del diseñador, de licencia compatible con GPL-3.0 y anotado en `THIRD_PARTY_NOTICES.md` si es de terceros.
- [ ] El log de electron-builder ya no muestra "default Electron icon".
- [ ] Se ve en el instalador NSIS y sus accesos directos, en el Dock y el DMG, y en el menú de aplicaciones de Linux.
- [ ] Tamaños anotados de nuevo en 0136.

## Verificación
```bash
cd app && npm run empaquetar:dir
```

## Notas de implementación
(las rellena el programador al terminar)
