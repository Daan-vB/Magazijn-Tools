// Eenmalige database-opbouw voor IVOL Warehouse (7-10-2026).
// Maakt alleen NIEUWE tabellen aan ("create table if not exists"); raakt bestaande tabellen en data niet.
// Neemt geen invoer aan en geeft geen data terug. Wordt na gebruik weer verwijderd door de workflow.
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const SQL = `
create table if not exists productdata (
  productcode text primary key,
  data jsonb not null default '{}'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
comment on table productdata is 'Eén waarheid voor alles wat Picqer niet kent. Sleutel = exacte Picqer-productcode. data = {veld: waarde}, meta = {veld: {op, door, bron}}.';
alter table productdata enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'productdata' and policyname = 'tools') then
    create policy "tools" on productdata for all to anon, authenticated using (true) with check (true);
  end if;
end $$;
`;

Deno.serve(async () => {
  const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 1 });
  try {
    await sql.unsafe(SQL);
    const [r] = await sql`select count(*)::int as n from productdata`;
    return new Response(JSON.stringify({ ok: true, productdata_rijen: r.n }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, fout: String(e && e.message || e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  } finally {
    await sql.end();
  }
});
