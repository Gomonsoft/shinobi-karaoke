# 0140 — Icono de la app en los instaladores
- Estado: En curso
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
- [x] Icono del diseñador, de licencia compatible con GPL-3.0 y anotado en `THIRD_PARTY_NOTICES.md` si es de terceros.
- [x] El log de electron-builder ya no muestra "default Electron icon".
- [ ] Se ve en el instalador NSIS y sus accesos directos, en el Dock y el DMG, y en el menú de aplicaciones de Linux.
- [ ] Tamaños anotados de nuevo en 0136.

## Verificación
```bash
cd app && npm run empaquetar:dir
```

## Notas de implementación
Se rasterizó el SVG de `ux/sistema-visual.md` §1.1 en `app/build/icon.png`.
Es de creación propia y se distribuye bajo la licencia del proyecto.
Se comprobaron RGBA, 1024 × 1024, los píxeles de referencia y la legibilidad del rombo
al reducir a 16, 32, 48 y 256 px.

Electron Builder encontró el PNG en el directorio de recursos configurado en 0130.
`npm run empaquetar:dir` completó el empaquetado en macOS arm64 usando la copia local
de Electron y una caché temporal para el conversor. El log no mostró el aviso del
icono de Electron. El `Info.plist` registra el `icon.icns` generado y
`npm run paquete:verificar` pasó con la firma ad hoc y los fuses esperados.

El DMG local de macOS arm64 pesó 135 870 492 bytes (135,9 MB). Al montarlo en
solo lectura se comprobó que el icono del volumen y el de la app instalada
coinciden byte a byte con el `icon.icns` generado. Queda la comprobación visual
en el Dock.

Pendiente: comprobar el icono en NSIS y sus accesos directos y en el menú de Linux,
y anotar los tamaños de los cuatro instaladores en 0136 cuando se ejecute su workflow.
