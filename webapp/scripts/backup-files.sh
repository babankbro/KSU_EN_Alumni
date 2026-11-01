#!/bin/sh
# NFR-SEC-05 — mirror the MinIO bucket (photos, PDFs) to /backups/files,
# run by the `backup-files` service with the MinIO image's own `mc`.
#
# --remove keeps the copy equal to the bucket, so files erased on a PDPA
# request (FR-ADM-08) leave the backup too; the database dumps are the
# point-in-time history.
set -eu

INTERVAL_HOURS="${BACKUP_INTERVAL_HOURS:-24}"
BUCKET="${MINIO_BUCKET:-alumni-files}"
mkdir -p /backups/files

until mc ready src > /dev/null 2>&1; do sleep 2; done

while true; do
  if mc mirror --overwrite --remove --quiet "src/$BUCKET" "/backups/files/$BUCKET"; then
    echo "[backup-files] ok $(date -u +%Y-%m-%dT%H:%M:%SZ) $(mc ls --recursive /backups/files | wc -l) files"
  else
    echo "[backup-files] FAILED $(date -u +%Y-%m-%dT%H:%M:%SZ)" >&2
  fi
  sleep $((INTERVAL_HOURS * 3600))
done
