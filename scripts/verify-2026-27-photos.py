import json, re, struct, urllib.request, urllib.error, sys

BASE = "http://localhost:3123"
UA = {"User-Agent": "Mozilla/5.0"}

def get(url, raw=False):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
        return r.read() if raw else r.read().decode("utf-8", "ignore")

def dims(data):
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return struct.unpack(">II", data[16:24])
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        if data[12:16] == b"VP8 ":
            return struct.unpack("<H", data[26:28])[0] & 0x3FFF, struct.unpack("<H", data[28:30])[0] & 0x3FFF
        if data[12:16] == b"VP8X":
            return int.from_bytes(data[24:27], "little") + 1, int.from_bytes(data[27:30], "little") + 1
    if data[:2] == b"\xff\xd8":
        i = 2
        while i < len(data) - 9:
            if data[i] != 0xFF:
                i += 1
                continue
            mk = data[i + 1]
            if mk in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                h, w = struct.unpack(">HH", data[i + 5:i + 9])
                return w, h
            if mk in (0xD8, 0x01) or 0xD0 <= mk <= 0xD7:
                i += 2
                continue
            i += 2 + struct.unpack(">H", data[i + 2:i + 4])[0]
    return None

listing = get(BASE + "/equipaciones")
products = sorted(set(re.findall(r'href="(/producto/[^"]+)"', listing)))
clubs = sorted(set(re.findall(r'href="(/equipaciones/[^"]+)"', listing)))
pages = products[:6] + [c for c in clubs if c.count("/") >= 3][:4]
print("pages:", len(pages))

seen, stale, ok, fail = set(), 0, 0, 0
dims_seen = []
for p in pages:
    try:
        html = get(BASE + p)
    except Exception as e:
        print("  page ERR", p, e)
        continue
    srcs = [urllib.request.unquote(m.group(1)) for m in re.finditer(r'/_next/image\?url=([^&"]+)', html)]
    print(f"  {p}: {len(srcs)} image refs")
    for src in srcs:
        if "w_147" in src or "blur_2" in src or "/v1/fill/" in src:
            stale += 1
        if src in seen:
            continue
        seen.add(src)
        opt = f"{BASE}/_next/image?url={urllib.request.quote(src, safe='')}&w=1080&q=75"
        try:
            body = get(opt, raw=True)
            d = dims(body)
            if d and min(d) > 300:
                ok += 1
            if d and len(dims_seen) < 8:
                dims_seen.append((src.rsplit('/', 1)[-1], d, len(body)))
        except urllib.error.HTTPError as e:
            fail += 1
            if fail <= 10:
                print("   FAIL", e.code, src[:120])
        except Exception as e:
            fail += 1
            if fail <= 10:
                print("   ERR", e, src[:120])

print(f"\ndistinct images requested: {len(seen)}  served with dimensions>300: {ok}  failures: {fail}  stale refs: {stale}")
for name, d, n in dims_seen:
    print(f"   {d[0]}x{d[1]}  {n:>7} bytes  {name}")
print("VERDICT:", "PASS" if seen and fail == 0 and stale == 0 and ok == len(seen) else "FAIL")
