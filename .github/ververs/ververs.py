# Ververst verkoop per maand, voorraad per locatie en de locatielijst uit live Picqer (ALLEEN LEZEN uit Picqer).
# Draait in GitHub Actions (.github/workflows/ververs.yml), elke nacht en op knop.
#
#  - Picqer wordt alleen gelezen, via het tussenstation (Supabase-functie "picqer", alleen GET).
#    Inloggen bij het tussenstation met het bestaande SUPABASE_ACCESS_TOKEN (header x-ivol-beheer): de functie vraagt Supabase
#    zelf of het token de functie mag lezen. Er komt geen nieuwe sleutel bij en niets staat in de repo.
#  - Twee tellingen verkoop (Daan 22-11): verkoop-gepickt = fysieke picks uit de voorraadmutaties, op pickdatum (onderdelen van sets
#    wel, sets zelf niet) voor ABC en aanvulniveaus: wh-verkoop-gepickt, wh-verkoop-mnd en tabel verkoop. verkoop-besteld = bestellingen
#    op besteldatum voor inkoop en backorders: wh-verkoop-besteld (met gemiddelde per maand).
#  - Schrijven gebeurt alleen in onze eigen Supabase-opslag (catalog-rijen wh-verkoop-gepickt, wh-verkoop-besteld, wh-verkoop-mnd,
#    wh-voorraad, wh-locaties, tabel verkoop) met dezelfde publieke sleutel als de app. Vóór de eerste overschrijving per rij komt er een
#    kopie (wh-kopie-<naam>-20261121; verkoop-mnd en tabel verkoop ook -20261122, vóór de wissel naar gepickt).
#  - De log van een openbare repo is openbaar: hier staan dus alleen aantallen en totalen, nooit producten of klanten.
#    De productafwijkingen staan in catalog-rij wh-ververs-controle (alleen in de eigen database).
import argparse, datetime, json, os, re, sys, time, urllib.error, urllib.parse, urllib.request
from zoneinfo import ZoneInfo

PROJECT = "jarbgetbwkjtxwtcfwmq"                                   # Palletlabels
SB = f"https://{PROJECT}.supabase.co"
KEY = "sb_publishable_Jn8gTTPRy7rkoDikFjQlow_V0wcO8rA"             # publieke sleutel, staat ook in wh/core.js
MAGAZIJN = 3857                                                   # Hoofdmagazijn
KOPIE = "20261121"
MIN_VERSIE = "2026-11-22.2"
NL = ZoneInfo("Europe/Amsterdam")
UA = "ivol-ververs/1.0"
INLOG = {}                                                        # header voor het tussenstation


def log(*a):
    print(*a, flush=True)


# ---------- tussenstation ----------
def verberg(t):
    """Foutteksten voor de openbare log: elke sleutel of token eruit, één regel, kort."""
    t = re.sub(r"eyJ[\w-]+\.[\w-]+\.[\w-]+|sb_(?:secret|publishable)_[\w-]+|sbp_[\w-]+", "‹verborgen›", str(t))
    return re.sub(r"\s+", " ", t).strip()[:300]


