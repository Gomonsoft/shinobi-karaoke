"""Lanza separar.py, lo mata con SIGTERM a los N s y comprueba huérfanos y ficheros parciales.
Uso: python cancelar.py etiqueta modelo entrada segundos [flags...]"""
import subprocess, sys, time, os, signal, shutil, glob
et, modelo, entrada, seg = sys.argv[1:5]; extra = sys.argv[5:]
base = os.path.dirname(os.path.abspath(__file__)); out = f"{base}/salida/pistas/{et}"
shutil.rmtree(out, ignore_errors=True)
env = {"HOME": os.environ["HOME"], "PATH": "/usr/bin:/bin"}
p = subprocess.Popen([f"{base}/.venv/bin/python", f"{base}/separar.py", "--modelo", modelo, "--entrada", entrada, "--salida", out,
                      "--modelos-dir", f"{base}/salida/modelos", "--etiqueta", et, *extra], env=env,
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
time.sleep(float(seg))
kids = subprocess.run(["pgrep", "-g", str(p.pid)], capture_output=True, text=True).stdout.split()
print("procesos en el grupo antes de matar:", kids)
t = time.perf_counter(); p.send_signal(signal.SIGTERM)
try: rc = p.wait(timeout=10)
except subprocess.TimeoutExpired: p.kill(); rc = "SIGKILL tras 10s"
print("codigo de salida:", rc, f"en {time.perf_counter()-t:.2f}s")
time.sleep(1)
rest = subprocess.run(["pgrep", "-g", str(p.pid)], capture_output=True, text=True).stdout.split()
print("procesos huerfanos en el grupo:", rest)
print("ficheros en salida:", [os.path.basename(f) for f in glob.glob(out + "/*")])
print("parciales en modelos:", glob.glob(f"{base}/salida/modelos/*.partial"))
