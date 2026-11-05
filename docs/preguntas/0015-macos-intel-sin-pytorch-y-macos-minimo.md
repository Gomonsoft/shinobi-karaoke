# 0015 — macOS Intel sin PyTorch y versión mínima de macOS para Apple Silicon
- De: programador
- Para: arquitecto
- Estado: Respondida
- Bloquea: no (opción provisional tomada en la tarea 0030)

## Contexto
Al generar los requisitos bloqueados (tarea 0030, `uv pip compile` 0.13.7, `audio-separator==0.48.0`) aparecen dos hechos que contradicen las suposiciones de las specs y del ADR 0009 §1:

1. **`darwin-x64-cpu` no se puede resolver.** audio-separator 0.48.0 exige `torch>=2.3` en macOS Intel y PyTorch no publica ruedas de macOS x86_64 posteriores a la 2.2.2 (en PyPI solo hay `macosx_14_0_arm64`, `manylinux_2_28_*` y `win_amd64` para torch 2.15). uv falla con «torch>=2.3.0 has no wheels with a matching platform tag (e.g. `macosx_13_0_x86_64`)». Instalar una versión anterior de audio-separator o forzar torch 2.2.2 (con NumPy 1.x) rompe la reproducibilidad y el parche de audio-separator (0009).
2. **Apple Silicon necesita macOS 14 o posterior**: torch 2.15, onnxruntime 1.31.1 y audio-separator 0.48.0 solo publican ruedas `macosx_14_0_arm64`. Las specs (`ux/01` línea de requisitos y `arquitectura.md` "Restricciones" §8) dicen «macOS 12 o posterior».

## Pregunta
- ¿Se retira macOS Intel del MVP? La plataforma `darwin-x64` quedaría sin entrada en el manifiesto y mostraría B6 («Tu equipo no es compatible todavía», `preguntas/0013` §2).
- ¿Se sube el mínimo de macOS a 14 (Sonoma) y se corrigen los textos de requisitos (`ux/01`) y `arquitectura.md`? (Diseñador: el texto «macOS 12 o posterior» pasaría a «macOS 14 o posterior».)
- Alternativa para Intel: usar solo ONNX Runtime (modelo Rápido) sin PyTorch, lo que exige una versión de audio-separator o un adaptador propio que no dependa de torch (sin evaluar).

## Opción provisional tomada (si no bloquea)
- `worker/requisitos/darwin-x64-cpu.txt` **no se genera**: el script `compilar_requisitos.py` lo omite con el mensaje anterior y el manifiesto no incluye `darwin-x64` (`requisitosDe` devuelve `null` → `PLATAFORMA_NO_SOPORTADA`, B6). Un test lo comprueba.
- El requisito de macOS 14 se deja anotado aquí; no se tocan las specs ni los ADR.

## Respuesta
(arquitecto, 2026-11-04)

### Datos comprobados (PyPI, 2026-11-04)
| Paquete | Última con rueda macOS x86_64 (cp312) | Etiqueta macOS arm64 de la versión fijada |
|---------|---------------------------------------|-------------------------------------------|
| torch | **2.2.2** (`macosx_10_9_x86_64`); desde 2.3 solo arm64 | 2.15.0 → `macosx_14_0_arm64` (desde 2.12; 2.11 era `macosx_11_0`) |
| onnxruntime | **1.23.2** (`macosx_13_0_x86_64`); desde 1.24 solo arm64 | 1.31.1 → `macosx_14_0_arm64` |
| av (dependencia **base** del worker, no del *extra*) | 19.0.2 sí (`macosx_11_0_x86_64`) | 19.0.2 → `macosx_14_0_arm64` |
| audio-separator 0.48.0 | — | exige `torch>=2.13` en macOS arm64 y `torch>=2.3` en el resto; `numpy>=2` |
| audio-separator ≤ 0.30 | — | `torch>=2.3,<2.5` y `numpy<2`; las anteriores (~0.20) sin cota de torch pero con `numpy<2` |

Además: Apple anunció que macOS 26 (Tahoe) es la última versión para Mac Intel; GitHub retiró el *runner* `macos-13` (Intel) y solo mantiene `macos-15-intel` de forma temporal. Todos los Mac Apple Silicon (M1 en adelante) pueden actualizar gratis a macOS 14 o posterior.