def inloggen():
    """Het tussenstation vraagt Supabase zelf of dit token de functie picqer van ons project mag lezen (het recht waarmee
    supabase-functies.yml hem live zet). Sleutels van het project mag dit token niet lezen (api_gateway_keys_read ontbreekt),
    dus er wordt geen sleutel opgehaald."""
    tok = os.environ.get("SUPABASE_ACCESS_TOKEN", "").strip()
    if not tok:
        raise SystemExit("SUPABASE_ACCESS_TOKEN ontbreekt bij de secrets")
    INLOG.clear()
    INLOG["x-ivol-beheer"] = tok
    try:
        fn("status", pogingen=3)
    except Exception as e:
        rechten(tok)
        raise SystemExit("Inloggen bij het tussenstation lukt niet: " + verberg(e))
    log("Ingelogd bij het tussenstation met het Supabase-token")
    # zelftest: een fout token wordt geweigerd, en met het echte token kan alleen een lees-actie van de ververs
    for naam, kop, actie, goed in (("fout token", {"x-ivol-beheer": "sbp_" + os.urandom(20).hex()}, "status", (401,)),
                                   ("andere actie met het token", INLOG, "vandaag", (403,))):
        r = urllib.request.Request(f"{SB}/functions/v1/picqer?actie={actie}", headers={"apikey": KEY, "User-Agent": UA, **kop})
        try:
            with urllib.request.urlopen(r, timeout=60) as x:
                code = x.status
        except urllib.error.HTTPError as e:
            code = e.code
        if code not in goed:
            raise SystemExit(f"Controle mislukt: {naam} gaf HTTP {code}, verwacht {goed[0]}")
        log(f"Controle: {naam} geweigerd (HTTP {code})")


def rechten(tok):
    """Alleen bij een fout: welke beheer-onderdelen dit token mag lezen (alleen status en ontbrekend recht, nooit inhoud)."""
    for pad in ("", "/functions", "/functions/picqer", "/secrets", "/postgrest", "/config/auth", "/database/backups"):
        r = urllib.request.Request(f"https://api.supabase.com/v1/projects/{PROJECT}{pad}",
                                   headers={"Authorization": "Bearer " + tok, "User-Agent": UA, "Accept": "application/json"})
        try:
            with urllib.request.urlopen(r, timeout=30) as x:
                uit = f"HTTP {x.status}"
        except urllib.error.HTTPError as e:
            try:
                mis = json.loads(e.read()).get("error", {}).get("missing_permissions") or []
            except Exception:
                mis = []
            uit = f"HTTP {e.code}" + (" · mist " + ", ".join(map(str, mis)) if mis else "")
        except Exception as e:
            uit = type(e).__name__
        log(f"  token-recht /projects/…{pad or ' (project)'}: {uit}")


def fn(actie, params=None, pogingen=8):
    qs = urllib.parse.urlencode(dict({"actie": actie}, **(params or {})))
    laatste = ""
    for n in range(1, pogingen + 1):
        r = urllib.request.Request(f"{SB}/functions/v1/picqer?{qs}",
                                   headers={"apikey": KEY, "User-Agent": UA, **INLOG})
        try:
            with urllib.request.urlopen(r, timeout=130) as x:
                return json.loads(x.read())
        except urllib.error.HTTPError as e:
            t = e.read().decode(errors="replace")
            try:
                j = json.loads(t)
            except Exception:
                j = {}
            laatste = f"{actie}: HTTP {e.code} {(j.get('fout') or t)[:160]}"
            if e.code in (400, 401, 403, 404) and not j.get("wacht"):
                raise RuntimeError(laatste)
            sec = min(90, j.get("wachtSec") or 5 * n)
        except Exception as e:                                   # netwerk, time-out
            laatste = f"{actie}: {type(e).__name__} {str(e)[:120]}"
            sec = 5 * n
        log(f"  poging {n} mislukt ({laatste}); wacht {sec} s")
        time.sleep(sec)
    raise RuntimeError("tussenstation gaf geen antwoord: " + laatste)


# ---------- eigen opslag (Supabase REST, publieke sleutel zoals de app) ----------
def rest(method, pad, body=None, extra=None, pogingen=4):
    h = {"apikey": KEY, "Authorization": "Bearer " + KEY, "User-Agent": UA}
    if body is not None:
        h["Content-Type"] = "application/json"
    h.update(extra or {})
    for n in range(1, pogingen + 1):
        r = urllib.request.Request(SB + "/rest/v1/" + pad, method=method, headers=h,
                                   data=None if body is None else json.dumps(body, ensure_ascii=False).encode())
        try:
            with urllib.request.urlopen(r, timeout=180) as x:
                t = x.read()
                return json.loads(t) if t else None
        except urllib.error.HTTPError as e:
            t = e.read().decode(errors="replace")
            if e.code >= 500 and n < pogingen:
                time.sleep(3 * n)
                continue
            err = RuntimeError(f"{method} {pad.split('?')[0]}: HTTP {e.code} {t[:200]}")
            err.body = t
            raise err
        except Exception:
            if n < pogingen:
                time.sleep(3 * n)
                continue
            raise


