#!/bin/sh
# NFR-SEC-05 — restore drill: load a backup into a throwaway database and
# compare row counts with the live one. The live database is not touched.
#
#   sh scripts/restore-test.sh                 # newest dump in backups/db
#   sh scripts/restore-test.sh alumni-XXXX.dump
#
# Run from the webapp folder (Git Bash on Windows works).
set -eu

DB_CONTAINER=ksu-alumni-db
USER_NAME="${POSTGRES_USER:-alumni}"
LIVE="${POSTGRES_DB:-alumni}"
TEST=alumni_restore_test
FILE="${1:-$(cat backups/db/latest.txt)}"

[ -f "backups/db/$FILE" ] || { echo "ไม่พบไฟล์ backups/db/$FILE"; exit 1; }
echo "ทดสอบกู้คืนจาก $FILE"

psql() { docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$USER_NAME" "$@"; }

psql -d postgres -q -c "DROP DATABASE IF EXISTS $TEST" -c "CREATE DATABASE $TEST"
start=$(date +%s)
docker exec -i "$DB_CONTAINER" pg_restore --no-owner -U "$USER_NAME" -d "$TEST" < "backups/db/$FILE"
echo "กู้คืนเสร็จใน $(( $(date +%s) - start )) วินาที"

SQL="SELECT 'alumni', count(*) FROM alumni UNION ALL SELECT 'account', count(*) FROM account
     UNION ALL SELECT 'alumni_post', count(*) FROM alumni_post UNION ALL SELECT 'news', count(*) FROM news
     UNION ALL SELECT 'event', count(*) FROM event UNION ALL SELECT 'consent_log', count(*) FROM consent_log
     UNION ALL SELECT 'audit_log', count(*) FROM audit_log UNION ALL SELECT 'file_object', count(*) FROM file_object"
psql -d "$LIVE" -At -F' ' -c "$SQL" > /tmp/restore-live.txt
psql -d "$TEST" -At -F' ' -c "$SQL" > /tmp/restore-test.txt

status=0
while read -r table live; do
  restored=$(grep "^$table " /tmp/restore-test.txt | cut -d' ' -f2)
  mark="ตรง"
  # Rows written after the dump was taken make the live count larger; that is expected.
  [ "$restored" -gt "$live" ] && { mark="❌ มากกว่าฐานจริง"; status=1; }
  [ "$restored" -lt "$live" ] && mark="ฐานจริงมีข้อมูลใหม่กว่าไฟล์สำรอง"
  printf '%-14s live=%-7s restored=%-7s %s\n' "$table" "$live" "$restored" "$mark"
done < /tmp/restore-live.txt

psql -d postgres -q -c "DROP DATABASE $TEST"
rm -f /tmp/restore-live.txt /tmp/restore-test.txt
[ $status -eq 0 ] && echo "ผลทดสอบ: กู้คืนได้" || echo "ผลทดสอบ: พบความผิดปกติ"
exit $status
