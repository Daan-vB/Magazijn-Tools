# Leest de Supabase-database Palletlabels (alleen lezen, met dezelfde publieke sleutel als de app)
# en schrijft alles naar map out/. Draait in GitHub Actions; het resultaat wordt daar versleuteld
# met sleutel-publiek.pem, zodat alleen Claude het kan openen. Geen bedrijfsdata leesbaar in repo of logs.
import json, os, sys, urllib.request, urllib.error

URL = "https://jarbgetbwkjtxwtcfwmq.supabase.co/rest/v1/"
KEY = "sb_publishable_Jn8gTTPRy7rkoDikFjQlow_V0wcO8rA"   # staat ook in wh/core.js
TABELLEN = ["producten", "catalog", "containers", "pakbon_alias", "verkoop", "backorders", "todos", "productdata"]
os.makedirs("out", exist_ok=True)


def get(path, rng=None):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "User-Agent": "ivol-export/1.0"}
    if rng:
        h.update({"Range": rng, "Range-Unit": "items"})
    try:
        with urllib.request.urlopen(urllib.request.Request(URL + path, headers=h), timeout=180) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        print(f"::warning::{path.split('?')[0]}: HTTP {e.code} {e.read()[:200].decode(errors='replace')}")
        return None


# welke tabellen bestaan er (OpenAPI-overzicht; lukt niet altijd met de publieke sleutel)
oa = get("")
extra = sorted(k.strip("/") for k in (oa or {}).get("paths", {}) if k.count("/") == 1 and len(k) > 1)
json.dump({"openapi_tabellen": extra}, open("out/schema.json", "w"))
for t in TABELLEN + [x for x in extra if x not in TABELLEN]:
    rows, stap = [], (1000 if t != "catalog" else 3)
    while True:
        part = get(f"{t}?select=*", f"{len(rows)}-{len(rows) + stap - 1}")
        if part is None:
            break
        rows += part
        if len(part) < stap:
            break
    json.dump(rows, open(f"out/{t}.json", "w"), ensure_ascii=False)
    print(f"{t}: {len(rows)} rijen")