def tabel(naam, qs):
    uit = []
    while True:
        deel = rest("GET", f"{naam}?{qs}", extra={"Range": f"{len(uit)}-{len(uit) + 999}", "Range-Unit": "items"})
        uit += deel
        if len(deel) < 1000:
            return uit


def cat_haal(key):
    r = rest("GET", "catalog?key=eq." + urllib.parse.quote(key) + "&select=data,updated_at")
    return r[0] if r else None


MODE = ["wh"]


def cat_zet(key, data):
    nu = datetime.datetime.now(datetime.timezone.utc).isoformat()
    for _ in range(2):
        try:
            rest("POST", "catalog?on_conflict=key", [{"key": key, "mode": MODE[0], "data": data, "updated_at": nu}],
                 {"Prefer": "resolution=merge-duplicates,return=minimal"})
            return
        except RuntimeError as e:
            if MODE[0] == "wh" and any(x in getattr(e, "body", "") for x in ("23514", "check", "mode")):
                MODE[0] = "ean"
                continue
            raise


def kopie(naam, data, wanneer=None):
    """Eerste keer: kopie van wat we gaan overschrijven. Bestaat de kopie al, dan blijft hij staan."""
    sleutel = f"wh-kopie-{naam}-{wanneer or KOPIE}"
    if cat_haal(sleutel) is None:
        cat_zet(sleutel, {"kopie_van": naam, "gemaakt": iso_nu(), "data": data})
        log(f"  kopie gemaakt: {sleutel}")


def iso_nu():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def afr(x, n=2):
    return round(x * 10 ** n) / 10 ** n


# ---------- producten (codes en leveranciers) ----------
def producten():
    rijen = tabel("producten", "select=productcode,leverancier&order=productcode")
    return {r["productcode"]: r.get("leverancier") for r in rijen if r.get("productcode")}


# ---------- verkoop per maand ----------
def maandvenster(vandaag):
    """13 volle maanden vóór de lopende maand + de lopende maand: [(ym, sinds, tot, volledig)]"""
    jr, mnd = vandaag.year, vandaag.month
    lijst = []
    for i in range(13, -1, -1):
        y, m = jr, mnd - i
        while m < 1:
            y, m = y - 1, m + 12
        eerste = datetime.date(y, m, 1)
        volgende = datetime.date(y + (m == 12), m % 12 + 1, 1)
        laatste = volgende - datetime.timedelta(days=1)
        lopend = i == 0
        tot = vandaag.strftime("%Y-%m-%d") + " " + datetime.datetime.now(NL).strftime("%H:%M:%S") if lopend else laatste.strftime("%Y-%m-%d") + " 23:59:59"
        lijst.append((f"{y}-{m:02d}", eerste.strftime("%Y-%m-%d") + " 00:00:00", tot, not lopend))
    return lijst


def venster_ophalen(sinds, tot, hoofd):
    som, off, orders, magazijnen, ander = {}, 0, 0, {}, 0
    for _ in range(400):
        r = fn("bestellingen", {"sinds": sinds, "tot": tot, "offset": off, "paginas": 10, **({"mag": "1"} if hoofd else {})})
        for dag, code, a in r.get("rijen", []):
            som[code] = som.get(code, 0) + (a or 0)
        orders += r.get("orders", 0)
        ander += r.get("anderMag", 0)
        for k, v in (r.get("magazijnen") or {}).items():
            magazijnen[k] = magazijnen.get(k, 0) + v
        if r.get("wachtSec"):
            time.sleep(min(30, r["wachtSec"]))
        off = r.get("volgende")
        if off is None:
            return som, orders, magazijnen, ander
    raise RuntimeError("te veel pagina's in één maand")


