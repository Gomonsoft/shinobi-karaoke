"""Comando `exportar`: fotogramas BGRA por stdin + audio -> MKV (AV1) o WebM (VP9) con Opus.

ADR 0019 §4. Base: docs/spikes/0019-exportacion/codificar.py (solo referencia). Sin estado propio y
sin escribir fuera de `temporal`; en cualquier error el temporal se borra.
"""

from __future__ import annotations

import contextlib
import errno
import os
import sys
import time
from fractions import Fraction
from pathlib import Path
from typing import Any, BinaryIO

from . import protocolo
from .errores import ArgumentosNoValidos, ErrorWorker

FRECUENCIA = 48000
BLOQUE_AUDIO = 4800  # 100 ms: granularidad del intercalado con el video
PICO_MAXIMO = 0.999
INTERVALO_PROGRESO_S = 0.25  # <= 4 mensajes por segundo

# formato -> (contenedor, codificador de video)
FORMATOS = {
    "mkv_av1": ("matroska", "libsvtav1"),
    "webm_vp9": ("webm", "libvpx-vp9"),
}


def codificador_disponible(nombre: str) -> bool:
    import av

    try:
        av.codec.Codec(nombre, "w")
    except Exception:
        return False
    return True


MAX_PUNTOS_ENVOLVENTE = 10_000


def mezclar(instrumental, voz, ganancia_db: float, envolvente=None):
    """instrumental * g (+ voz * g al 100 %, o * nivel(t) * g con envolvente); pico <= 0,999.

    `envolvente` son puntos `[[ms, nivel], ...]` (ADR 0030 §5): la voz entra a ese nivel, con
    interpolación lineal y 0 fuera de los puntos; sin ella, el resultado es el de siempre.
    """
    import numpy as np

    g = 10 ** (ganancia_db / 20)
    mezcla = instrumental * g
    if voz is not None:
        n = min(mezcla.shape[1], voz.shape[1])
        if envolvente:
            ms = np.array([p[0] for p in envolvente], dtype=np.float64)
            nivel = np.array([p[1] for p in envolvente], dtype=np.float64)
            # Solo el tramo cubierto por los puntos: fuera la voz vale 0.
            i0 = max(0, int(np.floor(ms[0] * FRECUENCIA / 1000)))
            i1 = min(n, int(np.ceil(ms[-1] * FRECUENCIA / 1000)) + 1)
            if i1 > i0:
                t = np.arange(i0, i1, dtype=np.float64) * 1000 / FRECUENCIA
                curva = (np.interp(t, ms, nivel) * g).astype(np.float32)
                mezcla[:, i0:i1] += voz[:, i0:i1] * curva
        else:
            mezcla[:, :n] += voz[:, :n] * g
    pico = float(abs(mezcla).max()) if mezcla.size else 0.0
    if pico > PICO_MAXIMO:
        mezcla *= PICO_MAXIMO / pico
    return mezcla


def _decodificar(ruta: str):
    """Pista a 48 kHz estéreo float planar (2, n). Falta o ilegible: CANCION_NO_DISPONIBLE."""
    import av
    import numpy as np

    try:
        with Path(ruta).open("rb") as f, av.open(f) as contenedor:
            pista = contenedor.streams.audio[0]
            remuestreo = av.AudioResampler(format="fltp", layout="stereo", rate=FRECUENCIA)
            trozos = []
            for trama in contenedor.decode(pista):
                trozos += [t.to_ndarray() for t in remuestreo.resample(trama)]
            trozos += [t.to_ndarray() for t in remuestreo.resample(None)]
    except (OSError, IndexError, av.error.FFmpegError) as e:
        raise ErrorWorker("CANCION_NO_DISPONIBLE", "Falta una pista de audio de la canción") from e
    if not trozos:
        raise ErrorWorker("CANCION_NO_DISPONIBLE", "Una pista de audio de la canción está vacía")
    return np.concatenate(trozos, axis=1).astype(np.float32, copy=False)


