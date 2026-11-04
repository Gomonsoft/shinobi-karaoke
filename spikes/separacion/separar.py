"""Spike 0005: separa un audio con audio-separator y mide tiempos/RAM/progreso. Desechable.
Imprime al final una línea 'RESULTADO {json}'.
Opciones: --modelo FICHERO --entrada RUTA --salida DIR --modelos-dir DIR
          --cpu (fuerza CPU ocultando MPS/CUDA a torch)  --sin-parche (no parchea la comprobación de ffmpeg)
          --pydub (escribe con pydub/ffmpeg en vez de soundfile)"""
import argparse, json, os, sys, time, resource, logging, shutil
ap = argparse.ArgumentParser()
ap.add_argument("--modelo", required=True); ap.add_argument("--entrada", required=True)
ap.add_argument("--salida", required=True); ap.add_argument("--modelos-dir", required=True)
ap.add_argument("--cpu", action="store_true"); ap.add_argument("--sin-parche", action="store_true")
ap.add_argument("--pydub", action="store_true"); ap.add_argument("--solo-descargar", action="store_true")
ap.add_argument("--etiqueta", default=""); ap.add_argument("--formato", default="FLAC")
a = ap.parse_args()
T0 = time.perf_counter()
import torch
if a.cpu:
    def _no(): return False
    _no.__wrapped__ = _no   # torch._dynamo espera __wrapped__
    torch.backends.mps.is_available = _no
    torch.cuda.is_available = _no
from tqdm import std as _tqdm_std
ev = []  # (t, n, total, desc)
_orig = _tqdm_std.tqdm.update
def _upd(self, n=1):
    r = _orig(self, n)
    if self.total and self.total < 5e6 and self.unit != "iB":  # ignora barras de descarga
        ev.append((time.perf_counter() - T0, self.n, self.total, id(self)))
    return r
_tqdm_std.tqdm.update = _upd
from audio_separator.separator import Separator
if not a.sin_parche:
    Separator.check_ffmpeg_installed = lambda self: None   # parche: no exigir el binario ffmpeg
t_imp = time.perf_counter() - T0
os.makedirs(a.salida, exist_ok=True)
t1 = time.perf_counter()
sep = Separator(output_dir=a.salida, model_file_dir=a.modelos_dir, output_format=a.formato,
                use_soundfile=not a.pydub, log_level=logging.INFO)
t_init = time.perf_counter() - t1
t2 = time.perf_counter(); sep.load_model(a.modelo); t_load = time.perf_counter() - t2
ev.clear()
r = {"etiqueta": a.etiqueta, "modelo": a.modelo, "device": str(getattr(sep, "torch_device", None)),
     "onnx_providers": getattr(sep, "onnx_execution_provider", None),
     "t_import": round(t_imp, 2), "t_init": round(t_init, 2), "t_carga_modelo": round(t_load, 2)}
if not a.solo_descargar:
    t3 = time.perf_counter(); t3abs = t3 - T0
    files = sep.separate(a.entrada)
    t_sep = time.perf_counter() - t3
    import soundfile as sf
    dur = sf.info(a.entrada).duration
    r.update(t_separacion=round(t_sep, 2), duracion_audio_s=round(dur, 1),
             factor=round(t_sep / dur, 3), factor_con_carga=round((t_sep + t_load) / dur, 3),
             ficheros=files)
    barras = {}
    for t, n, tot, bid in ev: barras.setdefault((bid, tot), []).append(t - t3abs)
    r["barras_tqdm"] = []
    for (bid, tot), ts in barras.items():
        r["barras_tqdm"].append(dict(total=tot, eventos=len(ts), t_primero=round(ts[0], 2), t_ultimo=round(ts[-1], 2),
            intervalo_medio=round((ts[-1]-ts[0])/max(1, len(ts)-1), 2),
            intervalo_max=round(max([b-a_ for a_, b in zip(ts, ts[1:])] or [0]), 2)))
r["pico_ram_MB"] = round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1e6)  # macOS: bytes
if torch.backends.mps.is_available() and not a.cpu:
    try: r["mps_asignada_MB"] = round(torch.mps.driver_allocated_memory() / 1e6)
    except Exception: pass
print("RESULTADO " + json.dumps(r, ensure_ascii=False))
