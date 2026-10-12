#!/usr/bin/env bash
# Fonctions communes des scripts de base éphémère (CI). À sourcer, pas à lancer.
#
# Garde-fou central : ces scripts n'écrivent QUE dans une base locale
# (localhost, 127.0.0.1, ::1 ou socket Unix). Une URL distante, donc la
# production, est refusée avant toute commande SQL.

host_of_database_url() {
  # postgresql://user[:pass]@host[:port]/db[?query]  ou  postgresql:///db?host=/socket
  local url="$1" rest authority host
  rest="${url#*://}"
  authority="${rest%%/*}"
  if [[ "$authority" == *"@"* ]]; then authority="${authority##*@}"; fi
  host="${authority%%:*}"
  if [[ "$authority" == "["* ]]; then host="${authority%%]*}]"; fi
  if [[ -z "$host" && "$url" == *"host="* ]]; then
    host="${url##*host=}"
    host="${host%%&*}"
  fi
  printf '%s' "$host"
}

require_local_database() {
  : "${DATABASE_URL:?DATABASE_URL est requis (base locale)}"
  local host
  host="$(host_of_database_url "$DATABASE_URL")"
  case "$host" in
    localhost | 127.0.0.1 | "[::1]" | "" | /*) ;;
    *)
      echo "REFUS : la base visée (${host}) n'est pas locale. Ces scripts ne s'exécutent que sur une base éphémère." >&2
      exit 2
      ;;
  esac
}

step() { printf '\n[ci-db] %s\n' "$1"; }