def gepickt_ophalen(sinds, tot):
    """Fysieke picks in één venster: [(dag, idproduct, aantal)], alle pagina's (picking min pickingrollback, Hoofdmagazijn)."""
    rijen, off, regels = [], 0, 0
    for _ in range(3000):
        r = fn("gepickt", {"sinds": sinds, "tot": tot, "offset": off, "paginas": 10})
        rijen += r.get("rijen", [])
        regels += r.get("regels", 0)
        if r.get("wachtSec"):
            time.sleep(min(30, r["wachtSec"]))
        off = r.get("volgende")
        if off is None:
            return rijen, regels
    raise RuntimeError("te veel pagina's voorraadmutaties in één maand")


def ids_naar_codes(ids, bekend):
    """idproduct -> productcode: eerst wat we al weten (catalogus, eigen index, vorige nacht), dan het tussenstation (gepickt&ids)."""
    uit = {i: bekend[i] for i in ids if bekend.get(i)}
    open_, weg = [i for i in ids if i not in uit], []
    for ronde in range(6):
        if not open_:
            break
        nog = []
        for k in range(0, len(open_), 60):
            deel = open_[k:k + 60]
            terug = {int(x): c for x, c in fn("gepickt", {"ids": ",".join(map(str, deel))}).get("codes", [])}
            for i in deel:
                if i not in terug:
                    nog.append(i)
                elif terug[i]:
                    uit[i] = terug[i]
                else:
                    weg.append(i)
            time.sleep(1)
        open_ = nog
    return uit, open_ + weg


def gem_6(M, maanden, vandaag):
    """De laatste 6 maanden voor het gemiddelde per maand; de lopende maand telt alleen mee als hij bijna vol is (>= 90%)."""
    dagen = (datetime.date(vandaag.year + (vandaag.month == 12), vandaag.month % 12 + 1, 1) - datetime.date(vandaag.year, vandaag.month, 1)).days
    lopend = maanden[-1]
    mee_lopend = vandaag.day / dagen >= 0.9
    basis = maanden if mee_lopend else [m for m in maanden if m != lopend]
    laatste = basis[-6:]
    y, m = map(int, laatste[-1].split("-"))
    eind = datetime.date(y + (m == 12), m % 12 + 1, 1) - datetime.timedelta(days=1)
    return laatste, laatste[0] + "-01", eind.strftime("%Y-%m-%d"), mee_lopend


