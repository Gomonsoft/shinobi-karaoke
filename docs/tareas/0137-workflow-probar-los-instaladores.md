# 0137 — Workflow `empaquetado.yml`: probar los instaladores
- Estado: Pendiente
- Paso del pipeline: 0 (distribución)
- Depende de: 0136
- ADRs: 0013 §3
- Preguntas: 0038, 0041, 0042, 0043
- ¿Red?: **sí** para descargar artefactos, `npm ci` y `apt`. El humo no. Sin modelos.

## Objetivo
Instalar cada artefacto en un runner limpio y repetir el humo, dejando claro el **nivel** alcanzado.

## Archivos
- `.github/workflows/empaquetado.yml` (trabajo `probar-instalador`);
- `app/scripts/humo-instalador.mjs` si se necesita para no alargar el YAML.

## Contratos
`needs: construir`, `fail-fast: false`. Cada entrada descarga su artefacto, hace `npm ci` y ejecuta `test:paquete` contra lo instalado. Las pasadas sobre lo instalado **no usan `SHINOBI_DATOS` en el caso de los datos conservados**: comprueban la ruta real por SO.

| Entrada | Pasos | Nivel |
|---|---|---|
| `windows-2025` | `Start-Process -Wait` con `/S`; ejecutable en `%LOCALAPPDATA%\Programs\`; humo; arrancar una vez sin `SHINOBI_DATOS` y comprobar `%LOCALAPPDATA%\ShinobiKaraoke`; `Uninstall Shinobi Karaoke.exe /S` y esperar a que desaparezca; **los datos siguen** | Instalación probada |
| `macos-26`, `macos-15` | `hdiutil attach -nobrowse -noautoopen`; `ditto` a un temporal; `hdiutil detach`; `verificar-paquete`; humo. Dato informativo: `spctl --assess --type execute -vv`, sin usarlo como criterio | Instalación parcial |
| `ubuntu-24.04` `.deb` | `sudo apt-get install -y ./*.deb`, **sin** tocar `sysctl`; `/etc/apparmor.d/shinobi-karaoke` existe; humo con xvfb; los procesos **no** llevan `--no-sandbox`; `sudo apt-get remove -y shinobi-karaoke`; datos conservados | Instalación probada |
| `ubuntu-26.04` `.deb` | Igual, `continue-on-error: true` | Instalación probada, informativa |
| `ubuntu-24.04` AppImage | `chmod +x`. **Pasada A**, restricción activa: ejecutar directamente, anotar si los procesos llevan `--no-sandbox` (se espera que sí). **Pasada B**, `sysctl` a 0: anotar (se espera que no). Si el montaje falla por FUSE: `APPIMAGE_EXTRACT_AND_RUN=1` y resultado `fuse: no disponible` | Ejecución directa, o "extraída" si no hay FUSE |

El resumen de la ejecución termina con una tabla: forma, runner, nivel, tamaño, `--no-sandbox` sí o no, FUSE sí o no, y lo que **no** se probó (SmartScreen, Gatekeeper, macOS 14, primer arranque real).

## Criterios de aceptación
- [ ] Ninguna comprobación se debilita para pasar: si algo no se puede ejecutar en un runner, baja de nivel, se anota aquí y en el ADR 0013 §3.
- [ ] Se confirman o corrigen en el ADR 0013 los puntos "sin confirmar": ventana en Windows y macOS, `/dev/fuse`, `macos-15` arm64.
- [ ] Respuesta a `preguntas/0042` actualizada con el resultado real del `.deb` y del AppImage en Ubuntu 24.04.
- [ ] Respuesta a `preguntas/0043` actualizada con la conservación de datos real.
- [ ] Hasta la primera ejecución en GitHub queda en `En curso`.

## Verificación
```bash
cd app && npx vitest run workflow-empaquetado   # sin red: amplía el test de 0136
gh workflow run empaquetado.yml --ref <rama>    # CON RED
```

## Notas de implementación
(las rellena el programador al terminar)
