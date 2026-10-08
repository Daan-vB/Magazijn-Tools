# Schrijft door Claude verwerkte productdata weg (alleen tabel productdata, read-merge-upsert).
# Invoer: .github/claude/<naam>.json  { naam, datum, regels:[{code, zet:[[veld, waarde, bron, reden, verwacht]]}] }
# Veiligheid: een veld wordt alleen gezet als het leeg is, of automatisch ingevuld (bron auto),
# of als "verwacht" is opgegeven en de huidige waarde daar precies gelijk aan is.
# Wat Daan zelf heeft ingevuld wordt nooit overschreven. Het log toont alleen aantallen en codes.
import json, sys, os, datetime, urllib.request, urllib.parse

URL = "https://jarbgetbwkjtxwtcfwmq.supabase.co/rest/v1/"
KEY = "sb_publishable_Jn8gTTPRy7rkoDikFjQlow_V0wcO8rA"   # publieke sleutel, staat ook in wh/core.js


def samenvoegen(rij, zet, nu):
    data, meta = dict(rij.get("data") or {}), dict(rij.get("meta") or {})
    gezet, overgeslagen = [], []
    for veld, waarde, bron, reden, verwacht in zet:
        cv = data.get(veld)
        cv = cv.get("v") if isinstance(cv, dict) else cv
        cb = (meta.get(veld) or {}).get("bron")
        leeg = cv is None or str(cv).strip() == ""
        if verwacht is not None:
            mag = str(cv) == str(verwacht)
        else:
            mag = leeg or cb == "auto"
        if not mag:
            overgeslagen.append(veld)
            continue
        data[veld] = str(waarde)
        meta[veld] = {"op": nu, "bron": bron, "uit": reden}
        gezet.append(veld)
    return {"productcode": rij["productcode"], "data": data, "meta": meta, "updated_at": nu}, gezet, overgeslagen


def req(method, path, body=None, extra=None):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "User-Agent": "ivol-claude/1.0"}
    if body is not None:
        h["Content-Type"] = "application/json"
    h.update(extra or {})
    r = urllib.request.Request(URL + path, method=method, headers=h, data=None if body is None else json.dumps(body).encode())
    with urllib.request.urlopen(r, timeout=120) as x:
        t = x.read()
        return json.loads(t) if t else None


def main(bestand):
    p = json.load(open(bestand))
    nu = datetime.datetime.now(datetime.timezone.utc).isoformat()
    codes = [r["code"] for r in p["regels"]]
    lijst = ",".join('"' + c.replace('"', '\\"') + '"' for c in codes)
    huidig = {r["productcode"]: r for r in req("GET", "productdata?select=productcode,data,meta&productcode=in.(" + urllib.parse.quote(lijst) + ")") or []}
    rijen, n_gezet, n_over = [], 0, 0
    for r in p["regels"]:
        rij = huidig.get(r["code"]) or {"productcode": r["code"], "data": {}, "meta": {}}
        nieuw, gezet, over = samenvoegen(rij, r["zet"], nu)
        n_gezet += len(gezet); n_over += len(over)
        if over:
            print(f"{r['code']}: niet overschreven (eigen invoer): {', '.join(over)}")
        if gezet:
            rijen.append(nieuw)
    if rijen:
        req("POST", "productdata?on_conflict=productcode", rijen, {"Prefer": "resolution=merge-duplicates,return=minimal"})
    print(f"{p['naam']}: {n_gezet} waarden gezet voor {len(rijen)} producten, {n_over} overgeslagen")


if __name__ == "__main__":
    for f in sys.argv[1:]:
        main(f)
