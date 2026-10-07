# Leest de Supabase-database Palletlabels (alleen lezen) en schrijft alles naar map out/.
# Draait in GitHub Actions; het resultaat wordt daar versleuteld met sleutel-publiek.pem,
# zodat alleen Claude het kan openen. Er komt geen bedrijfsdata leesbaar in de repo of de logs.
import json, os, sys, urllib.request

REF = os.environ.get("PROJECT", "jarbgetbwkjtxwtcfwmq")
TOKEN = os.environ["SUPABASE_ACCESS_TOKEN"]
MAX_MB = float(os.environ.get("MAX_MB", "60"))
os.makedirs("out", exist_ok=True)


def sql(q):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{REF}/database/query",
        data=json.dumps({"query": q}).encode(),
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())


schema = {
    "tabellen": sql("""select c.relname as tabel, c.reltuples::bigint as rijen_schatting,
        pg_total_relation_size(c.oid) as bytes, c.relrowsecurity as rls
        from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relkind='r' order by 1"""),
    "kolommen": sql("""select table_name as tabel, column_name as kolom, data_type as type, is_nullable, column_default
        from information_schema.columns where table_schema='public' order by table_name, ordinal_position"""),
    "policies": sql("select tablename as tabel, policyname, cmd, roles::text, qual, with_check from pg_policies where schemaname='public'"),
    "constraints": sql("""select conrelid::regclass::text as tabel, conname, pg_get_constraintdef(oid) as def
        from pg_constraint where connamespace='public'::regnamespace"""),
    "catalog_keys": sql("select key, mode, updated_at, pg_column_size(data) as bytes from catalog order by key"),
}
json.dump(schema, open("out/schema.json", "w"), ensure_ascii=False, indent=1)

for t in schema["tabellen"]:
    naam, mb = t["tabel"], t["bytes"] / 1e6
    if mb > MAX_MB:
        print(f"overgeslagen (te groot): {naam} {mb:.1f} MB")
        continue
    rows, off, stap = [], 0, 2000 if naam != "catalog" else 5
    while True:
        part = sql(f'select * from "{naam}" order by 1 offset {off} limit {stap}')
        rows += part
        if len(part) < stap:
            break
        off += stap
    json.dump(rows, open(f"out/{naam}.json", "w"), ensure_ascii=False)
    print(f"{naam}: {len(rows)} rijen")
