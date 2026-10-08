// =====================================================================
//  IVOL Warehouse — Inkoophistorie uit Picqer (ALLEEN LEZEN, 9-10-2026)
//  Supabase Edge Function "picqer-inkoop". Zelfde geheimen als "picqer":
//    PICQER_DOMAIN, PICQER_KEY, IVOL_CODE (koppelcode, header x-ivol-code)
//
//  Doel: per product zien in welke hoeveelheden er wordt ingekocht
//  (volle pallets, of steeds een deel). Alleen inkooporders: geen klanten.
//  Acties (?stap=…):
//    lijst   ?sinds=JJJJ-MM-DD → alle inkooporders sinds die datum: id, datum, status,
//                                leverancier-id en (als Picqer ze meelevert) de regels
//    detail  ?ids=1,2,3        → regels van max. 60 inkooporders (als de lijst ze niet had)
//  Regel = [productcode, besteld, ontvangen]
// =====================================================================

const DOMEIN = (Deno.env.get("PICQER_DOMAIN") || "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
const SLEUTEL = (Deno.env.get("PICQER_KEY") || "").trim();
const CODE = (Deno.env.get("IVOL_CODE") || "").trim();
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
    if (r.status === 429 && poging < 5) { await wacht(1000 * Math.min(20, Number(r.headers.get("Retry-After")) || 5)); continue; }
    if (r.status >= 500 && poging < 3) { await wacht(1500 * poging); continue; }
    const t = await r.text();
    if (r.status === 401 || r.status === 403) throw new Fout("Picqer weigert de API-sleutel (status " + r.status + ")", 502);
    if (!r.ok) throw new Fout("Picqer gaf status " + r.status + " op " + pad.split("?")[0]);
    try { return JSON.parse(t); } catch (_e) { throw new Fout("Picqer gaf geen geldige gegevens (" + pad.split("?")[0] + ")"); }
  }
}
async function perStuk<T, U>(lijst: T[], n: number, f: (x: T) => Promise<U>): Promise<U[]> {
  const uit: U[] = new Array(lijst.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, lijst.length) }, async () => {
    while (i < lijst.length) { const j = i++; uit[j] = await f(lijst[j]); }
  }));
  return uit;
}
const getal = (o: any, velden: string[]) => {
  for (const v of velden) { const x = o && o[v]; const n = Number(x); if (x !== undefined && x !== null && x !== "" && isFinite(n)) return n; }
  return 0;
};
const tekst = (o: any, velden: string[]) => {
  for (const v of velden) { const x = o && o[v]; if (typeof x === "string" && x.trim()) return x.trim(); }
  return "";
};
const regels = (p: any) => (Array.isArray(p.products) ? p.products : []).map((r: any) => [
  tekst(r, ["productcode", "product_code"]),
  getal(r, ["amount", "amount_ordered", "amountordered"]),
  getal(r, ["amountreceived", "amount_received", "received"]),
]).filter((r: any[]) => r[0]);
const datum = (p: any) => tekst(p, ["purchased_at", "created_at", "updated_at"]).slice(0, 10);

// alle inkooporders sinds een datum; de lijst van Picqer heeft 100 per pagina
async function lijst(sinds: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sinds || "")) throw new Fout("Ongeldige datum", 400);
  const uit: any[] = [];
  let oudOpRij = 0, paginas = 0;
  for (let off = 0; off < 8000; off += 100) {
    const r = await pq("purchaseorders?offset=" + off);
    paginas++;
    if (!Array.isArray(r) || !r.length) break;
    r.forEach((p: any) => {
      const d = datum(p);
      if (d && d < sinds) { oudOpRij++; return; }
      oudOpRij = 0;
      uit.push([p.idpurchaseorder, d, String(p.status || ""), p.idsupplier || null, Array.isArray(p.products) ? regels(p) : null]);
    });
    if (r.length < 100) break;
    if (oudOpRij >= 300) break;   // drie pagina's achter elkaar ouder dan gevraagd: klaar (lijst loopt van nieuw naar oud)
  }
  return { bron: "picqer-purchaseorders", versie: 1, sinds, paginas, opgehaald: new Date().toISOString(), orders: uit };
}
async function detail(idsTxt: string) {
  const ids = String(idsTxt || "").split(",").map((x) => parseInt(x, 10)).filter((x) => x > 0).slice(0, 60);
  if (!ids.length) throw new Fout("Geen inkooporders gevraagd", 400);
  const r = await perStuk(ids, 3, (id) => pq("purchaseorders/" + id).catch(() => null));
  return { orders: r.filter(Boolean).map((p: any) => [p.idpurchaseorder, datum(p), String(p.status || ""), p.idsupplier || null, regels(p)]) };
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
  const stap = url.searchParams.get("stap") || "lijst";
  try {
    if (stap === "lijst") return antwoord(await lijst(url.searchParams.get("sinds") || ""), 200, origin);
    if (stap === "detail") return antwoord(await detail(url.searchParams.get("ids") || ""), 200, origin);
    return antwoord({ fout: "Onbekende stap" }, 400, origin);
  } catch (e) {
    const f = e instanceof Fout ? e : new Fout(String((e as Error).message || e));
    return antwoord({ fout: f.message }, f.status, origin);
  }
});
