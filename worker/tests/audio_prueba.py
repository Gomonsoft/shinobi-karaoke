"""Audio de prueba sintético (ADR 0009 §8): nada de audio de terceros en el repositorio.

Funciones puras que escriben archivos en una carpeta dada con numpy + PyAV/soundfile.
Los *fixtures* de `conftest.py` las envuelven con `tmp_path`.
"""

from __future__ import annotations

from fractions import Fraction
from pathlib import Path

import av
import numpy as np
import soundfile as sf

FS = 44100
ETIQUETAS = {
    "title": "Canción de prueba ñandú",
    "artist": "Artista 歌手",
    "album": "Álbum ひらがな",
}


def tono(segundos: float, fs: int = FS, canales: int = 2, hz: float = 440.0) -> np.ndarray:
    """Seno float32 de forma (muestras, canales); en estéreo, cada canal con otra frecuencia."""
    t = np.arange(int(segundos * fs), dtype=np.float32) / fs
    cols = [0.3 * np.sin(2 * np.pi * hz * (1 + 0.5 * c) * t) for c in range(canales)]
    return np.stack(cols, axis=1).astype(np.float32)


def _capa(canales: int) -> str:
    return "mono" if canales == 1 else "stereo"


def _codificar(
    destino: Path,
    senal: np.ndarray,
    fs: int,
    *,
    formato: str | None,
    codec: str,
    etiquetas: dict[str, str] | None = None,
    video: tuple[str, float] | None = None,
    bit_rate: int | None = None,
) -> Path:
    """Codifica con PyAV. `video=(codec, segundos)` añade una pista de vídeo negro."""
    canales = senal.shape[1]
    with av.open(str(destino), "w", format=formato) as cont:
        if etiquetas:
            cont.metadata.update(etiquetas)
        audio = cont.add_stream(codec, rate=fs, layout=_capa(canales))
        if bit_rate:
            audio.bit_rate = bit_rate
        vid = None
        if video:
            vid = cont.add_stream(video[0], rate=10)
            vid.width, vid.height, vid.pix_fmt = 64, 64, "yuv420p"
        ctx = audio.codec_context
        remuestreador = av.AudioResampler(format=ctx.format.name, layout=_capa(canales), rate=fs)
        paso = 4096
        for i in range(0, len(senal), paso):
            bloque = np.ascontiguousarray(senal[i : i + paso].T)  # (canales, n) planar float
            trama = av.AudioFrame.from_ndarray(bloque, format="fltp", layout=_capa(canales))
            trama.sample_rate = fs
            trama.pts = None
            for r in remuestreador.resample(trama):
                cont.mux(audio.encode(r))
        for r in remuestreador.resample(None):
            cont.mux(audio.encode(r))
        cont.mux(audio.encode(None))
        if vid is not None:
            negro = np.zeros((64, 64, 3), dtype=np.uint8)
            for n in range(int(video[1] * 10)):
                f = av.VideoFrame.from_ndarray(negro, format="rgb24").reformat(format="yuv420p")
                f.pts = n
                f.time_base = Fraction(1, 10)
                cont.mux(vid.encode(f))
            cont.mux(vid.encode(None))
    return destino


def wav(destino: Path, senal: np.ndarray, fs: int = FS, subtipo: str = "PCM_16") -> Path:
    sf.write(str(destino), senal, fs, subtype=subtipo, format="WAV")
    return destino


def flac(destino: Path, senal: np.ndarray, fs: int = FS) -> Path:
    sf.write(str(destino), senal, fs, format="FLAC")
    return destino


def mp3(destino: Path, senal: np.ndarray, fs: int = FS, etiquetas=None) -> Path:
    return _codificar(destino, senal, fs, formato="mp3", codec="libmp3lame", etiquetas=etiquetas)


def m4a(destino: Path, senal: np.ndarray, fs: int = FS) -> Path:
    return _codificar(destino, senal, fs, formato="ipod", codec="aac")


def ogg_opus(destino: Path, senal: np.ndarray, fs: int = 48000) -> Path:
    return _codificar(destino, senal, fs, formato="ogg", codec="libopus")


def webm_opus(destino: Path, senal: np.ndarray, fs: int = 48000) -> Path:
    return _codificar(destino, senal, fs, formato="webm", codec="libopus")


def mp4_con_video(destino: Path, senal: np.ndarray, fs: int = FS, segundos: float = 3) -> Path:
    return _codificar(destino, senal, fs, formato="mp4", codec="aac", video=("libx264", segundos))


def mkv_con_video(destino: Path, senal: np.ndarray, fs: int = FS, segundos: float = 3) -> Path:
    return _codificar(
        destino, senal, fs, formato="matroska", codec="aac", video=("libx264", segundos)
    )


def mp4_sin_audio(destino: Path, segundos: float = 3) -> Path:
    with av.open(str(destino), "w", format="mp4") as cont:
        vid = cont.add_stream("libx264", rate=10)
        vid.width, vid.height, vid.pix_fmt = 64, 64, "yuv420p"
        negro = np.zeros((64, 64, 3), dtype=np.uint8)
        for n in range(int(segundos * 10)):
            f = av.VideoFrame.from_ndarray(negro, format="rgb24").reformat(format="yuv420p")
            f.pts = n
            f.time_base = Fraction(1, 10)
            cont.mux(vid.encode(f))
        cont.mux(vid.encode(None))
    return destino


def largo_11_min(destino: Path, fs: int = 16000) -> Path:
    """11 min de silencio con un tono de 1 s en medio (WAV mono de 16 kHz, rápido)."""
    senal = np.zeros((11 * 60 * fs, 1), dtype=np.float32)
    mitad = len(senal) // 2
    corto = tono(1.0, fs, canales=1)
    senal[mitad : mitad + len(corto)] = corto
    return wav(destino, senal, fs)


def truncado(destino: Path, origen: Path) -> Path:
    """Copia la primera mitad de `origen` (cabecera válida, datos cortados)."""
    datos = origen.read_bytes()
    destino.write_bytes(datos[: len(datos) // 2])
    return destino


def texto_como_mp3(destino: Path) -> Path:
    destino.write_text("Esto no es audio, solo texto con extensión .mp3\n", encoding="utf-8")
    return destino
