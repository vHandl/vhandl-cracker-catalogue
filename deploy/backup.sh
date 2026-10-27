#!/usr/bin/env bash
# Nightly backup of the catalogue data folder. Keeps 14 days.
set -euo pipefail
DATA=/var/lib/catalogue
OUT=/var/backups/catalogue
mkdir -p "$OUT"
STAMP=$(date +%F)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
sqlite3 "$DATA/catalogue.db" ".backup '$TMP/catalogue.db'"
[ -d "$DATA/uploads" ] && cp -r "$DATA/uploads" "$TMP/uploads"
tar -czf "$OUT/catalogue-$STAMP.tar.gz" -C "$TMP" .
find "$OUT" -name 'catalogue-*.tar.gz' -mtime +14 -delete
