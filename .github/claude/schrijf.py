# Schrijft door Claude verwerkte productdata weg (alleen tabel productdata, read-merge-upsert).
# Invoer: .github/claude/<naam>.json  { naam, datum, regels:[{code, zet:[[veld, waarde, bron, reden, verwacht]]}] }
# Zet-element: [veld, waarde, bron, reden, verwacht, vlag, vlag]. Vlaggen (in elke volgorde): "twijfel" (schatting, onder Te controleren)
# en "park" (besproken, telt als compleet, blijft zichtbaar in Notities; waarde null = data van het veld blijft zoals het is).
# Veiligheid: een veld wordt alleen gezet als het leeg is, of automatisch ingevuld (bron auto),
# of als "verwacht" is opgegeven en de huidige waarde daar precies gelijk aan is.
# "verwacht" mag een lijst zijn (elke waarde die nu mag staan); "" in die lijst of een leeg veld zonder eigen invoer telt ook.
# Wat Daan zelf heeft ingevuld (bron invul, spraak, tabel, overgezet) wordt nooit overschreven. Het log toont alleen aantallen en codes.
import json, sys, os, datetime, urllib.request, urllib.parse

URL = "https://jarbgetbwkjtxwtcfwmq.supabase.co/rest/v1/"
KEY = "sb_publishable_Jn8gTTPRy7rkoDikFjQlow_V0wcO8rA"   # publieke sleutel, staat ook in wh/core.js


EIGEN = {"invul", "spraak", "tabel", "overgezet"}


def samenvoegen(rij, zet, nu):
    data, meta = dict(rij.get("data") or {}), dict(rij.get("meta") or {})
    gezet, overgeslagen = [], []
    for item in zet:
        veld, waarde, bron, reden, verwacht = item[:5]
        vlaggen = {x for x in item[5:] if isinstance(x, str)}
        twijfel, park = "twijfel" in vlaggen, "park" in vlaggen
        cv = data.get(veld)
        cv = cv.get("v") if isinstance(cv, dict) else cv
        cb = (meta.get(veld) or {}).get("bron")
        leeg = cv is None or str(cv).strip() == ""
        if cb in EIGEN and not leeg:
            mag = False   # eigen invoer van Daan: nooit overschrijven
        elif park and waarde is None:
            mag = True    # alleen de notitie: de waarde die er staat blijft zoals hij is
        elif verwacht is not None:
            kand = verwacht if isinstance(verwacht, list) else [verwacht]
            mag = any(str(cv) == str(v) for v in kand) or (leeg and (cb not in EIGEN))
        else:
            mag = leeg or cb == "auto"
        if not mag:
            overgeslagen.append(veld)
            continue
        if park:
            if waarde is not None:
                data[veld] = str(waarde)
            meta[veld] = {"op": nu, "bron": bron, "uit": reden, "park": 1}   # besproken: telt als compleet, staat in Notities
            gezet.append(veld)
            continue
        data[veld] = str(waarde)
        meta[veld] = {"op": nu, "bron": bron, "uit": reden}
        if twijfel:
            meta[veld]["tw"] = 1   # schatting van Claude: in de app onder "Te controleren", telt niet als compleet in de poort
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
    huidig = {}
    for i in range(0, len(codes), 150):   # in stukken: een lange in.(...) past niet in één adres
        lijst = ",".join('"' + c.replace('"', '\\"') + '"' for c in codes[i:i + 150])
        for r in req("GET", "productdata?select=productcode,data,meta&productcode=in.(" + urllib.parse.quote(lijst) + ")") or []:
            huidig[r["productcode"]] = r
    rijen, n_gezet, n_over = [], 0, 0
    for r in p["regels"]:
        rij = huidig.get(r["code"]) or {"productcode": r["code"], "data": {}, "meta": {}}
        nieuw, gezet, over = samenvoegen(rij, r["zet"], nu)
        n_gezet += len(gezet); n_over += len(over)
        if over and len(p["regels"]) <= 200:
            print(f"{r['code']}: niet overschreven (eigen invoer): {', '.join(over)}")
        if gezet:
            rijen.append(nieuw)
    for i in range(0, len(rijen), 400):
        req("POST", "productdata?on_conflict=productcode", rijen[i:i + 400], {"Prefer": "resolution=merge-duplicates,return=minimal"})
    print(f"{p['naam']}: {n_gezet} waarden gezet voor {len(rijen)} producten, {n_over} overgeslagen")


if __name__ == "__main__":
    for f in sys.argv[1:]:
        main(f)
