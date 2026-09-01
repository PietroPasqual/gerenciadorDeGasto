#!/usr/bin/env bash
# Sobe um Postgres 16 descartável com o schema do finZ aplicado do zero.
#
# Existe porque `supabase start` precisa de Docker, e o teste de RLS não
# precisa da stack inteira: ele precisa das POLICIES rodando sob um papel que
# não é dono das tabelas. Postgres puro + o shim de auth entrega isso, roda em
# segundos e é depurável — ver supabase/testes/auth-shim.sql.
set -euo pipefail

PORTA="${PGTESTE_PORTA:-5433}"
DIR="${PGTESTE_DIR:-/var/tmp/finz-teste}"
BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
export PATH="$BIN:$PATH"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"

parar() {
  if [ -d "$DIR/data" ]; then
    su postgres -c "PATH=$BIN:\$PATH pg_ctl -D $DIR/data -m immediate stop" >/dev/null 2>&1 || true
  fi
}

case "${1:-subir}" in
  parar)
    parar; rm -rf "$DIR"; echo "parado"; exit 0 ;;
esac

parar
rm -rf "$DIR"; mkdir -p "$DIR"; chown postgres:postgres "$DIR"

su postgres -c "PATH=$BIN:\$PATH initdb -D $DIR/data -A trust -U postgres" >/dev/null
su postgres -c "PATH=$BIN:\$PATH pg_ctl -D $DIR/data -o '-p $PORTA -k /tmp' -l $DIR/log.txt start" >/dev/null

# initdb devolve antes de o servidor aceitar conexão; esperar o socket evita
# um erro intermitente que pareceria falha de teste.
for _ in $(seq 1 30); do
  psql -h /tmp -p "$PORTA" -U postgres -tc "select 1" >/dev/null 2>&1 && break
  sleep 0.5
done

psql -h /tmp -p "$PORTA" -U postgres -q -c "create database finz"
psql -h /tmp -p "$PORTA" -U postgres -d finz -q -v ON_ERROR_STOP=1 \
  -f "$RAIZ/supabase/testes/auth-shim.sql"

for f in "$RAIZ"/supabase/migrations/*.sql; do
  psql -h /tmp -p "$PORTA" -U postgres -d finz -q -v ON_ERROR_STOP=1 -f "$f"
done

# Depois das migrations: tabela criada depois do grant não herda nada.
psql -h /tmp -p "$PORTA" -U postgres -d finz -q -v ON_ERROR_STOP=1 \
  -f "$RAIZ/supabase/testes/grants.sql"

echo "postgres de teste no ar em /tmp:$PORTA (banco finz)"
