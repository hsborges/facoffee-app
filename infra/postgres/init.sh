#!/bin/sh
# Cria um banco e um usuário por serviço; só o dono conecta no próprio banco.
set -eu

for svc in usuario participacao financeiro; do
  pass=$(printenv "$(echo "$svc" | tr a-z A-Z)_DB_PASSWORD")
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -v svc="$svc" -v pass="$pass" <<'SQL'
CREATE ROLE :"svc" LOGIN PASSWORD :'pass';
CREATE DATABASE :"svc" OWNER :"svc";
REVOKE ALL ON DATABASE :"svc" FROM PUBLIC;
SQL
done
