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

// ontvangsten (RC) per inkooporder: wat is er werkelijk opgeboekt (alleen lezen)
async function ontvangsten(refsTxt: string) {
  const refs = [...new Set((refsTxt || "").split(",").map((s) => s.trim()).filter((s) => /^[\w .\/-]{2,60}$/.test(s)))].slice(0, 10);
  if (!refs.length) throw new Fout("Geen pakbonnummer gevraagd", 400);
  const norm = (s: any) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const sleutels = refs.map(norm);
  const raakt = (o: any) => ["purchaseorderid", "reference", "supplier_orderid", "receiptid", "supplier_reference", "remarks"]
    .some((v) => { const x = norm(o && o[v]); return x && sleutels.some((k) => x.includes(k)); });
  const [ink, ontv] = await Promise.all([
    alles("purchaseorders", 500).catch(() => []),
    alles("receipts", 500),
  ]);
  const poIds = new Map<number, string>();
  ink.filter(raakt).forEach((p: any) => poIds.set(p.idpurchaseorder, p.purchaseorderid || ""));
  const gevonden = ontv.filter((r: any) => poIds.has(r.idpurchaseorder) || raakt(r));
  const detail = await perStuk(gevonden, 3, async (r: any) => {
    if (Array.isArray(r.products) && r.products.length) return r;
    return await pq("receipts/" + r.idreceipt).catch(() => r);
  });
  const getal = (p: any) => {
    for (const v of ["amount_received", "amountreceived", "received", "amount"]) { const n = Number(p[v]); if (isFinite(n) && p[v] !== undefined && p[v] !== null) return n; }
    return 0;
  };
  return {
    bron: "picqer-receipts", versie: 1, refs, opgehaald: new Date().toISOString(),
    ontvangsten: detail.map((r: any) => ({
      id: r.idreceipt, nummer: r.receiptid || "", inkooporder: r.purchaseorderid || poIds.get(r.idpurchaseorder) || "", idpurchaseorder: r.idpurchaseorder || null,
      status: r.status || "", datum: r.created_at || r.completed_at || null,
      producten: (Array.isArray(r.products) ? r.products : []).map((p: any) => ({ idproduct: p.idproduct, code: p.productcode || p.product_code || "", aantal: getal(p) })),
    })),
  };
}

// recente ontvangsten (RC): leverancier, wie, wanneer, welke producten en aantallen (alleen lezen)
async function ontvangstenLijst(sinds: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sinds || "")) throw new Fout("Ongeldige datum", 400);
  const lijst = (await alles("receipts", 2000))
    .filter((r: any) => String(r.created_at || r.completed_at || "").slice(0, 10) >= sinds)
    .sort((a: any, b: any) => (b.idreceipt || 0) - (a.idreceipt || 0)).slice(0, 40);
  const detail = await perStuk(lijst, 3, async (r: any) => (Array.isArray(r.products) && r.products.length ? r : await pq("receipts/" + r.idreceipt).catch(() => r)));
  const lev = new Map<number, string>(), gebr = new Map<number, string>();
  const levIds = [...new Set(detail.map((r: any) => r.idsupplier).filter((x: any) => x > 0))] as number[];
  const gebrIds = [...new Set(detail.flatMap((r: any) => [r.iduser, r.idpicker, r.completed_by_iduser]).filter((x: any) => x > 0))] as number[];
  await Promise.all([
    perStuk(levIds, 3, async (id) => { const s = await pq("suppliers/" + id).catch(() => null); if (s) lev.set(id, s.name || ""); }),
    perStuk(gebrIds, 3, async (id) => { const u = await pq("users/" + id).catch(() => null); if (u) gebr.set(id, ((u.firstname || u.first_name || "") + " " + (u.lastname || u.last_name || "")).trim() || u.username || ""); }),
  ]);
  const getal = (p: any) => { for (const v of ["amount_received", "amountreceived", "received", "amount"]) { const n = Number(p[v]); if (p[v] !== undefined && p[v] !== null && isFinite(n)) return n; } return 0; };
  return {
    bron: "picqer-receipts", versie: 1, sinds, opgehaald: new Date().toISOString(),
    velden: detail[0] ? Object.keys(detail[0]) : [],
    ontvangsten: detail.map((r: any) => ({
      id: r.idreceipt, nummer: r.receiptid || "", inkooporder: r.purchaseorderid || "", status: r.status || "",
      leverancier: (r.supplier && r.supplier.name) || r.suppliername || lev.get(r.idsupplier) || "",
      wie: gebr.get(r.iduser) || gebr.get(r.idpicker) || gebr.get(r.completed_by_iduser) || "",
      aangemaakt: r.created_at || null, klaar: r.completed_at || null,
      producten: (Array.isArray(r.products) ? r.products : []).map((p: any) => ({ code: p.productcode || p.product_code || "", naam: p.name || "", aantal: getal(p) })),
    })),
  };
}