def _preparar_audio(audio: dict[str, Any], duracion_ms: int):
    import numpy as np

    instrumental = _decodificar(audio["instrumental"])
    voz = _decodificar(audio["voz"]) if audio.get("voz") else None
    mezcla = mezclar(
        instrumental, voz, float(audio.get("ganancia_db", 0)), audio.get("voz_envolvente")
    )
    muestras = round(duracion_ms * FRECUENCIA / 1000)
    if mezcla.shape[1] < muestras:  # una pista algo corta: silencio hasta la duración del video
        mezcla = np.pad(mezcla, ((0, 0), (0, muestras - mezcla.shape[1])))
    return np.ascontiguousarray(mezcla[:, :muestras])


def _validar_envolvente(audio: dict[str, Any]) -> None:
    """`audio.voz_envolvente`: hasta 10 000 puntos `[ms, nivel]`, ms crecientes y nivel de 0 a 1."""
    puntos = audio.get("voz_envolvente")
    if puntos is None:
        return
    if not isinstance(audio.get("voz"), str) or not audio["voz"]:
        raise ArgumentosNoValidos("'audio.voz_envolvente' necesita 'audio.voz'")
    if not isinstance(puntos, list) or not 1 <= len(puntos) <= MAX_PUNTOS_ENVOLVENTE:
        raise ArgumentosNoValidos("'audio.voz_envolvente' debe tener de 1 a 10000 puntos")
    anterior = -1.0
    for p in puntos:
        if not isinstance(p, list | tuple) or len(p) != 2:
            raise ArgumentosNoValidos("cada punto de 'voz_envolvente' debe ser [ms, nivel]")
        ms, nivel = p
        if any(isinstance(v, bool) or not isinstance(v, int | float) for v in (ms, nivel)):
            raise ArgumentosNoValidos("los puntos de 'voz_envolvente' deben ser números")
        if not (ms == ms and nivel == nivel) or ms in (float("inf"), float("-inf")):
            raise ArgumentosNoValidos("los puntos de 'voz_envolvente' deben ser finitos")
        if ms < 0 or ms <= anterior:
            raise ArgumentosNoValidos("los 'ms' de 'voz_envolvente' deben ser crecientes y >= 0")
        if not 0 <= nivel <= 1:
            raise ArgumentosNoValidos("el nivel de 'voz_envolvente' debe ir de 0 a 1")
        anterior = ms


def _validar(args: dict[str, Any]) -> dict[str, Any]:
    def entero(clave: str, minimo: int = 1) -> int:
        v = args.get(clave)
        if isinstance(v, bool) or not isinstance(v, int) or v < minimo:
            raise ArgumentosNoValidos(f"'{clave}' debe ser un entero >= {minimo}")
        return v

    if args.get("formato") not in FORMATOS:
        raise ArgumentosNoValidos("'formato' debe ser mkv_av1 o webm_vp9")
    temporal = args.get("temporal")
    if not isinstance(temporal, str) or not temporal or "\0" in temporal:
        raise ArgumentosNoValidos("'temporal' debe ser una ruta no vacía")
    audio = args.get("audio")
    if not isinstance(audio, dict) or not isinstance(audio.get("instrumental"), str):
        raise ArgumentosNoValidos("'audio.instrumental' debe ser una ruta")
    _validar_envolvente(audio)
    parametros = args.get("parametros")
    clave = "preset" if args["formato"] == "mkv_av1" else "cpu_used"
    if not isinstance(parametros, dict) or "crf" not in parametros or clave not in parametros:
        raise ArgumentosNoValidos(f"'parametros' debe incluir crf y {clave}")
    ancho, alto = entero("ancho", 2), entero("alto", 2)
    if ancho % 2 or alto % 2:
        raise ArgumentosNoValidos("'ancho' y 'alto' deben ser pares")
    hilos = args.get("hilos") or 0
    if isinstance(hilos, bool) or not isinstance(hilos, int) or hilos < 0:
        raise ArgumentosNoValidos("'hilos' debe ser un entero >= 0")
    return {
        "temporal": Path(temporal),
        "formato": args["formato"],
        "ancho": ancho,
        "alto": alto,
        "fps": entero("fps"),
        "total": entero("total_fotogramas"),
        "duracion_ms": entero("duracion_ms"),
        "audio": audio,
        "parametros": parametros,
        "hilos": hilos,
    }