def verkoop_gepickt(prod, venster, vandaag):
    """verkoop-gepickt (Daan 22-11): fysieke picks uit de voorraadmutaties, op pickdatum. Afgesloten maanden van vóór vorige maand
    blijven uit de vorige nacht staan; de rest wordt opnieuw gelezen."""
    vorig = (cat_haal("wh-verkoop-gepickt") or {}).get("data") or {}
    klein = {c.lower(): c for c in prod}
    bekend = {int(k): v for k, v in (vorig.get("ids") or {}).items()}
    for k, v in ((cat_haal("wh-hist-index") or {}).get("data") or {}).get("p", {}).items():
        bekend.setdefault(int(k), v)
    van = 0
    while van < 100000:                                         # verse codes van producten met voorraad
        r = fn("catalogus", {"van": van})
        for x in r.get("rijen", []):
            bekend[int(x[0])] = x[1]
        if r.get("klaar"):
            break
        van = r.get("volgende", van + 1000)
        time.sleep(2)
    houd = {venster[-1][0], venster[-2][0]}                      # lopende en vorige maand altijd opnieuw
    M_oud = {}
    for i, ym in enumerate(vorig.get("maanden", [])):
        if ym in (vorig.get("compleet") or []) and ym not in houd:
            M_oud[ym] = {c: a[i] for c, a in vorig.get("v", {}).items() if i < len(a) and a[i]}
    per_id, regels_tot, gelezen = {}, 0, []
    for ym, sinds, tot, vol in venster:
        if ym in M_oud:
            continue
        rijen, regels = gepickt_ophalen(sinds, tot)
        per = per_id.setdefault(ym, {})
        for dag, pid, a in rijen:
            per[int(pid)] = per.get(int(pid), 0) + (a or 0)
        regels_tot += regels
        gelezen.append(ym)
        log(f"  {ym}: {len(per)} producten gepickt, {afr(sum(per.values()), 0):.0f} stuks{'' if vol else ' (lopende maand, tot nu)'}")
    ids = sorted({i for per in per_id.values() for i in per})
    codes, onbekend = ids_naar_codes(ids, bekend)
    M = dict(M_oud)
    for ym, per in per_id.items():
        m = {}
        for pid, a in per.items():
            c = codes.get(pid)
            if c:
                c = klein.get(c.lower(), c)
                m[c] = m.get(c, 0) + a
        M[ym] = {c: round(a) for c, a in m.items() if round(a) > 0}        # aantallen zonder decimalen
    maanden = [ym for ym, *_ in venster]
    mis = sum(per.get(i, 0) for per in per_id.values() for i in onbekend)
    log(f"  verkoop-gepickt: {len(gelezen)} maanden gelezen, {len(M_oud)} uit de vorige nacht · {regels_tot} mutaties · "
        f"{len(onbekend)} producten niet op code te zetten ({afr(mis, 0):.0f} stuks)")
    return M, maanden, {str(i): c for i, c in codes.items()}, onbekend, mis


