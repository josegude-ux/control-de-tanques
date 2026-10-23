#!/usr/bin/env bash
# Aplica migraciones y escenarios en una BD PostgreSQL local aislada.
# NO contacta Supabase real.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB="${FASE_A_TEST_DB:-tanques_fase_a_iso}"
export PGHOST="${PGHOST:-/var/run/postgresql}"

echo "==> Recreando BD aislada: $DB"
sudo -u postgres dropdb --if-exists "$DB"
sudo -u postgres createdb "$DB"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -c "ALTER DATABASE $DB OWNER TO postgres;"

run() { sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }

echo "==> Stub auth"
run "$ROOT/tests/sql/isolated-auth-stub.sql"
echo "==> tanques-sync.sql"
run "$ROOT/database/tanques-sync.sql"
echo "==> tanques-validation.sql"
run "$ROOT/database/tanques-validation.sql"
echo "==> fase-a-seguridad-inventario.sql"
run "$ROOT/database/fase-a-seguridad-inventario.sql"
echo "==> escenarios authenticated"
run "$ROOT/tests/sql/fase-a-scenarios.sql"
echo "==> concurrencia dos descargas"
bash "$ROOT/tests/sql/fase-a-concurrency.sh"

echo "ISOLATED_SQL_PASS"