def _opciones(formato: str, p: dict[str, Any]) -> dict[str, str]:
    if formato == "mkv_av1":
        return {"preset": str(p["preset"]), "crf": str(p["crf"])}
    return {
        "deadline": "realtime",
        "cpu-used": str(p["cpu_used"]),
        "row-mt": "1",
        "crf": str(p["crf"]),
        "b": "0",
    }


def _traducir(e: BaseException, fotograma: int) -> ErrorWorker:
    """Excepción inesperada -> error del catálogo, con la posición."""
    detalle = {"fotograma": fotograma}
    if isinstance(e, ErrorWorker):
        e.detalle = {**(e.detalle or {}), **detalle}
        return e
    if isinstance(e, MemoryError):
        return ErrorWorker("MEMORIA_INSUFICIENTE", "No hay memoria suficiente", detalle=detalle)
    if isinstance(e, ImportError):
        msg = "El motor de audio no está instalado"
        return ErrorWorker("RUNTIME_NO_DISPONIBLE", msg, detalle=detalle)
    if isinstance(e, OSError):
        if e.errno in (errno.ENOSPC, getattr(errno, "EDQUOT", errno.ENOSPC)):
            return ErrorWorker("SIN_ESPACIO", "No queda espacio en disco", detalle=detalle)
        msg = "No se puede escribir en el destino"
        return ErrorWorker("DESTINO_NO_DISPONIBLE", msg, detalle=detalle)
    return ErrorWorker("ERROR_INTERNO", f"{type(e).__name__}: {e}", detalle=detalle)


def exportar(args: dict[str, Any], entrada: BinaryIO | None = None) -> None:
    """`entrada` solo se inyecta en las pruebas; por defecto es el stdin binario."""
    cfg = _validar(args)
    estado: dict[str, Any] = {"fotograma": 0, "salida": None}
    try:
        resultado = _exportar(cfg, entrada, estado)
    except BaseException as e:
        # En Windows no se puede borrar un archivo abierto: se cierra el contenedor antes.
        if estado["salida"] is not None:
            with contextlib.suppress(Exception):
                estado["salida"].close()
        with contextlib.suppress(OSError):
            cfg["temporal"].unlink(missing_ok=True)
        if isinstance(e, KeyboardInterrupt | SystemExit):
            raise
        raise _traducir(e, estado["fotograma"]) from e
    protocolo.resultado(resultado)


