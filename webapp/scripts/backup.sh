#!/bin/sh
# NFR-SEC-05 — scheduled PostgreSQL backups, run by the `backup` service.
#
# Every BACKUP_INTERVAL_HOURS: pg_dump in custom format, verify the archive
# can be read back (pg_restore --list), then keep the newest BACKUP_KEEP
# dumps. A dump that fails verification is deleted, never kept as "latest".
#
# Dumps contain personal data: the /backups folder must stay off Git and
# be copied off this machine (see README → การสำรองข้อมูล).
set -eu

DIR=/backups/db
INTERVAL_HOURS="${BACKUP_INTERVAL_HOURS:-24}"
KEEP="${BACKUP_KEEP:-14}"
mkdir -p "$DIR"

until pg_isready -q; do sleep 2; done

while true; do
  ts=$(date -u +%Y%m%dT%H%M%SZ)
  out="$DIR/alumni-$ts.dump"
  if pg_dump --format=custom --no-owner --file="$out.tmp" \
     && pg_restore --list "$out.tmp" > /dev/null; then
    mv "$out.tmp" "$out"
    echo "$(basename "$out")" > "$DIR/latest.txt"
    echo "[backup] ok $(basename "$out") $(du -h "$out" | cut -f1)"
  else
    rm -f "$out.tmp"
    echo "[backup] FAILED at $ts" >&2
  fi
  # Keep the newest $KEEP dumps.
  ls -1t "$DIR"/alumni-*.dump 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f
  sleep $((INTERVAL_HOURS * 3600))
done
