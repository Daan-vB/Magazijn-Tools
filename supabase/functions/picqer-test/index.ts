// =====================================================================
//  IVOL Warehouse — Picqer-tussenstation TESTOMGEVING (ALLEEN LEZEN)
//  Supabase Edge Function "picqer-test". Kopie van de functie "picqer", maar
//  praat uitsluitend met de Picqer-testomgeving. De echte functie "picqer"
//  en de echte Picqer blijven ongemoeid.
//  Plak dit bestand in Supabase:
//  Edge Functions → Deploy a new function → Via Editor (naam: picqer-test).
//  Zet bij deze functie "Verify JWT" UIT (net als bij "picqer").
//
//  Geheimen (Edge Functions → Secrets), nooit in de app of de repo:
//    PICQER_TEST_DOMAIN     bv. ivoltest.picqer.com (adres van de testomgeving)
//    PICQER_TEST_KEY        API-sleutel van de TESTomgeving
//    IVOL_CODE              dezelfde koppelcode als bij "picqer" (bestaat al)
//    PICQER_TEST_WAREHOUSE  (optioneel) idwarehouse Hoofdmagazijn in test, standaard 3857
//    PICQER_TEST_VST        (optioneel) idwarehouse VST in test, standaard 3991
//
//  Veiligheid:
//   - alleen GET-verzoeken, niets kan in Picqer worden gewijzigd;
//   - weigert te draaien als PICQER_TEST_DOMAIN de echte Picqer (ivol) is;
//   - elk antwoord bevat "omgeving":"test", zodat de app kan laten zien
//     dat het echt de testomgeving is.
//  Acties (?actie=…): status, vandaag, producten, picklijst, catalogus,
//  locaties, mutaties, verplaatsingen (zelfde als "picqer").
//  Wordt automatisch live gezet door GitHub (workflow supabase-functies).
// =====================================================================

const DOMEIN = (Deno.env.get("PICQER_TEST_DOMAIN") || "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
const SLEUTEL = (Deno.env.get("PICQER_TEST_KEY") || "").trim();
const CODE = (Deno.env.get("IVOL_CODE") || "").trim();
const MAGAZIJN = Number(Deno.env.get("PICQER_TEST_WAREHOUSE") || "3857");
const BASIS = Deno.env.get("PICQER_TEST_BASE") || (DOMEIN ? "https://" + (DOMEIN.includes(".") ? DOMEIN : DOMEIN + ".picqer.com") + "/api/v1" : "");
// de echte Picqer van IVOL: deze functie weigert daarmee te praten
const IS_ECHT = /^ivol(\.picqer\.com)?$/i.test(DOMEIN);
const HERKOMST = ["https://daan-vb.github.io"];
const UA = "IVOL Warehouse TEST (github.com/Daan-vB/Magazijn-Tools)";

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
  const uit = data && typeof data === "object" && !Array.isArray(data) ? { ...(data as Record<string, unknown>), omgeving: "test" } : data;
  return new Response(JSON.stringify(uit), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Ivol-Omgeving": "test" },
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
    domein: DOMEIN,
    magazijn: MAGAZIJN,
    magazijnen: (Array.isArray(w) ? w : []).map((x: any) => ({ id: x.idwarehouse, naam: x.name, actief: x.active !== false })),
  };
}

// gebruikers: alleen naam (voor "toegewezen aan")
async function gebruikers(): Promise<Record<string, string>> {
  return await bewaard("users", 3600, async () => {
    const u = await alles("users", 1000);
    const m: Record<string, string> = {};
    u.forEach((x: any) => { m[x.iduser] = [x.firstname || x.first_name, x.lastname || x.last_name].filter(Boolean).join(" ") || x.username || ""; });
    return m;
  });
}

