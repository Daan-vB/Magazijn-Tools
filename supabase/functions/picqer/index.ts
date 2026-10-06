// =====================================================================
//  IVOL Warehouse — Picqer-tussenstation (ALLEEN LEZEN)
//  Supabase Edge Function "picqer". Plak dit bestand in Supabase:
//  Edge Functions → Deploy a new function → Via Editor (naam: picqer).
//
//  Geheimen (Edge Functions → Secrets), nooit in de app of de repo:
//    PICQER_DOMAIN     bv. ivol.picqer.com
//    PICQER_KEY        Picqer API-sleutel
//    IVOL_CODE         zelfgekozen koppelcode; de app vraagt hem één keer per apparaat
//    PICQER_WAREHOUSE  (optioneel) idwarehouse Hoofdmagazijn, standaard 3857
//
//  Deze functie doet uitsluitend GET-verzoeken naar Picqer en geeft
//  geen klantgegevens door (geen namen, adressen of klantnummers).
//  Acties (?actie=…):
//    status      verbinding testen: magazijnen
//    vandaag     open picklijsten + backorders van het Hoofdmagazijn
//    producten   ?ids=1,2,3 → productcode, naam, barcode en voorraad per locatie
// =====================================================================

const DOMEIN = (Deno.env.get("PICQER_DOMAIN") || "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
const SLEUTEL = (Deno.env.get("PICQER_KEY") || "").trim();
const CODE = (Deno.env.get("IVOL_CODE") || "").trim();
const MAGAZIJN = Number(Deno.env.get("PICQER_WAREHOUSE") || "3857");
const BASIS = Deno.env.get("PICQER_BASE") || (DOMEIN ? "https://" + (DOMEIN.includes(".") ? DOMEIN : DOMEIN + ".picqer.com") + "/api/v1" : "");
const HERKOMST = ["https://daan-vb.github.io"];
const UA = "IVOL Warehouse (github.com/Daan-vB/Magazijn-Tools)";

function cors(origin: string | null): Record<string, string> {
  const ok = origin && (HERKOMST.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
  return {
    "Access-Control-Allow-Origin": ok ? origin! : HERKOMST[0],
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "apikey, authorization, x-client-info, content-type, x-ivol-code",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
function antwoord(data: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
class Fout extends Error {
  status: number;
  constructor(bericht: string, status = 502) { super(bericht); this.status = status; }
}
const wacht = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- Picqer: enige netwerkfunctie, altijd GET ----------
async function pq(pad: string): Promise<any> {
  for (let poging = 1; ; poging++) {
    let r: Response;
    try {
      r = await fetch(BASIS + "/" + pad, {
        method: "GET",
        headers: { "Authorization": "Basic " + btoa(SLEUTEL + ":"), "Accept": "application/json", "User-Agent": UA },
      });
    } catch (_e) {
      if (poging < 3) { await wacht(1000 * poging); continue; }
      throw new Fout("Picqer niet bereikbaar (" + pad.split("?")[0] + ")");
    }
    if (r.status === 429 && poging < 4) { await wacht(1000 * Math.min(20, Number(r.headers.get("Retry-After")) || 5)); continue; }
    if (r.status >= 500 && poging < 3) { await wacht(1500 * poging); continue; }
    const t = await r.text();
    if (r.status === 401 || r.status === 403) throw new Fout("Picqer weigert de API-sleutel (status " + r.status + ")", 502);
    if (!r.ok) {
      let m = ""; try { m = JSON.parse(t).error_message || ""; } catch (_e) { /* geen json */ }
      throw new Fout("Picqer gaf status " + r.status + " op " + pad.split("?")[0] + (m ? ": " + m : ""));
    }
    try { return JSON.parse(t); } catch (_e) { throw new Fout("Picqer gaf geen geldige gegevens (" + pad.split("?")[0] + ")"); }
  }
}
// alle pagina's (100 per keer)
async function alles(pad: string, max: number): Promise<any[]> {
  const uit: any[] = [];
  for (let off = 0; off < max; off += 100) {
    const r = await pq(pad + (pad.includes("?") ? "&" : "?") + "offset=" + off);
    if (!Array.isArray(r) || !r.length) break;
    uit.push(...r);
    if (r.length < 100) break;
  }
  return uit;
}
// kleine parallelle verwerking, vriendelijk voor de limiet van Picqer
async function perStuk<T, U>(lijst: T[], n: number, f: (x: T) => Promise<U>): Promise<U[]> {
  const uit: U[] = new Array(lijst.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, lijst.length) }, async () => {
    while (i < lijst.length) { const j = i++; uit[j] = await f(lijst[j]); }
  }));
  return uit;
}

// ---------- korte cache (scheelt verzoeken bij herladen) ----------
const CACHE = new Map<string, { t: number; d: unknown }>();
async function bewaard<T>(sleutel: string, sec: number, f: () => Promise<T>): Promise<T> {
  const c = CACHE.get(sleutel);
  if (c && Date.now() - c.t < sec * 1000) return c.d as T;
  const d = await f();
  CACHE.set(sleutel, { t: Date.now(), d });
  if (CACHE.size > 2000) CACHE.clear();
  return d;
}

// ---------- acties ----------
async function status() {
  const w = await pq("warehouses");
  return {
    magazijn: MAGAZIJN,
    magazijnen: (Array.isArray(w) ? w : []).map((x: any) => ({ id: x.idwarehouse, naam: x.name, actief: x.active !== false })),
  };
}

async function vandaag() {
  const picks = async (st: string) => alles("picklists?status=" + st + "&idwarehouse=" + MAGAZIJN, 3000);
  const [nieuw, pauze, snooze, bo] = await Promise.all([picks("new"), picks("paused"), picks("snoozed"), alles("backorders", 6000)]);
  const pl = (p: any) => ({
    id: p.idpicklist, nr: p.picklistid, s: p.status, u: !!p.urgent, c: p.created,
    d: p.preferred_delivery_date || null, n: p.totalproducts ?? null, gp: p.totalpicked ?? null, toegewezen: !!p.assigned_to_iduser,
  });
  return {
    opgehaald: new Date().toISOString(),
    magazijn: MAGAZIJN,
    picklijsten: nieuw.concat(pauze).map(pl),
    gesnoozed: snooze.length,
    backorders: bo
      .filter((b: any) => !b.idwarehouse || Number(b.idwarehouse) === MAGAZIJN)
      .map((b: any) => ({
        id: b.idbackorder, o: b.idorder, p: b.idproduct, a: Number(b.amount) || 0, v: Number(b.amount_available) || 0,
        pr: b.priority ?? null, c: b.created_at || null, ink: !!b.is_purchased,
      })),
  };
}

async function producten(idsTxt: string) {
  const ids = [...new Set(String(idsTxt || "").split(",").map((x) => parseInt(x, 10)).filter((x) => x > 0))].slice(0, 150);
  if (!ids.length) throw new Fout("Geen producten gevraagd", 400);
  const lijst = await perStuk(ids, 4, (id) => bewaard("p:" + id, 120, async () => {
    const [p, locs] = await Promise.all([pq("products/" + id), pq("products/" + id + "/locations")]);
    return {
      id,
      code: p.productcode,
      naam: p.name,
      ean: p.barcode || "",
      abc: p.analysis_abc_classification || "",
      perDag: p.analysis_pick_amount_per_day ?? null,
      loc: (Array.isArray(locs) ? locs : []).map((l: any) => {
        const s = l.stock_for_product || {};
        return {
          n: l.name, w: l.idwarehouse ?? null, b: !!l.is_bulk_location, t: l.type || "location", vk: !!l.is_preferred,
          v: Number(s.stock ?? l.stock ?? 0) || 0,
          r: Number(s.stock_reserved_picklists ?? l.stock_reserved_picklists ?? l.reserved_picklists ?? 0) || 0,
        };
      }),
    };
  }));
  return { opgehaald: new Date().toISOString(), magazijn: MAGAZIJN, producten: lijst };
}

// ---------- ingang ----------
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "GET") return antwoord({ fout: "Alleen lezen: deze functie accepteert alleen GET." }, 405, origin);
  if (!BASIS || !SLEUTEL) return antwoord({ fout: "PICQER_DOMAIN of PICQER_KEY ontbreekt bij de Secrets in Supabase." }, 500, origin);
  if (!CODE) return antwoord({ fout: "IVOL_CODE ontbreekt bij de Secrets in Supabase." }, 500, origin);
  if ((req.headers.get("x-ivol-code") || "").trim() !== CODE) return antwoord({ fout: "Koppelcode klopt niet.", code: "koppelcode" }, 401, origin);
  const url = new URL(req.url);
  const actie = url.searchParams.get("actie") || "status";
  try {
    if (actie === "status") return antwoord(await bewaard("status", 60, status), 200, origin);
    if (actie === "vandaag") {
      const vers = url.searchParams.get("vers") === "1";
      if (vers) CACHE.delete("vandaag");
      return antwoord(await bewaard("vandaag", 45, vandaag), 200, origin);
    }
    if (actie === "producten") return antwoord(await producten(url.searchParams.get("ids") || ""), 200, origin);
    return antwoord({ fout: "Onbekende actie: " + actie }, 400, origin);
  } catch (e) {
    const f = e instanceof Fout ? e : new Fout(String((e as Error)?.message || e));
    return antwoord({ fout: f.message }, f.status, origin);
  }
});
