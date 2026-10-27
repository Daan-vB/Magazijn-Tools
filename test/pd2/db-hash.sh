#!/bin/bash
# hash van productdata, wh-pd-fam en catalog-ean (alleen lezen); toont alleen hashes en aantallen, geen inhoud
K=$(grep -o "sb_publishable_[A-Za-z0-9_]*" "$(dirname "$0")/../../wh/core.js")
U=https://jarbgetbwkjtxwtcfwmq.supabase.co/rest/v1
pd=""; for f in 0 1000 2000 3000 4000 5000 6000 7000 8000 9000 10000 11000 12000; do r=$(curl -s -H "apikey: $K" -H "Authorization: Bearer $K" -H "Range: $f-$((f+999))" "$U/productdata?select=productcode,data,meta,updated_at&order=productcode"); [ "$r" = "[]" ] && break; pd="$pd$r"; done
echo "productdata $(echo -n "$pd" | sha1sum | cut -c1-12) $(echo -n "$pd" | grep -o '"productcode"' | wc -l) rijen"
for k in wh-pd-fam catalog-ean wh-pd2-oefen wh-pd2-feedback; do r=$(curl -s -H "apikey: $K" -H "Authorization: Bearer $K" "$U/catalog?key=eq.$k&select=data,updated_at"); echo "$k $(echo -n "$r" | sha1sum | cut -c1-12) $(echo -n "$r" | wc -c) bytes"; done
