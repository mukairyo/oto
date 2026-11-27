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
# Linux packages exist from 1.9.4 on
linux=''
if [ "$(printf '%s\n%s\n' 1.9.4 "${v%%-*}" | sort -V | head -1)" = 1.9.4 ]; then
  linux=$(printf '\n\n**Arch Linux:** download **Oto-%s.pacman** and run `sudo pacman -U Oto-%s.pacman` (it updates itself through pacman). **Any Linux:** **Oto-%s.AppImage** runs on its own and updates itself (on Arch it needs `fuse2`).' "$v" "$v" "$v")
fi
printf '%s\n\n---\n\n**Windows:** run **Oto-Setup-%s.exe** below.%s\n\nAlready using Oto? It updates itself — you will see "Oto %s is ready — Restart".\n\nAll changes: [CHANGELOG.md](https://github.com/mukairyo/oto/blob/main/CHANGELOG.md)\n' "$section" "$v" "$linux" "$v"
