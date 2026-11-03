#!/usr/bin/env bash
# Prints the release notes for version $1: its section of CHANGELOG.md plus a download line.
v="$1"
section=$(awk -v v="$v" '
  BEGIN { esc = v; gsub(/\./, "\\.", esc) }
  $0 ~ "^## " esc "([^0-9.]|$)" { f = 1; next }
  f && /^## / { exit }
  f { print }
' CHANGELOG.md | sed -e '/./,$!d')
[ -z "$section" ] && exit 0
printf '%s\n\n---\n\n**Download:** run **Oto-Setup-%s.exe** below. Already using Oto? It updates itself — you will see "Oto %s is ready — Restart".\n\nAll changes: [CHANGELOG.md](https://github.com/mukairyo/oto/blob/main/CHANGELOG.md)\n' "$section" "$v" "$v"