def verkoop(prod):
    vandaag = datetime.datetime.now(NL).date()
    venster = maandvenster(vandaag)
    log(f"Verkoop: {venster[0][0]} t/m {venster[-1][0]} ({len(venster) - 1} volle maanden + lopende maand)")
    klein = {c.lower(): c for c in prod}
    # ---- verkoop-besteld: bestellingen op besteldatum (sets als set) — voor inkoop en backorders
    nieuw, magtot, anderTot = {}, {}, 0
    for ym, sinds, tot, vol in venster:
        som, orders, mg, ander = venster_ophalen(sinds, tot, True)
        som = {klein.get(c.lower(), c): a for c, a in som.items()}
        tel = sum(som.values())
        log(f"  besteld {ym}: {orders} orders, {len(som)} producten, {afr(tel, 0):.0f} stuks{'' if vol else ' (lopende maand, tot nu)'}")
        if vol and tel <= 0:
            raise RuntimeError(f"maand {ym} is leeg: niets opgeslagen")
        nieuw[ym] = som
        anderTot += ander
        for k, v in mg.items():
            magtot[k] = magtot.get(k, 0) + v
    log("  orders per magazijn-id volgens Picqer: " + ", ".join(f"{k}={v}" for k, v in sorted(magtot.items())) + f" · overgeslagen als ander magazijn: {anderTot}")
    # ---- verkoop-gepickt: fysieke picks op pickdatum (onderdelen van sets wel, sets zelf niet) — voor ABC en aanvulniveaus
    G, maanden, idcodes, onbekend, mis = verkoop_gepickt(prod, venster, vandaag)
    for ym, sinds, tot, vol in venster:
        if vol and sum(G.get(ym, {}).values()) <= 0:
            raise RuntimeError(f"gepickt {ym} is leeg: niets opgeslagen")
    laatste, van, tot, mee_lopend = gem_6(G, maanden, vandaag)
    idx = [maanden.index(m) for m in laatste]
    controle = {"magazijnen": magtot, "andermag": anderTot}

    def inpakken(M):
        codes = set()
        for ym in maanden:
            codes |= set(M.get(ym, {}))
        return {c: [afr(M.get(ym, {}).get(c, 0)) for ym in maanden] for c in codes}

    vb, vg = inpakken(nieuw), inpakken(G)
    nu = iso_nu()
    lopend = venster[-1][0]
    gem_b = {c: afr(sum(a[i] for i in idx) / len(laatste)) for c, a in vb.items() if sum(a[i] for i in idx)}
    cat_zet("wh-verkoop-besteld", {"maanden": maanden, "v": vb, "gem": gem_b, "periode": {"van": van, "tot": tot, "maanden": len(laatste)},
                                   "datum": nu, "bron": "picqer-bestellingen", "lopend": lopend})
    cat_zet("wh-verkoop-besteld-gem", {"gem": gem_b, "periode": {"van": van, "tot": tot, "maanden": len(laatste)}, "datum": nu, "bron": "picqer-bestellingen"})
    log(f"  wh-verkoop-besteld: {len(maanden)} maanden, {len(vb)} producten · gemiddelde per maand in wh-verkoop-besteld-gem")
    cat_zet("wh-verkoop-gepickt", {"maanden": maanden, "v": vg, "datum": nu, "bron": "picqer-voorraadmutaties", "lopend": lopend,
                                   "compleet": [ym for ym, *_r, vol in venster if vol], "ids": idcodes})
    oud_rij = cat_haal("wh-verkoop-mnd")
    kopie("wh-verkoop-mnd", oud_rij["data"] if oud_rij else None, "20261122")       # vóór de wissel naar gepickt
    cat_zet("wh-verkoop-mnd", {"maanden": maanden, "v": vg, "datum": nu, "bron": "picqer-voorraadmutaties", "lopend": lopend})
    log(f"  wh-verkoop-gepickt en wh-verkoop-mnd: {len(maanden)} maanden, {len(vg)} producten")

    # tabel verkoop (ABC, aanvulniveaus, Productdata) = verkoop-gepickt, gemiddelde van de laatste 6 maanden
    verkooptabel = tabel("verkoop", "select=*")
    kopie("verkoop", verkooptabel, "20261122")
    rijen = []
    for c in set(prod) | set(vg):
        a = sum(vg[c][i] for i in idx) if c in vg else 0
        rijen.append({"productcode": c, "leverancier": prod.get(c), "aantal": afr(a), "periode_van": van, "periode_tot": tot,
                      "maanden": len(laatste), "per_maand": afr(a / len(laatste)), "geimporteerd_op": nu})
    for i in range(0, len(rijen), 500):
        rest("POST", "verkoop?on_conflict=productcode", rijen[i:i + 500], {"Prefer": "resolution=merge-duplicates,return=minimal"})
    log(f"  tabel verkoop: {len(rijen)} producten, gemiddelde gepickt {laatste[0]} t/m {laatste[-1]} ({len(laatste)} maanden)")

    # controle (moet 0 zijn): gepickt in de 6 maanden, maar 0 verkoop in de tabel; plus picks die niet op een code te zetten zijn
    pm = {r["productcode"]: r["per_maand"] for r in rijen}
    nul = [c for c in vg if sum(vg[c][i] for i in idx) > 0 and not pm.get(c)]
    zonder_code = len(onbekend)
    log(f"  Controle verkoop-gepickt: {len(nul)} producten gepickt maar 0 verkoop (moet 0 zijn)")
    if zonder_code:                                             # product bestaat niet meer in Picqer: staat ook niet in de app
        print(f"::warning::{zonder_code} gepickte producten hebben geen productcode meer in Picqer ({afr(mis, 0):.0f} stuks)")
    tb = sum(sum(a[i] for i in idx) for a in vb.values()) / len(laatste)
    tg = sum(sum(a[i] for i in idx) for a in vg.values()) / len(laatste)
    log(f"  per maand (gemiddeld {len(laatste)} mnd): gepickt {tg:.0f} stuks · besteld {tb:.0f} stuks")
    controle.update({"laatsteMaand": maanden[-1], "gemiddelde": {"van": laatste[0], "tot": laatste[-1], "lopendMee": mee_lopend},
                     "gepicktZonderVerkoop": len(nul), "zonderCode": zonder_code, "zonderCodeStuks": afr(mis, 0)})
    if nul:
        raise RuntimeError(f"{len(nul)} producten gepickt maar 0 verkoop")
    return {"t": nu, "laatsteMaand": maanden[-1], "maanden": len(maanden), "producten": len(vg), "besteld": len(vb), "gepicktZonderVerkoop": 0}, controle