async function vandaag() {
  const picks = async (st: string) => alles("picklists?status=" + st + "&idwarehouse=" + MAGAZIJN, 3000);
  const [nieuw, pauze, snooze, bo, wie] = await Promise.all([picks("new"), picks("paused"), picks("snoozed"), alles("backorders", 6000), gebruikers().catch(() => ({} as Record<string, string>))]);
  const pl = (p: any) => ({
    id: p.idpicklist, nr: p.picklistid, s: p.status, u: !!p.urgent, c: p.created,
    d: p.preferred_delivery_date || null, n: p.totalproducts ?? null, gp: p.totalpicked ?? null, toegewezen: !!p.assigned_to_iduser,
    wie: p.assigned_to_iduser ? (wie[p.assigned_to_iduser] || "") : "", o: p.idorder || null, ref: p.reference || "",
    pauze: p.paused_reason || "", tot: p.snoozed_until || null,
  });
  return {
    opgehaald: new Date().toISOString(),
    magazijn: MAGAZIJN,
    picklijsten: nieuw.concat(pauze).concat(snooze).map(pl),
    gesnoozed: snooze.length,
    backorders: bo
      .filter((b: any) => !b.idwarehouse || Number(b.idwarehouse) === MAGAZIJN)
      .map((b: any) => ({
        id: b.idbackorder, o: b.idorder, p: b.idproduct, a: Number(b.amount) || 0, v: Number(b.amount_available) || 0,
        pr: b.priority ?? null, c: b.created_at || null, ink: !!b.is_purchased, hp: !!b.has_parts, deel: !!b.part_of_idbackorder,
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
      type: p.type || "",
      abc: p.analysis_abc_classification || "",
      perDag: p.analysis_pick_amount_per_day ?? null,
      vw: (Array.isArray(p.stock) ? p.stock : []).map((x: any) => [x.idwarehouse, Number(x.stock) || 0]),
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

// alle producten met voorraad, 10 pagina's (1.000 producten) per aanroep
const VST = Number(Deno.env.get("PICQER_TEST_VST") || "3991");
async function catalogus(vanTxt: string) {
  const van = Math.max(0, parseInt(vanTxt || "0", 10) || 0);
  const paginas = await perStuk(Array.from({ length: 10 }, (_, i) => van + i * 100), 3, (off) => bewaard("cat:" + off, 600, () => pq("products?offset=" + off)));
  const rijen: unknown[] = [];
  let klaar = false;
  paginas.forEach((r: any) => {
    if (!Array.isArray(r) || r.length < 100) klaar = true;
    (Array.isArray(r) ? r : []).forEach((p: any) => {
      const st = (w: number) => { const x = (p.stock || []).find((s: any) => Number(s.idwarehouse) === w); return x ? Number(x.stock) || 0 : 0; };
      const hm = st(MAGAZIJN), vst = st(VST);
      if (hm > 0 || vst > 0) rijen.push([p.idproduct, p.productcode, hm, vst, p.analysis_abc_classification || "", p.analysis_pick_amount_per_day ?? null]);
    });
  });
  return { van, volgende: van + 1000, klaar, rijen };
}
// voorraad per locatie, alleen wat het aanvuladvies nodig heeft
async function locaties(idsTxt: string) {
  const ids = [...new Set(String(idsTxt || "").split(",").map((x) => parseInt(x, 10)).filter((x) => x > 0))].slice(0, 60);
  if (!ids.length) throw new Fout("Geen producten gevraagd", 400);
  const lijst = await perStuk(ids, 4, async (id) => {
    const locs = await pq("products/" + id + "/locations").catch(() => null);
    if (!Array.isArray(locs)) return [id, null];
    return [id, locs.map((l: any) => {
      const s = l.stock_for_product || {};
      return [l.name, l.idwarehouse ?? null, l.is_bulk_location ? 1 : 0, l.type === "container" ? 1 : 0,
        Number(s.stock ?? l.stock ?? 0) || 0, Number(s.stock_reserved_picklists ?? l.stock_reserved_picklists ?? 0) || 0];
    })];
  });
  return { opgehaald: new Date().toISOString(), lijst };
}
// producten met een voorraadmutatie sinds een moment (Picqer-tijd, bv. 2026-10-07 08:00:00)
async function mutaties(sinds: string) {
  if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(sinds || "")) throw new Fout("Ongeldig moment", 400);
  const r = await alles("stockhistory?idwarehouse=" + MAGAZIJN + "&sincedate=" + encodeURIComponent(sinds.replace("T", " ")), 8000);
  const ids = new Set<number>();
  let laatste = "";
  r.forEach((h: any) => { if (h.idproduct) ids.add(h.idproduct); if (h.changed_at && h.changed_at > laatste) laatste = h.changed_at; });
  return { sinds, laatste, regels: r.length, ids: [...ids], vol: r.length >= 8000 };
}

// alle verplaatsingen tussen locaties sinds een moment (voor Controle); zelfde vorm als het Mac-bestand
async function verplaatsingen(sinds: string) {
  if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(sinds || "")) throw new Fout("Ongeldig moment", 400);
  const hist = (await alles("location-stock-history?sincedate=" + encodeURIComponent(sinds.replace("T", " ")), 6000))
    .filter((h: any) => h && h.change_type === "movement");
  const uniek = (veld: string[]) => [...new Set(hist.flatMap((h: any) => veld.map((v) => h[v])).filter((x: any) => x > 0))] as number[];
  const [magazijnen, locaties, producten, gebruikers] = await Promise.all([
    pq("warehouses").catch(() => []),
    perStuk(uniek(["idlocation", "contra_idlocation"]), 4, (id) => pq("locations/" + id).catch(() => null)),
    perStuk(uniek(["idproduct"]), 4, (id) => pq("products/" + id).catch(() => null)),
    perStuk(uniek(["iduser"]), 2, (id) => pq("users/" + id).catch(() => null)),
  ]);
  return {
    bron: "picqer-location-stock-history", versie: 1, sinds, opgehaald: new Date().toISOString(),
    magazijnen: (Array.isArray(magazijnen) ? magazijnen : []).map((w: any) => ({ idwarehouse: w.idwarehouse, name: w.name })),
    historie: hist.map((h: any) => ({
      idproduct_location_stock_history: h.idproduct_location_stock_history, change_type: h.change_type, stock_change: h.stock_change,
      idlocation: h.idlocation, contra_idlocation: h.contra_idlocation, idproduct: h.idproduct, iduser: h.iduser, changed_at: h.changed_at,
    })),
    locaties: locaties.filter(Boolean).map((l: any) => ({ idlocation: l.idlocation, name: l.name, idwarehouse: l.idwarehouse })),
    producten: producten.filter(Boolean).map((p: any) => ({ idproduct: p.idproduct, productcode: p.productcode })),
    gebruikers: gebruikers.filter(Boolean).map((u: any) => ({ iduser: u.iduser, firstname: u.firstname || u.first_name || "", lastname: u.lastname || u.last_name || "", username: u.username || "" })),
    vol: hist.length >= 6000,
  };
}

// opmerkingen bij één picklijst (op verzoek, één klik in de app)
async function picklijst(idTxt: string) {
  const id = parseInt(idTxt, 10);
  if (!(id > 0)) throw new Fout("Geen picklijst gevraagd", 400);
  return await bewaard("pl:" + id, 60, async () => {
    const p = await pq("picklists/" + id);
    const opm = (lijst: any) => (Array.isArray(lijst) ? lijst : []).map((c: any) => ({
      tekst: c.body || "", op: c.created_at || null,
      door: (c.author && (c.author.full_name || c.author.name || [c.author.firstname || c.author.first_name, c.author.lastname || c.author.last_name].filter(Boolean).join(" "))) || c.author_type || "",
    }));
    const [cp, o, co] = await Promise.all([
      pq("picklists/" + id + "/comments").catch(() => []),
      p.idorder ? pq("orders/" + p.idorder).catch(() => null) : Promise.resolve(null),
      p.idorder ? pq("orders/" + p.idorder + "/comments").catch(() => []) : Promise.resolve([]),
    ]);
    return {
      id, nr: p.picklistid, s: p.status, pauze: p.paused_reason || "", tot: p.snoozed_until || null, ref: p.reference || "",
      order: o ? { id: o.idorder, nr: o.orderid, ref: o.reference || "", klant: o.customer_remarks || "", status: o.status || "" } : null,
      opmerkingen: opm(cp).concat(opm(co)),
    };
  });
}

// ---------- ingang ----------
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "GET") return antwoord({ fout: "Alleen lezen: deze testfunctie accepteert alleen GET." }, 405, origin);
  if (IS_ECHT) return antwoord({ fout: "PICQER_TEST_DOMAIN wijst naar de echte Picqer (ivol). Deze testfunctie weigert dat." }, 500, origin);
  if (!BASIS || !SLEUTEL) return antwoord({ fout: "PICQER_TEST_DOMAIN of PICQER_TEST_KEY ontbreekt bij de Secrets in Supabase." }, 500, origin);
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
    if (actie === "picklijst") return antwoord(await picklijst(url.searchParams.get("id") || ""), 200, origin);
    if (actie === "catalogus") return antwoord(await catalogus(url.searchParams.get("van") || "0"), 200, origin);
    if (actie === "locaties") return antwoord(await locaties(url.searchParams.get("ids") || ""), 200, origin);
    if (actie === "verplaatsingen") return antwoord(await verplaatsingen(url.searchParams.get("sinds") || ""), 200, origin);
    if (actie === "mutaties") return antwoord(await mutaties(url.searchParams.get("sinds") || ""), 200, origin);
    return antwoord({ fout: "Onbekende actie: " + actie }, 400, origin);
  } catch (e) {
    const f = e instanceof Fout ? e : new Fout(String((e as Error)?.message || e));
    return antwoord({ fout: f.message }, f.status, origin);
  }
});