// =====================================================================
//  De hele keten in één antwoord: inkooporders (besteld, verwacht, waarde)
//  en ontvangsten (wat is er werkelijk binnengekomen, door wie, wanneer).
//  Alles alleen lezen. De app koppelt ontvangst → inkooporder → levering.
// =====================================================================
const getalVan = (o: any, velden: string[]) => {
  for (const v of velden) { const x = o && o[v]; const n = Number(x); if (x !== undefined && x !== null && x !== "" && isFinite(n)) return n; }
  return 0;
};
const tekstVan = (o: any, velden: string[]) => {
  for (const v of velden) { const x = o && o[v]; if (typeof x === "string" && x.trim()) return x.trim(); if (x && typeof x === "object" && typeof x.name === "string" && x.name.trim()) return x.name.trim(); }
  return "";
};
function poRegels(p: any) {
  return (Array.isArray(p.products) ? p.products : []).map((r: any) => ({
    idproduct: r.idproduct || null,
    code: tekstVan(r, ["productcode", "product_code"]),
    naam: tekstVan(r, ["name", "productname"]),
    besteld: getalVan(r, ["amount", "amount_ordered", "amountordered"]),
    ontvangen: getalVan(r, ["amountreceived", "amount_received", "received"]),
    prijs: getalVan(r, ["price", "purchaseprice", "productprice"]),
  }));
}
async function keten(sinds: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sinds || "")) throw new Fout("Ongeldige datum", 400);
  const [ruweInk, ruweOntv] = await Promise.all([
    alles("purchaseorders", 1500).catch(() => [] as any[]),
    alles("receipts", 1500).catch(() => [] as any[]),
  ]);
  const datumVan = (o: any) => String(tekstVan(o, ["completed_at", "created_at", "created", "updated_at", "updated", "purchased_at"]) || "").slice(0, 10);
  // Picqer hangt de inkooporder bij een ontvangst onder "purchaseorder" (en per regel), niet bovenin
  const poIdVan = (r: any) => r.idpurchaseorder || (r.purchaseorder && r.purchaseorder.idpurchaseorder) ||
    ((Array.isArray(r.products) ? r.products : []).find((x: any) => x && x.idpurchaseorder) || {}).idpurchaseorder || null;
  const poNrVan = (r: any) => tekstVan(r, ["purchaseorderid"]) || (r.purchaseorder ? tekstVan(r.purchaseorder, ["purchaseorderid"]) : "");
  const open = (p: any) => !/completed|cancelled|canceled/i.test(String(p.status || ""));
  // inkooporders: alles wat nog open staat + wat sinds de gevraagde datum is afgerond
  const inkSel = ruweInk.filter((p: any) => open(p) || datumVan(p) >= sinds)
    .sort((a: any, b: any) => (b.idpurchaseorder || 0) - (a.idpurchaseorder || 0)).slice(0, 120);
  const ontvSel = ruweOntv.filter((r: any) => datumVan(r) >= sinds)
    .sort((a: any, b: any) => (b.idreceipt || 0) - (a.idreceipt || 0)).slice(0, 60);
  // regels staan niet altijd in de lijst: dan per stuk ophalen
  const [ink, ontv] = await Promise.all([
    perStuk(inkSel, 3, async (p: any) => (Array.isArray(p.products) && p.products.length ? p : await pq("purchaseorders/" + p.idpurchaseorder).catch(() => p))),
    perStuk(ontvSel, 3, async (r: any) => (Array.isArray(r.products) && r.products.length ? r : await pq("receipts/" + r.idreceipt).catch(() => r))),
  ]);
  // namen van leveranciers en gebruikers erbij
  const levIds = [...new Set([...ink, ...ontv].map((o: any) => o.idsupplier).filter((x: any) => x > 0))] as number[];
  const gebrIds = [...new Set(ontv.flatMap((r: any) => [r.iduser, r.idpicker, r.completed_by_iduser]).filter((x: any) => x > 0))] as number[];
  const lev = new Map<number, string>(), gebr = new Map<number, string>();
  await Promise.all([
    perStuk(levIds.slice(0, 60), 3, async (id) => { const s = await pq("suppliers/" + id).catch(() => null); if (s) lev.set(id, s.name || ""); }),
    perStuk(gebrIds.slice(0, 30), 3, async (id) => { const u = await pq("users/" + id).catch(() => null); if (u) gebr.set(id, ((u.firstname || u.first_name || "") + " " + (u.lastname || u.last_name || "")).trim() || u.username || ""); }),
  ]);
  const levNaam = (o: any) => tekstVan(o, ["supplier", "suppliername", "supplier_name"]) || lev.get(o.idsupplier) || "";
  return {
    bron: "picqer-keten", versie: 1, sinds, opgehaald: new Date().toISOString(),
    velden: { inkoop: ink[0] ? Object.keys(ink[0]) : [], ontvangst: ontv[0] ? Object.keys(ontv[0]) : [], inkoopregel: ink[0] && ink[0].products && ink[0].products[0] ? Object.keys(ink[0].products[0]) : [], ontvangstregel: ontv[0] && ontv[0].products && ontv[0].products[0] ? Object.keys(ontv[0].products[0]) : [] },
    inkoop: ink.map((p: any) => ({
      id: p.idpurchaseorder, nummer: tekstVan(p, ["purchaseorderid"]), status: String(p.status || ""),
      leverancier: levNaam(p), idleverancier: p.idsupplier || null,
      besteld_op: tekstVan(p, ["purchased_at", "created_at"]) || null,
      verwacht_op: tekstVan(p, ["delivery_date", "deliverydate", "expected_delivery_date"]) || null,
      klaar_op: tekstVan(p, ["completed_at"]) || null,
      magazijn: p.idwarehouse || null,
      opmerking: tekstVan(p, ["remarks", "comment"]),
      regels: poRegels(p),
    })),
    ontvangsten: ontv.map((r: any) => ({
      id: r.idreceipt, nummer: tekstVan(r, ["receiptid"]), status: String(r.status || ""),
      inkooporder: poNrVan(r), idinkooporder: poIdVan(r),
      leverancier: levNaam(r), wie: gebr.get(r.iduser) || gebr.get(r.idpicker) || gebr.get(r.completed_by_iduser) || "",
      aangemaakt: tekstVan(r, ["created_at", "created"]) || null, klaar: tekstVan(r, ["completed_at"]) || null,
      producten: (Array.isArray(r.products) ? r.products : []).map((p: any) => ({
        idproduct: p.idproduct || null,
        code: tekstVan(p, ["productcode", "product_code"]),
        naam: tekstVan(p, ["name", "productname"]),
        aantal: getalVan(p, ["amount_received", "amountreceived", "received", "amount"]),
        besteld: getalVan(p, ["amount_ordered", "amountordered"]),
      })),
    })),
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
    if (actie === "ontvangsten") return antwoord(await ontvangsten(url.searchParams.get("refs") || ""), 200, origin);
    if (actie === "keten") return antwoord(await keten(url.searchParams.get("sinds") || ""), 200, origin);
    if (actie === "ontvangstenlijst") return antwoord(await ontvangstenLijst(url.searchParams.get("sinds") || ""), 200, origin);
    if (actie === "verplaatsingen") return antwoord(await verplaatsingen(url.searchParams.get("sinds") || ""), 200, origin);
    if (actie === "mutaties") return antwoord(await mutaties(url.searchParams.get("sinds") || ""), 200, origin);
    return antwoord({ fout: "Onbekende actie: " + actie }, 400, origin);
  } catch (e) {
    const f = e instanceof Fout ? e : new Fout(String((e as Error)?.message || e));
    return antwoord({ fout: f.message }, f.status, origin);
  }
});