def _exportar(cfg: dict[str, Any], entrada: BinaryIO | None, estado: dict[str, Any]) -> dict:
    import av

    ancho, alto, fps, total = cfg["ancho"], cfg["alto"], cfg["fps"], cfg["total"]
    contenedor, codec = FORMATOS[cfg["formato"]]
    temporal: Path = cfg["temporal"]
    if not codificador_disponible(codec) or not codificador_disponible("libopus"):
        raise ErrorWorker("SIN_CODIFICADOR", "Este equipo no puede codificar ese formato")

    protocolo.progreso("preparando", None)
    mezcla = _preparar_audio(cfg["audio"], cfg["duracion_ms"])

    if entrada is None:
        entrada = getattr(sys.stdin.buffer, "raw", sys.stdin.buffer)

    salida = av.open(str(temporal), mode="w", format=contenedor)
    estado["salida"] = salida
    opciones = _opciones(cfg["formato"], cfg["parametros"])
    video = salida.add_stream(codec, rate=Fraction(fps), options=opciones)
    video.width, video.height = ancho, alto
    video.pix_fmt = "yuv420p"
    ctx = video.codec_context
    ctx.time_base = Fraction(1, fps)
    ctx.gop_size = fps * 5
    ctx.color_range, ctx.colorspace, ctx.color_primaries, ctx.color_trc = 1, 1, 1, 1
    if cfg["hilos"]:
        ctx.thread_count = cfg["hilos"]
    sonido = salida.add_stream("libopus", rate=FRECUENCIA, layout="stereo")
    sonido.bit_rate = 192_000

    escritas = 0

    def audio_hasta(segundo: float) -> None:
        nonlocal escritas
        limite = min(mezcla.shape[1], int(segundo * FRECUENCIA))
        while escritas < limite:
            fin = min(escritas + BLOQUE_AUDIO, mezcla.shape[1])
            trama = av.AudioFrame.from_ndarray(mezcla[:, escritas:fin].copy(), "fltp", "stereo")
            trama.sample_rate = FRECUENCIA
            trama.pts = escritas
            trama.time_base = Fraction(1, FRECUENCIA)
            for paquete in sonido.encode(trama):
                salida.mux(paquete)
            escritas = fin

    # Fotograma BGRA reutilizable: la entrada se lee directamente en su plano.
    origen = av.VideoFrame(ancho, alto, "bgra")
    plano = origen.planes[0]
    fila = ancho * 4
    tamano = fila * alto
    directo = plano.line_size == fila
    vista = memoryview(plano).cast("B")
    intermedio = memoryview(bytearray(tamano))

    ultimo_aviso = 0.0
    for n in range(total):
        destino = vista[:tamano] if directo else intermedio
        leidos = 0
        while leidos < tamano:
            k = entrada.readinto(destino[leidos:])
            if not k:
                raise ErrorWorker(
                    "ENTRADA_INCOMPLETA", "La entrada de fotogramas se cerró antes de tiempo"
                )
            leidos += k
        if not directo:
            paso = plano.line_size
            for y in range(alto):
                vista[y * paso : y * paso + fila] = intermedio[y * fila : (y + 1) * fila]
        yuv = origen.reformat(
            format="yuv420p", dst_colorspace="ITU709", dst_color_range="MPEG", threads=0
        )
        yuv.pts = n
        for paquete in video.encode(yuv):
            salida.mux(paquete)
        audio_hasta((n + 1) / fps)
        estado["fotograma"] = n + 1
        ahora = time.monotonic()
        if ahora - ultimo_aviso >= INTERVALO_PROGRESO_S or n + 1 == total:
            ultimo_aviso = ahora
            protocolo.progreso("codificando", (n + 1) / total, {"fotograma": n + 1, "total": total})

    protocolo.progreso("finalizando", None)
    for paquete in video.encode(None):
        salida.mux(paquete)
    audio_hasta(mezcla.shape[1] / FRECUENCIA)
    for paquete in sonido.encode(None):
        salida.mux(paquete)
    salida.close()
    estado["salida"] = None
    with temporal.open("r+b") as f:
        os.fsync(f.fileno())
    return _verificar(temporal, cfg)


def _verificar(temporal: Path, cfg: dict[str, Any]) -> dict:
    import av

    fps, total = cfg["fps"], cfg["total"]
    try:
        with av.open(str(temporal)) as leido:
            if len(leido.streams.video) != 1 or len(leido.streams.audio) != 1:
                raise ErrorWorker(
                    "VERIFICACION_FALLIDA", "El archivo no tiene un flujo de video y otro de audio"
                )
            sv = leido.streams.video[0]
            paquetes = 0
            fin = 0.0
            for p in leido.demux(sv):
                if p.pts is not None:
                    paquetes += 1
                    fin = max(fin, float((p.pts + (p.duration or 1)) * sv.time_base))
    except av.error.FFmpegError as e:
        raise ErrorWorker("VERIFICACION_FALLIDA", "No se pudo volver a abrir el archivo") from e
    if abs(paquetes - total) > 1 or abs(fin * 1000 - cfg["duracion_ms"]) > 1000 / fps + 1:
        msg = f"Fotogramas {paquetes}/{total}, duración {fin:.2f} s"
        raise ErrorWorker("VERIFICACION_FALLIDA", msg)
    return {
        "bytes": temporal.stat().st_size,
        "fotogramas": paquetes,
        "duracion_ms": cfg["duracion_ms"],
    }