# ---------- locaties ----------
def locaties():
    bestaand = cat_haal("wh-locaties")
    oud = (bestaand or {}).get("data") or {}
    if len(oud.get("rows", [])) < 100:
        raise RuntimeError("wh-locaties in de database is leeg of te klein: niets overschreven")
    alle, van = [], 0
    while van < 30000:
        r = fn("locatielijst", {"van": van})
        alle += r.get("rijen", [])
        if r.get("klaar"):
            break
        van = r.get("volgende", van + 1000)
        time.sleep(2.5)
    if len(alle) < 100:
        raise RuntimeError(f"te weinig locaties terug uit Picqer ({len(alle)}): niets overschreven")
    naam_van = {x[0]: x[1] for x in alle}
    codes_van = {x[0]: (x[5] if len(x) > 5 else "") for x in oud["rows"]}      # productkoppelingen blijven uit de export
    codes_datum = (oud.get("codes") or None) if oud.get("bron") == "picqer-live" else oud.get("datum")
    rows = [[naam, bulk, tijd, excl, naam_van.get(parent, "") if parent else "", codes_van.get(naam, "")]
            for _id, naam, bulk, tijd, excl, parent, *_ in alle]
    kopie("wh-locaties", oud)
    nu = iso_nu()
    cat_zet("wh-locaties", {"datum": nu, "bron": "picqer-live", "codes": codes_datum, "rows": rows})
    log(f"Locaties: {len(rows)} locaties naar wh-locaties")
    return {"t": nu, "n": len(rows)}


