# Ververst verkoop per maand, voorraad per locatie en de locatielijst uit live Picqer (ALLEEN LEZEN uit Picqer).
# Draait in GitHub Actions (.github/workflows/ververs.yml), elke nacht en op knop.
#
#  - Picqer wordt alleen gelezen, via het tussenstation (Supabase-functie "picqer", alleen GET).
#    Inloggen bij het tussenstation: de servicesleutel van het Supabase-project, die hier met het bestaande
#    SUPABASE_ACCESS_TOKEN wordt opgehaald. Er komt geen nieuwe sleutel bij en niets staat in de repo.
#  - Schrijven gebeurt alleen in onze eigen Supabase-opslag (catalog-rijen wh-verkoop-mnd, wh-voorraad, wh-locaties,
#    tabel verkoop) met dezelfde publieke sleutel als de app. Vóór de eerste overschrijving per rij komt er een kopie
#    (wh-kopie-<naam>-20261121).
#  - De log van een openbare repo is openbaar: hier staan dus alleen aantallen en totalen, nooit producten of klanten.
#    De productafwijkingen staan in catalog-rij wh-ververs-controle (alleen in de eigen database).
import argparse, datetime, json, os, re, sys, time, urllib.error, urllib.parse, urllib.request
from zoneinfo import ZoneInfo

PROJECT = "jarbgetbwkjtxwtcfwmq"                                   # Palletlabels
SB = f"https://{PROJECT}.supabase.co"
KEY = "sb_publishable_Jn8gTTPRy7rkoDikFjQlow_V0wcO8rA"             # publieke sleutel, staat ook in wh/core.js
MAGAZIJN = 3857                                                   # Hoofdmagazijn
KOPIE = "20261121"
MIN_VERSIE = "2026-11-21.2"
NL = ZoneInfo("Europe/Amsterdam")
UA = "ivol-ververs/1.0"
DIENST = ""


def log(*a):
    print(*a, flush=True)


