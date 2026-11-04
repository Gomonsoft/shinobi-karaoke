"""PyAV -> 44,1 kHz estéreo -> mezcla.flac (PCM_16) con soundfile; sonoridad con pyloudnorm.
Uso: python mezcla.py entrada salida.flac [--wav32 salida.wav]"""
import sys, time, av, numpy as np, soundfile as sf, pyloudnorm as pyln, os
src, dst = sys.argv[1], sys.argv[2]
wav32 = sys.argv[sys.argv.index("--wav32") + 1] if "--wav32" in sys.argv else None
t0 = time.perf_counter()
c = av.open(src)
if not c.streams.audio: sys.exit("sin pista de audio")
rs = av.AudioResampler(format="flt", layout="stereo", rate=44100)  # flt = intercalado float32
chunks = []
def take(fr):
    for o in rs.resample(fr):
        chunks.append(o.to_ndarray().reshape(-1, 2))
for fr in c.decode(audio=0): take(fr)
take(None)
x = np.concatenate(chunks).astype(np.float32)
np.clip(x, -1, 1, out=x)
t_dec = time.perf_counter() - t0
sf.write(dst, x, 44100, format="FLAC", subtype="PCM_16")
t_tot = time.perf_counter() - t0
if wav32: sf.write(wav32, x, 44100, format="WAV", subtype="FLOAT")
lufs = pyln.Meter(44100).integrated_loudness(x.astype(np.float64))
print(f"{os.path.basename(src)}: dur={len(x)/44100:.1f}s decod={t_dec:.2f}s total={t_tot:.2f}s "
      f"flac={os.path.getsize(dst)/1e6:.1f}MB LUFS={lufs:.1f} ganancia_a_-16={-16-lufs:+.1f}dB")