# ---------- voorraad per locatie ----------
def voorraad():
    bestaand = cat_haal("wh-voorraad")
    oud = (bestaand or {}).get("data") or {}
    prod, van = [], 0                                           # [id, code, hm]
    while van < 100000:
        r = fn("catalogus", {"van": van})
        prod += [[x[0], x[1], x[2]] for x in r.get("rijen", []) if x[2] and x[2] > 0]
        if r.get("klaar"):
            break
        van = r.get("volgende", van + 1000)
        time.sleep(2)
    if len(prod) < 500:
        raise RuntimeError(f"te weinig producten met voorraad ({len(prod)}): niets overschreven")
    log(f"Voorraad: {len(prod)} producten met voorraad in het Hoofdmagazijn")
    per = {}                                                    # id -> locs
    open_ = [p[0] for p in prod]
    for ronde in (1, 2, 3):
        mislukt = []
        for i in range(0, len(open_), 60):
            r = fn("locaties", {"ids": ",".join(map(str, open_[i:i + 60]))})
            for pid, locs in r.get("lijst", []):
                if locs is None:
                    mislukt.append(pid)
                else:
                    per[pid] = locs
            if (i // 60) % 10 == 9:
                log(f"  {len(per)} van {len(prod)} producten gelezen")
            time.sleep(6)
        open_ = mislukt
        if not open_:
            break
        log(f"  ronde {ronde}: {len(open_)} producten nog niet gelezen, opnieuw")
        time.sleep(20)
    oude_rijen = {}
    for r_ in oud.get("rows", []):
        oude_rijen.setdefault(r_[0], []).append(r_)
    rows, geen_som, hm_som, loc_som, terug = [], 0, 0, 0, 0
    for pid, code, hm in prod:
        if pid not in per:
            if len(open_) > max(5, len(prod) * 0.005):
                raise RuntimeError(f"{len(open_)} producten niet gelezen: niets overschreven")
            rows += oude_rijen.get(code, [])                  # enkele uitvallers: oude regels laten staan
            terug += 1
            continue
        som = 0
        for naam, w, bulk, kar, n, res in per[pid]:
            if w is not None and int(w) != MAGAZIJN:
                continue
            n = int(n or 0)
            som += n
            if kar:
                rows.append([code, re.sub(r"^container\s*", "", str(naam), flags=re.I), n, 1])
            else:
                rows.append([code, naam, n, 0])
        geen = hm - som
        if geen > 0:
            rows.append([code, "", geen, 0])
            geen_som += geen
        loc_som += som
        hm_som += hm
    kopie("wh-voorraad", oud)
    nu = iso_nu()
    cat_zet("wh-voorraad", {"datum": nu, "bron": "picqer-live", "rows": rows})
    log(f"Voorraad: {len(rows)} regels naar wh-voorraad · {hm_som} stuks in het Hoofdmagazijn, waarvan {geen_som} op geen specifieke locatie · {terug} producten uit de oude stand")
    oud_tot = sum(r_[2] for r_ in oud.get("rows", []))
    return {"t": nu, "regels": len(rows), "producten": len(prod), "geen": geen_som, "stuksOud": oud_tot, "stuks": hm_som}


# ---------- hoofdprogramma ----------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--alleen", default="verkoop,locaties,voorraad")
    ap.add_argument("--zacht", action="store_true", help="overslaan als de vorige ververs minder dan 4 uur geleden was (nachtrun met twee kloktijden)")
    a = ap.parse_args()
    stap = [s.strip() for s in a.alleen.split(",") if s.strip()]
    meta_rij = cat_haal("wh-ververs")
    meta = (meta_rij or {}).get("data") or {}
    if a.zacht and meta.get("t"):
        t = datetime.datetime.fromisoformat(meta["t"].replace("Z", "+00:00"))
        if (datetime.datetime.now(datetime.timezone.utc) - t).total_seconds() < 4 * 3600:
            log("Vorige ververs was minder dan 4 uur geleden: niets te doen.")
            return
    # de nieuwe versie van het tussenstation moet live staan (inloggen met het Supabase-token, magazijnfilter bij bestellingen)
    with urllib.request.urlopen(urllib.request.Request(f"{SB}/functions/v1/picqer?actie=versie", headers={"apikey": KEY, "User-Agent": UA}), timeout=60) as x:
        live = json.loads(x.read()).get("versie", "")
    if live < MIN_VERSIE:
        raise SystemExit(f"Het tussenstation staat nog op versie {live}; nodig is {MIN_VERSIE}. Eerst Supabase-functies live zetten.")
    inloggen()
    fouten = []
    prod = producten()
    log(f"{len(prod)} producten in de database")
    controle = {}
    for naam in stap:
        try:
            if naam == "verkoop":
                meta["verkoop"], controle = verkoop(prod)
                cat_zet("wh-ververs-controle", dict(controle, t=iso_nu()))
            elif naam == "locaties":
                meta["locaties"] = locaties()
            elif naam == "voorraad":
                meta["voorraad"] = voorraad()
        except Exception as e:
            fouten.append(f"{naam}: {e}")
            print(f"::error::{naam}: {str(e)[:300]}")
            meta[naam + "_fout"] = {"t": iso_nu(), "fout": str(e)[:300]}
        else:
            meta.pop(naam + "_fout", None)
    meta["t"] = iso_nu()
    meta["fouten"] = fouten
    cat_zet("wh-ververs", meta)
    log("Klaar" + (f", met {len(fouten)} fout(en)" if fouten else " zonder fouten"))
    if fouten:
        sys.exit(1)


if __name__ == "__main__":
    main()
