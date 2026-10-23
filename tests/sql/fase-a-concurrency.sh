#!/usr/bin/env bash
# Dos descargas concurrentes (60+60 > 100) → solo una debe confirmar.
set -euo pipefail
DB="${FASE_A_TEST_DB:-tanques_fase_a_iso}"
export PGHOST="${PGHOST:-/var/run/postgresql}"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

psql_q() { sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" "$@"; }

echo "==> Concurrencia: preparar T1=100 L (ajuste Gerencia)"
psql_q <<'SQL'
\set ON_ERROR_STOP on
set role authenticated;
select set_config('app.uid','11111111-1111-4111-8111-111111111111', false);
select * from public.tanques_sync_batch(jsonb_build_array(jsonb_build_object(
  'key','adjustment:conc-base','kind','adjustment','vehicle',null,'base',0,'deleted',false,
  'payload', jsonb_build_object(
    'id','conc-base','at','2026-10-21T12:00:00Z','reason','Base concurrencia',
    'next', jsonb_build_object('cisterna',22980,'camion',jsonb_build_array(100,0,0),'furgoneta',jsonb_build_array(0))
  )
)));
reset role;
SQL

run_session() {
  local label="$1" key="$2" litres="$3" time="$4" out="$5"
  sudo -u postgres psql -d "$DB" >"$out" 2>&1 <<SQL
\\set ON_ERROR_STOP on
set role authenticated;
select set_config('app.uid','33333333-3333-4333-8333-333333333333', false);
select pg_sleep(0.05);
select * from public.tanques_sync_batch(jsonb_build_array(jsonb_build_object(
  'key','movement:${key}','kind','movement','vehicle','camion','base',0,'deleted',false,
  'payload', jsonb_build_object(
    'id','${key}','type','DESCARGA','vehicle','camion','tank',1,'litres',${litres},'loss',0,
    'time','${time}'
  )
)));
\\echo SESSION_${label}_OK
SQL
}

echo "==> Lanzando dos sesiones en paralelo"
set +e
run_session A conc-a 60 '2026-10-21T12:01:00Z' "$TMP/a.out" &
PA=$!
run_session B conc-b 60 '2026-10-21T12:01:01Z' "$TMP/b.out" &
PB=$!
wait "$PA"; EA=$?
wait "$PB"; EB=$?
set -e

echo "--- session A (exit $EA) ---"; cat "$TMP/a.out"
echo "--- session B (exit $EB) ---"; cat "$TMP/b.out"

OK_A=0; OK_B=0
grep -q 'SESSION_A_OK' "$TMP/a.out" && OK_A=1
grep -q 'SESSION_B_OK' "$TMP/b.out" && OK_B=1
SUM=$((OK_A + OK_B))
if [[ "$SUM" -ne 1 ]]; then
  echo "ASSERT FAIL: exactamente una sesión debía confirmar (ok_a=$OK_A ok_b=$OK_B)"
  exit 1
fi

STOCK_FAIL=0
grep -q 'STOCK' "$TMP/a.out" && STOCK_FAIL=$((STOCK_FAIL+1))
grep -q 'STOCK' "$TMP/b.out" && STOCK_FAIL=$((STOCK_FAIL+1))
if [[ "$STOCK_FAIL" -lt 1 ]]; then
  echo "ASSERT FAIL: la sesión perdedora debía fallar con STOCK"
  exit 1
fi

COUNT=$(psql_q -Atc "select count(*) from public.tanques_records where key in ('movement:conc-a','movement:conc-b') and not deleted;")
if [[ "$COUNT" != "1" ]]; then
  echo "ASSERT FAIL: debía persistir 1 movimiento concurrente, got $COUNT"
  exit 1
fi

echo "FASE_A_SQL_CONCURRENCY_PASS"
