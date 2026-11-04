"""Genera MP3, M4A y MP4 (con vídeo negro) de prueba desde un WAV usando solo PyAV (sin ffmpeg)."""
import sys, av, numpy as np
src, outdir = sys.argv[1], sys.argv[2]

def frames(path):
    c = av.open(path)
    rs = av.AudioResampler(format="fltp", layout="stereo", rate=44100)
    for fr in c.decode(audio=0):
        for o in rs.resample(fr): yield o
    for o in rs.resample(None): yield o

def encode(dst, codec, video=False, bitrate=None):
    out = av.open(dst, "w")
    a = out.add_stream(codec, rate=44100, layout="stereo")
    if bitrate: a.bit_rate = bitrate
    v = None
    if video:
        v = out.add_stream("libx264", rate=2); v.width, v.height, v.pix_fmt = 160, 90, "yuv420p"
    n = 0
    for fr in frames(src):
        fr.pts = None
        for p in a.encode(fr): out.mux(p)
        n += 1
    for p in a.encode(None): out.mux(p)
    if v:
        black = av.VideoFrame.from_ndarray(np.zeros((90, 160, 3), np.uint8), format="rgb24")
        for i in range(2 * 210):
            f = black.reformat(format="yuv420p"); f.pts = i
            for p in v.encode(f): out.mux(p)
        for p in v.encode(None): out.mux(p)
    out.close()

encode(f"{outdir}/cancion.mp3", "libmp3lame", bitrate=192000)
encode(f"{outdir}/cancion.m4a", "aac", bitrate=128000)
encode(f"{outdir}/cancion.mp4", "aac", video=True, bitrate=128000)
