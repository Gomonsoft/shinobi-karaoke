"""Compara dos pistas (misma canción, entradas FLAC16 vs WAV float32): RMS de la diferencia en dB.
Uso: python comparar.py a.flac b.flac"""
import sys, numpy as np, soundfile as sf
a, sr = sf.read(sys.argv[1], dtype="float64"); b, _ = sf.read(sys.argv[2], dtype="float64")
n = min(len(a), len(b)); a, b = a[:n], b[:n]
rms = lambda x: np.sqrt(np.mean(x ** 2))
db = lambda x: 20 * np.log10(max(x, 1e-12))
print(f"{sys.argv[1].split('/')[-2]} vs {sys.argv[2].split('/')[-2]}: len_dif={len(sf.read(sys.argv[1])[0])-len(sf.read(sys.argv[2])[0])} "
      f"RMS_a={db(rms(a)):.1f} dBFS  RMS_dif={db(rms(a-b)):.1f} dBFS  dif_relativa={db(rms(a-b))-db(rms(a)):.1f} dB "
      f"(ruido de cuantizacion 16 bit ~ -98 dBFS)")
