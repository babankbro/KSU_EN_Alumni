#!/bin/sh
# NFR-PERF-02 — time faceted directory searches end to end (HTTP, server
# render included). Point BASE at a server backed by the perf database.
#   BASE=http://localhost:3101 sh scripts/perf-directory.sh
set -eu
BASE="${BASE:-http://localhost:3101}"
RUNS="${RUNS:-7}"
enc() { python -c "import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))" "$1"; }

cases="ทั้งทำเนียบ (หน้า 1)|/directory
หน้าที่ 200|/directory?page=200
ค้นชื่อ 'สม'|/directory?q=$(enc สม)
ค้นชื่อสะกดผิด 'สมชายใจดก'|/directory?q=$(enc สมชายใจดก)
ค้นชื่อเดิม 'แสงทอง'|/directory?q=$(enc แสงทอง)
กรอง รุ่น+สาขา|/directory?cohort=2560&program=16
กรอง จังหวัด+กลุ่มอาชีพ|/directory?province=$(enc ขอนแก่น)&category=$(enc วิศวกร)
กรองหลายมิติ+คำค้น|/directory?q=$(enc สุดา)&cohort=2555&cohort=2556&level=$(enc วศ.บ.)&province=$(enc กาฬสินธุ์)
กรองทักษะ|/directory?skill=PLC"

curl -s -o /dev/null "$BASE/directory"  # warm-up
printf '%-34s %8s %8s %8s\n' "กรณี" "median" "max" "ผล"
echo "$cases" | while IFS='|' read -r name path; do
  times=$(for i in $(seq 1 "$RUNS"); do curl -s -o /dev/null -w '%{time_total}\n' "$BASE$path"; done | sort -n)
  med=$(echo "$times" | sed -n "$(( (RUNS + 1) / 2 ))p")
  max=$(echo "$times" | tail -1)
  ok=$(awk -v m="$max" 'BEGIN { print (m < 2.0) ? "ผ่าน" : "เกิน 2 วิ" }')
  printf '%-34s %7.3fs %7.3fs %8s\n' "$name" "$med" "$max" "$ok"
done
