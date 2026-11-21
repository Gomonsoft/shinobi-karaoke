#!/usr/bin/env python3
"""Prueba de concepto del ADR 0019: codificar fotogramas BGRA + audio con PyAV.

No es código de producción. Se ejecuta con el entorno del worker:

    cd worker
    uv run python ../docs/poc/0019-exportacion/codificar.py --perfil av1 --ancho 1920 --alto 1080 \
        --fps 30 --segundos 10 --salida /tmp/x.mkv              # fotogramas sintéticos
    ... --stdin                                                 # fotogramas BGRA por stdin

Fotogramas sintéticos «tipo karaoke»: fondo degradado fijo, dos renglones de «texto» (bloques)
y un barrido que avanza, más una marca de agua. Es un contenido parecido al real: casi estático,
con cambios pequeños entre fotogramas.

Audio: dos pistas sintéticas (instrumental y voz) de la misma duración que el video, mezcladas
en float con ganancia de voz, normalizadas por pico y codificadas en Opus 48 kHz estéreo.

Imprime un JSON con tiempos, tamaño, memoria y duraciones leídas del archivo resultante.
"""

from __future__ import annotations

import argparse
import json
import resource
import sys
import time
from fractions import Fraction
from pathlib import Path

import av
import numpy as np

PERFILES = {
    # contenedor, códec de video, opciones del codificador
    "av1": ("matroska", "libsvtav1", {"preset": "10", "crf": "35"}),
    "av1-p8": ("matroska", "libsvtav1", {"preset": "8", "crf": "35"}),
    "av1-p12": ("matroska", "libsvtav1", {"preset": "12", "crf": "35"}),
    "vp9": (
        "webm",
        "libvpx-vp9",
        {"deadline": "realtime", "cpu-used": "8", "row-mt": "1", "crf": "33", "b": "0"},
    ),
    "vp9-good": (
        "webm",
        "libvpx-vp9",
        {"deadline": "good", "cpu-used": "5", "row-mt": "1", "crf": "33", "b": "0"},
    ),
}

FRECUENCIA_AUDIO = 48000


