"""Suma el tamano de los wheels de PyPI de lo instalado en el venv (aprox. de MB descargados).
Uso: python3 -I tamanos_descarga.py <regex plataforma: macosx_.*_(arm64|universal2)|win_amd64|manylinux.*_x86_64> <cpXY> < freeze
(freeze = 'nombre==version' por linea). Solo PyPI; para torch con CUDA hay que mirar download.pytorch.org."""
import sys, json, urllib.request, re
plat, cp = sys.argv[1], sys.argv[2]
tot = 0
for line in sys.stdin:
    if "==" not in line: continue
    n, v = line.strip().split("==")
    try:
        d = json.load(urllib.request.urlopen(f"https://pypi.org/pypi/{n}/{v}/json"))
    except Exception as e:
        print(n, v, "ERROR", e); continue
    best = None
    for f in d["urls"]:
        fn = f["filename"]
        if not fn.endswith(".whl"): continue
        tags = fn[:-4].split("-")
        py, abi, pl = tags[-3], tags[-2], tags[-1]
        okpy = py in (cp, "py3", "py2.py3", "cp3") or (py.startswith("cp3") and abi == "abi3" and int(py[2:]) <= int(cp[2:]))
        okpl = pl == "any" or any(re.fullmatch(plat, p) for p in pl.split("."))
        if okpy and okpl and (abi in (cp, "abi3", "none")):
            if best is None or f["size"] < best["size"]: best = f
    if best: tot += best["size"]; print(f"{n:28s} {v:22s} {best['size']/1e6:8.1f} MB")
    else: print(n, v, "SIN WHEEL")
print(f"TOTAL {tot/1e6:.0f} MB")