# ---------- tussenstation ----------
def haal_dienstsleutel():
    tok = os.environ.get("SUPABASE_ACCESS_TOKEN", "").strip()
    if not tok:
        raise SystemExit("SUPABASE_ACCESS_TOKEN ontbreekt bij de secrets")
    r = urllib.request.Request(f"https://api.supabase.com/v1/projects/{PROJECT}/api-keys?reveal=true",
                               headers={"Authorization": "Bearer " + tok, "User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(r, timeout=60) as x:
        sleutels = json.loads(x.read())
    for k in sleutels:
        if k.get("name") == "service_role" and k.get("api_key"):
            print("::add-mask::" + k["api_key"])
            return k["api_key"]
    raise SystemExit("Geen service_role-sleutel gevonden bij het project")


def fn(actie, params=None, pogingen=8):
    qs = urllib.parse.urlencode(dict({"actie": actie}, **(params or {})))
    laatste = ""
    for n in range(1, pogingen + 1):
        r = urllib.request.Request(f"{SB}/functions/v1/picqer?{qs}",
                                   headers={"apikey": KEY, "x-ivol-dienst": DIENST, "User-Agent": UA})
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


def kopie(naam, data):
    """Eerste keer: kopie van wat we gaan overschrijven. Bestaat de kopie al, dan blijft hij staan."""
    sleutel = f"wh-kopie-{naam}-{KOPIE}"
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


def verkoop(prod):
    vandaag = datetime.datetime.now(NL).date()
    venster = maandvenster(vandaag)
    log(f"Verkoop: {venster[0][0]} t/m {venster[-1][0]} ({len(venster) - 1} volle maanden + lopende maand)")
    oud_rij = cat_haal("wh-verkoop-mnd")
    oud = (oud_rij or {}).get("data") or {"maanden": [], "v": {}}
    klein = {c.lower(): c for c in prod}
    nieuw, magtot, anderTot = {}, {}, 0
    for ym, sinds, tot, vol in venster:
        som, orders, mg, ander = venster_ophalen(sinds, tot, True)
        som = {klein.get(c.lower(), c): a for c, a in som.items()}
        tel = sum(som.values())
        log(f"  {ym}: {orders} orders, {len(som)} producten, {afr(tel, 0):.0f} stuks{'' if vol else ' (lopende maand, tot nu)'}")
        if vol and tel <= 0:
            raise RuntimeError(f"maand {ym} is leeg: niets opgeslagen")
        nieuw[ym] = som
        anderTot += ander
        for k, v in mg.items():
            magtot[k] = magtot.get(k, 0) + v
    log("  orders per magazijn-id volgens Picqer: " + ", ".join(f"{k}={v}" for k, v in sorted(magtot.items())) + f" · overgeslagen als ander magazijn: {anderTot}")

    # vergelijking september 2026 met de Excel-import (voor het overschrijven)
    controle = {"magazijnen": magtot, "andermag": anderTot}
    if "2026-09" in oud.get("maanden", []) and "2026-09" in nieuw:
        i = oud["maanden"].index("2026-09")
        oudsep = {c: a[i] for c, a in oud["v"].items() if i < len(a) and a[i]}
        nwsep = nieuw["2026-09"]
        codes = set(oudsep) | set(nwsep)
        afw, gelijk, nw_hoger, oud_hoger = [], 0, 0, 0
        for c in codes:
            o, n = oudsep.get(c, 0), nwsep.get(c, 0)
            m = max(abs(o), abs(n))
            if not m:
                continue
            if abs(n - o) / m <= 0.02:
                gelijk += 1
            else:
                afw.append([c, o, afr(n)])
                nw_hoger += n > o
                oud_hoger += o > n
        afw.sort(key=lambda x: -abs(x[2] - x[1]))
        controle["september"] = {
            "producten": gelijk + len(afw), "binnen_2pct": gelijk, "afwijkend": len(afw), "nieuw_hoger": nw_hoger, "oud_hoger": oud_hoger,
            "som_oud": afr(sum(oudsep.values())), "som_nieuw": afr(sum(nwsep.values())), "afwijkingen": afw,
        }
        s = controle["september"]
        log(f"  September 2026 live tegen Excel-import: {s['producten']} producten, {s['afwijkend']} wijken > 2% af "
            f"(live hoger {nw_hoger}, import hoger {oud_hoger}); totaal import {s['som_oud']:.0f} stuks, live {s['som_nieuw']:.0f} stuks")
    else:
        log("  September 2026 zat niet in de import: geen vergelijking")

    # samenvoegen: live maanden overschrijven, oudere maanden uit de import blijven
    kopie("wh-verkoop-mnd", oud_rij["data"] if oud_rij else None)
    M = {}
    for i, ym in enumerate(oud.get("maanden", [])):
        M[ym] = {c: a[i] for c, a in oud["v"].items() if i < len(a) and a[i]}
    M.update(nieuw)
    maanden = sorted(M)
    codes = set()
    for ym in maanden:
        codes |= set(M[ym])
    v = {c: [afr(M[ym].get(c, 0)) for ym in maanden] for c in codes}
    lopend = venster[-1][0]
    data = {"maanden": maanden, "v": v, "datum": iso_nu(), "bron": "picqer-bestellingen", "lopend": lopend}
    cat_zet("wh-verkoop-mnd", data)
    log(f"  wh-verkoop-mnd: {len(maanden)} maanden, {maanden[0]} t/m {maanden[-1]}, {len(v)} producten")

    # verkoop/maand = gemiddelde van de laatste 6 maanden; de lopende maand telt alleen mee als hij bijna vol is (>= 90%)
    dagen = (datetime.date(vandaag.year + (vandaag.month == 12), vandaag.month % 12 + 1, 1) - datetime.date(vandaag.year, vandaag.month, 1)).days
    mee_lopend = vandaag.day / dagen >= 0.9
    basis = maanden if mee_lopend else [m for m in maanden if m != lopend]
    laatste = basis[-6:]
    idx = [maanden.index(m) for m in laatste]
    y, m = map(int, laatste[-1].split("-"))
    eind = datetime.date(y + (m == 12), m % 12 + 1, 1) - datetime.timedelta(days=1)
    van, tot = laatste[0] + "-01", eind.strftime("%Y-%m-%d")
    verkooptabel = tabel("verkoop", "select=*")
    kopie("verkoop", verkooptabel)
    nu = iso_nu()
    rijen = []
    for c in set(prod) | codes:
        a = sum(v[c][i] for i in idx) if c in v else 0
        rijen.append({"productcode": c, "leverancier": prod.get(c), "aantal": afr(a), "periode_van": van, "periode_tot": tot,
                      "maanden": len(laatste), "per_maand": afr(a / len(laatste)), "geimporteerd_op": nu})
    for i in range(0, len(rijen), 500):
        rest("POST", "verkoop?on_conflict=productcode", rijen[i:i + 500], {"Prefer": "resolution=merge-duplicates,return=minimal"})
    log(f"  tabel verkoop: {len(rijen)} producten, gemiddelde {laatste[0]} t/m {laatste[-1]} ({len(laatste)} maanden)")
    controle["laatsteMaand"] = maanden[-1]
    controle["gemiddelde"] = {"van": laatste[0], "tot": laatste[-1], "lopendMee": mee_lopend}
    return {"t": nu, "laatsteMaand": maanden[-1], "maanden": len(maanden), "producten": len(v)}, controle


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
    global DIENST
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
    DIENST = haal_dienstsleutel()
    # de nieuwe versie van het tussenstation moet live staan (inloggen met de servicesleutel, magazijnfilter bij bestellingen)
    with urllib.request.urlopen(urllib.request.Request(f"{SB}/functions/v1/picqer?actie=versie", headers={"apikey": KEY, "User-Agent": UA}), timeout=60) as x:
        live = json.loads(x.read()).get("versie", "")
    if live < MIN_VERSIE:
        raise SystemExit(f"Het tussenstation staat nog op versie {live}; nodig is {MIN_VERSIE}. Eerst Supabase-functies live zetten.")
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