def fotograma_base(ancho: int, alto: int) -> np.ndarray:
    """Fondo degradado BGRA con dos «renglones» y marca de agua."""
    y = np.linspace(0, 1, alto, dtype=np.float32)[:, None]
    x = np.linspace(0, 1, ancho, dtype=np.float32)[None, :]
    img = np.empty((alto, ancho, 4), dtype=np.uint8)
    img[..., 0] = (120 + 100 * x * (1 - y)).astype(np.uint8)  # B
    img[..., 1] = (30 + 40 * y + 0 * x).astype(np.uint8)  # G
    img[..., 2] = (60 + 120 * y * x).astype(np.uint8)  # R
    img[..., 3] = 255
    # «texto»: bloques claros con huecos, como letras
    def renglon(cy: float, alto_rel: float, ancho_rel: float) -> None:
        h = int(alto * alto_rel)
        top = int(alto * cy) - h // 2
        izq = int(ancho * (0.5 - ancho_rel / 2))
        der = int(ancho * (0.5 + ancho_rel / 2))
        paso = max(4, h // 2)
        for i, x0 in enumerate(range(izq, der, paso)):
            if i % 7 == 6:
                continue  # espacio entre palabras
            img[top : top + h, x0 : x0 + paso - max(1, paso // 5), :3] = 235
    renglon(0.45, 0.075, 0.7)
    renglon(0.58, 0.05, 0.5)
    # marca de agua
    h = max(8, alto // 40)
    img[alto - 2 * h : alto - h, ancho - ancho // 6 : ancho - ancho // 40, :3] = 200
    return img


def fondo_ancho(ancho: int, alto: int, margen: int) -> np.ndarray:
    """Degradado más ancho que el fotograma; recortarlo con desplazamiento simula un fondo en
    movimiento (peor caso de los degradados animados de la fase 5)."""
    y = np.linspace(0, 1, alto, dtype=np.float32)[:, None]
    x = np.linspace(0, 1, ancho + margen, dtype=np.float32)[None, :] * (ancho + margen) / ancho
    img = np.empty((alto, ancho + margen, 4), dtype=np.uint8)
    onda = 0.5 + 0.5 * np.cos(2 * np.pi * x)
    img[..., 0] = (90 + 130 * onda * (1 - y)).astype(np.uint8)
    img[..., 1] = (30 + 50 * y * onda).astype(np.uint8)
    img[..., 2] = (60 + 150 * y * (1 - onda)).astype(np.uint8)
    img[..., 3] = 255
    return img


def generar_fotogramas(ancho: int, alto: int, total: int, fondo_movil: bool = False):
    base = fotograma_base(ancho, alto)
    margen = 512
    ancho_fondo = fondo_ancho(ancho, alto, margen) if fondo_movil else None
    mascara_fija = (base[..., 0] >= 200) & (base[..., 1] >= 200)
    h = int(alto * 0.075)
    top = int(alto * 0.45) - h // 2
    izq = int(ancho * 0.15)
    der = int(ancho * 0.85)
    # Cada «línea» dura 4 s a 30 fps → el barrido avanza y vuelve a empezar.
    periodo = 120
    texto = base[top : top + h, izq:der, 0] > 200
    for n in range(total):
        if ancho_fondo is not None:
            off = (n * 2) % margen
            f = ancho_fondo[:, off : off + ancho].copy()
            f[mascara_fija] = base[mascara_fija]
        else:
            f = base.copy()
        avance = izq + int((der - izq) * ((n % periodo) / periodo))
        if avance > izq:
            zona = f[top : top + h, izq:avance, :3]
            zona[texto[:, : avance - izq]] = (40, 200, 255)
        yield f


def audio_sintetico(segundos: float) -> tuple[np.ndarray, np.ndarray]:
    t = np.arange(int(segundos * FRECUENCIA_AUDIO), dtype=np.float32) / FRECUENCIA_AUDIO
    instrumental = 0.5 * np.sin(2 * np.pi * 220 * t) + 0.3 * np.sin(2 * np.pi * 330 * t)
    voz = 0.6 * np.sin(2 * np.pi * 440 * t) * (np.sin(2 * np.pi * 0.5 * t) > 0)
    est = lambda m: np.stack([m, m]).astype(np.float32)  # noqa: E731
    return est(instrumental), est(voz)


def mezclar(instrumental: np.ndarray, voz: np.ndarray | None, nivel_voz: float) -> np.ndarray:
    mezcla = instrumental.copy()
    if voz is not None and nivel_voz > 0:
        mezcla += nivel_voz * voz
    pico = float(np.max(np.abs(mezcla))) if mezcla.size else 0.0
    if pico > 0.999:  # normalización por pico: una ganancia constante, sin recortar
        mezcla *= 0.999 / pico
    return mezcla


def codificar(args) -> dict:
    contenedor, codec, opciones = PERFILES[args.perfil]
    total = round(args.segundos * args.fps)
    t0 = time.perf_counter()
    salida = av.open(str(args.salida), mode="w", format=contenedor)
    v = salida.add_stream(codec, rate=Fraction(args.fps), options=dict(opciones))
    v.width, v.height = args.ancho, args.alto
    v.pix_fmt = "yuv420p"
    v.codec_context.time_base = Fraction(1, args.fps)
    v.codec_context.gop_size = args.fps * 5
    v.codec_context.color_range = 1  # MPEG/limitado
    v.codec_context.colorspace = 1  # BT.709
    v.codec_context.color_primaries = 1
    v.codec_context.color_trc = 1
    if args.hilos:
        v.codec_context.thread_count = args.hilos
    a = salida.add_stream("libopus", rate=FRECUENCIA_AUDIO, layout="stereo")
    a.bit_rate = 192_000

    # Audio: se mezcla entero (4 min estéreo float32 a 48 kHz ≈ 92 MB) y se intercala con el video
    instrumental, voz = audio_sintetico(total / args.fps)
    mezcla = mezclar(instrumental, voz, args.nivel_voz)
    del instrumental, voz
    tam_bloque = 960 * 50  # 1 s
    pos_audio = 0

    def escribir_audio_hasta(segundo: float) -> None:
        nonlocal pos_audio
        limite = min(mezcla.shape[1], int(segundo * FRECUENCIA_AUDIO))
        while pos_audio < limite:
            fin = min(pos_audio + tam_bloque, mezcla.shape[1])
            trozo = np.ascontiguousarray(mezcla[:, pos_audio:fin])
            af = av.AudioFrame.from_ndarray(trozo, format="fltp", layout="stereo")
            af.sample_rate = FRECUENCIA_AUDIO
            af.pts = pos_audio
            af.time_base = Fraction(1, FRECUENCIA_AUDIO)
            for p in a.encode(af):
                salida.mux(p)
            pos_audio = fin

    t_conv = t_cod = t_lectura = 0.0
    tam_fotograma = args.ancho * args.alto * 4
    if args.stdin:
        entrada = sys.stdin.buffer.raw if hasattr(sys.stdin.buffer, "raw") else sys.stdin.buffer

        # Fotograma BGRA reutilizable: stdin se lee directamente en su plano (sin from_ndarray).
        destino = av.VideoFrame(args.ancho, args.alto, "bgra")
        directo = destino.planes[0].line_size == args.ancho * 4

        def fuente():
            nonlocal t_lectura
            bufer = bytearray(tam_fotograma)
            vista = memoryview(destino.planes[0]).cast("B") if directo else memoryview(bufer)
            for _ in range(total):
                tl = time.perf_counter()
                leidos = 0
                while leidos < tam_fotograma:  # readinto sin copias intermedias
                    n = entrada.readinto(vista[leidos:])
                    if not n:
                        raise SystemExit(f"fotograma incompleto: {leidos} B")
                    leidos += n
                t_lectura += time.perf_counter() - tl
                if directo:
                    yield destino
                else:
                    yield np.frombuffer(bufer, dtype=np.uint8).reshape(args.alto, args.ancho, 4)

        fotogramas = fuente()
    else:
        fotogramas = generar_fotogramas(args.ancho, args.alto, total, args.fondo_movil)

    t_inicio_cod = time.perf_counter()
    for n, bgra in enumerate(fotogramas):
        tc = time.perf_counter()
        vf = bgra if isinstance(bgra, av.VideoFrame) else av.VideoFrame.from_ndarray(bgra, format="bgra")
        vf = vf.reformat(
            format="yuv420p", dst_colorspace="ITU709", dst_color_range="MPEG", threads=args.hilos_conv
        )
        vf.pts = n
        t_conv += time.perf_counter() - tc
        tc = time.perf_counter()
        for p in v.encode(vf):
            salida.mux(p)
        t_cod += time.perf_counter() - tc
        escribir_audio_hasta((n + 1) / args.fps)
    tc = time.perf_counter()
    for p in v.encode(None):
        salida.mux(p)
    t_cod += time.perf_counter() - tc
    escribir_audio_hasta(mezcla.shape[1] / FRECUENCIA_AUDIO)
    for p in a.encode(None):
        salida.mux(p)
    salida.close()
    t_total = time.perf_counter() - t0
    t_bucle = time.perf_counter() - t_inicio_cod

    # Verificación: duraciones y número de fotogramas leídos del archivo
    with av.open(str(args.salida)) as leido:
        sv = leido.streams.video[0]
        sa = leido.streams.audio[0]
        n_video = 0
        ultimo_v = 0.0
        for paquete in leido.demux(sv):
            if paquete.pts is not None:
                n_video += 1
                ultimo_v = max(ultimo_v, float((paquete.pts + (paquete.duration or 0)) * sv.time_base))
        leido.seek(0)
        ultimo_a = 0.0
        for paquete in leido.demux(sa):
            if paquete.pts is not None:
                ultimo_a = max(ultimo_a, float((paquete.pts + (paquete.duration or 0)) * sa.time_base))
        info = {
            "contenedor": leido.format.name,
            "video": f"{sv.codec_context.name} {sv.codec_context.width}x{sv.codec_context.height}",
            "fps_media": float(sv.average_rate) if sv.average_rate else None,
            "audio": f"{sa.codec_context.name} {sa.codec_context.sample_rate} Hz {sa.codec_context.channels} c",
            "fotogramas_leidos": n_video,
            "fin_video_s": round(ultimo_v, 3),
            "fin_audio_s": round(ultimo_a, 3),
        }
    rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    rss_mb = rss / (1024 * 1024) if sys.platform == "darwin" else rss / 1024
    duracion = total / args.fps
    return {
        "perfil": args.perfil,
        "fondo_movil": bool(getattr(args, "fondo_movil", False)),
        "codec": codec,
        "resolucion": f"{args.ancho}x{args.alto}",
        "fps": args.fps,
        "fotogramas": total,
        "duracion_s": duracion,
        "tiempo_total_s": round(t_total, 2),
        "fps_codificacion": round(total / t_bucle, 1),
        "factor_tiempo_real": round(t_bucle / duracion, 2),
        "ms_conversion_bgra_yuv": round(1000 * t_conv / total, 2),
        "ms_codificacion": round(1000 * t_cod / total, 2),
        "ms_lectura_stdin": round(1000 * t_lectura / total, 2) if args.stdin else None,
        "tamano_mb": round(Path(args.salida).stat().st_size / 1e6, 2),
        "mb_por_minuto": round(Path(args.salida).stat().st_size / 1e6 / (duracion / 60), 2),
        "pico_rss_mb": round(rss_mb),
        "verificacion": info,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--perfil", choices=PERFILES, default="av1")
    ap.add_argument("--ancho", type=int, default=1920)
    ap.add_argument("--alto", type=int, default=1080)
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--segundos", type=float, default=10)
    ap.add_argument("--nivel-voz", type=float, default=0.3)
    ap.add_argument("--hilos", type=int, default=0)
    ap.add_argument("--hilos-conv", type=int, default=0, help="hilos de swscale (0 = automático)")
    ap.add_argument("--stdin", action="store_true")
    ap.add_argument("--fondo-movil", action="store_true")
    ap.add_argument("--salida", type=Path, required=True)
    args = ap.parse_args()
    print(json.dumps(codificar(args), ensure_ascii=False))


if __name__ == "__main__":
    main()
