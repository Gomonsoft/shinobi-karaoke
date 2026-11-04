"""Suma tamaños de wheels (PyPI, y download.pytorch.org para versiones locales +cpu/+cuXXX) de un freeze compilado.
Uso: python3 -I tamanos_plataforma.py <linux|win> <freeze.txt> <indice_torch: cpu|cu128>"""
import sys, json, re, urllib.request, ssl, certifi
plat, fz, idx = sys.argv[1:4]
ctx = ssl.create_default_context(cafile=certifi.where())
rx = {"linux": r"manylinux.*x86_64", "win": r"win_amd64"}[plat]
def get(u): return urllib.request.urlopen(u, context=ctx).read()
tot = 0; rows = []
for line in open(fz):
    if "==" not in line: continue
    n, v = line.strip().split("==")
    cand = []
    if "+" in v:
        base = f"https://download.pytorch.org/whl/{v.split('+')[1]}/{n}/"
        html = get(base).decode()
        for m in re.finditer(r'href="([^"#]+\.whl)', html):
            fn = m.group(1).split("/")[-1].replace("%2B", "+")
            if fn.startswith(n.replace("-", "_") + "-" + v) and "cp312-cp312" in fn and re.search(rx, fn):
                u = m.group(1) if m.group(1).startswith("http") else "https://download.pytorch.org" + m.group(1)
                req = urllib.request.Request(u, method="HEAD"); sz = int(urllib.request.urlopen(req, context=ctx).headers["Content-Length"]); cand.append(sz)
    else:
        try: d = json.loads(get(f"https://pypi.org/pypi/{n}/{v}/json"))
        except Exception as e: rows.append((0, n, v, "ERR")); continue
        for f in d["urls"]:
            fn = f["filename"]
            if not fn.endswith(".whl"): continue
            py, abi, pl = fn[:-4].split("-")[-3:]
            if (py in ("cp312", "py3", "py2.py3", "cp3") or (abi == "abi3" and py.startswith("cp3") and int(py[2:]) <= 312)) \
               and (pl == "any" or any(re.fullmatch(rx, p) or (plat=="linux" and re.fullmatch(r"manylinux.*_x86_64", p)) for p in pl.split("."))):
                cand.append(f["size"])
    if cand: s = min(cand); tot += s; rows.append((s, n, v, ""))
    else: rows.append((0, n, v, "SIN WHEEL (sdist/otro)"))
for s, n, v, note in sorted(rows, reverse=True)[:8]: print(f"{s/1e6:8.1f} MB {n} {v} {note}")
print("sin wheel:", [r[1] for r in rows if r[0] == 0])
print(f"TOTAL {plat} {fz}: {tot/1e6:.0f} MB")