### 1. Mínimo de macOS en Apple Silicon → **macOS 14 (decisión técnica)**
No es dejar fuera a nadie: cualquier Mac Apple Silicon puede actualizar a macOS 14 gratis. No hay alternativa razonable: bajar a macOS 11–13 obligaría a fijar torch ≤ 2.11 (incompatible con audio-separator 0.48.0 en arm64), onnxruntime ≤ 1.23 y **av** (que usa también la importación de archivos, no solo la separación) a una versión antigua. Decidido:
- Requisito: **macOS 14 (Sonoma) o posterior en Apple Silicon**. Se corrigen `arquitectura.md` "Restricciones" §8 y ADR 0001/0009 (Revisiones).
- Comprobación en la app (no en el `Info.plist`, para dar un mensaje propio con "Pedir soporte"): plataforma `darwin` con `process.getSystemVersion()` < 14 → **no soportada** → B6. El instalador mantiene el mínimo propio de Electron (inferior a 14; no se sube `LSMinimumSystemVersion`) para que la app llegue a abrir y mostrar B6.
- Texto de B6 y de requisitos: `preguntas/0017` (diseñador UX).

### 2. macOS Intel → alternativas (la exclusión es de producto: `preguntas/0016`, para el usuario)
| Opción | Coste | Licencia / riesgo |
|--------|-------|-------------------|
| A. audio-separator antiguo (≤ 0.20–0.30) + torch 2.2.2 + NumPy 1.x solo para Intel | Segundo conjunto de dependencias y segundo parche de `check_ffmpeg_installed` (método interno, cambia entre versiones); el modelo Calidad (MelBand RoFormer) y el renombrado de stems hay que revalidarlos; `Separador` con dos ramas; CI propia en un *runner* Intel que desaparece. Ninguna actualización futura de torch para Intel. | MIT/BSD, sin cambio. **Riesgo de seguridad**: torch < 2.6 tiene CVE-2025-32434 (`torch.load` con `weights_only=True` ejecuta código); mitigado solo en parte por el SHA-256 de los modelos. |
| B. Solo modelo Rápido con ONNX Runtime, sin torch: adaptador propio (MDX-Net: STFT, troceado y solapamiento con numpy, portado de audio-separator, MIT con atribución) y `onnxruntime==1.23.2` | ~300 líneas de inferencia propias más pruebas de equivalencia con audio-separator; requisitos `darwin-x64-cpu` aparte (onnxruntime 1.23.2 exige **macOS 13** en Intel); sin modo Calidad en Intel (Ajustes lo ocultaría); onnxruntime congelado. | Código MIT/BSD compatible. **Depende por completo del modelo Rápido, que es provisional con licencia no declarada** (`preguntas/0012`): si UVR no responde o hay que cambiarlo por un modelo no ONNX, Intel se queda sin separación. |
| C. **Declarar Mac Intel no compatible en el MVP** (recomendada) | Ninguno: ya implementado en 0030 (sin entrada `darwin-x64` → B6). Solo se publica el DMG arm64. | Ninguno. Grupo de usuarios decreciente y sin futuro en macOS. |

Recomendación al usuario: **C** en el MVP, con B como posible mejora post-MVP solo si hay demanda (incidencias "Pedir soporte") **y** el modelo Rápido tiene licencia aclarada. A se descarta en cualquier caso (seguridad y mantenimiento).

**Mientras el usuario no responda**, se mantiene la opción provisional de 0030 (sin `darwin-x64`) y la tarea 0025 genera **solo el DMG arm64**: un Mac Intel no puede abrir ese DMG, así que el requisito debe figurar en la página de descarga (`preguntas/0017`). B6 para Intel solo se vería con un build x64, que no se publica.

### 3. Cambios hechos
- ADR 0001, 0004 y 0009: Revisiones de 2026-11-04 (esta respuesta). `arquitectura.md` §8 corregido.
- ADR 0009 §1: las combinaciones pasan a 5 (`darwin-x64-cpu` retirada); `darwin-arm64-mps` se resuelve en modo `--universal` (hallazgo 2 de 0030), y la instalación usa `--index-strategy unsafe-best-match` (hallazgo 3).
- Tareas: 0034 (estrategia de índices; macOS < 14 → `PLATAFORMA_NO_SOPORTADA` también en la fase "Plataforma", por defensa), 0025 (solo DMG arm64), 0037 (texto de B6 según `preguntas/0017`), 0040 (5 archivos de requisitos). Backlog actualizado.
- **Nota para 0031 (en curso; no se edita la tarea)**: `plataformaSoportada`/detección previa debe tratar `darwin` con `process.getSystemVersion()` < 14 como no soportada (B6), con un test (macOS 13.6 arm64 → no soportada; 14.0 → `darwin-arm64`/`mps`). Si 0031 se cierra sin ello, lo cubre el criterio añadido a 0034 y el programador lo anota en las notas de 0031.
