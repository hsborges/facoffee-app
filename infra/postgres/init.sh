#!/bin/sh
# Cria um banco e um usuário por serviço; só o dono conecta no próprio banco.
# Sem senha: o PostgreSQL do ambiente local aceita qualquer conexão (POSTGRES_HOST_AUTH_METHOD=trust).
set -eu

for svc in usuario participacao financeiro notificacao example; do
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -v svc="$svc" <<'SQL'
CREATE ROLE :"svc" LOGIN;
CREATE DATABASE :"svc" OWNER :"svc";
REVOKE ALL ON DATABASE :"svc" FROM PUBLIC;
SQL
done
