#!/usr/bin/env bash
# Spiegelt apps/tv in das OEFFENTLICHE Build-Repo
# (MenuCloud-Berlin/salati-tv-build). Grund: GitHub gibt oeffentlichen Repos
# unbegrenzte Actions-Minuten — auch auf macOS-Runnern, und nur dort laesst sich
# eine Apple-TV-App bauen. Dasselbe Vorgehen wie bei apps/mobile.
#
# Es wird NUR getrackter Inhalt gespiegelt (git archive) — node_modules,
# credentials.json, .env, android/, ios/ sind gitignored und damit automatisch
# draussen. Signierung laeuft ausschliesslich ueber Actions-Secrets.
#
# Aufruf aus apps/tv:  GH_TOKEN=... bash scripts/sync-public-build.sh
set -euo pipefail

PUBLIC_REPO="https://x-access-token:${GH_TOKEN}@github.com/MenuCloud-Berlin/salati-tv-build.git"
SRC="$(cd "$(dirname "$0")/.." && pwd)"   # apps/tv
ROOT="$(cd "$SRC/../.." && pwd)"          # Monorepo-Root
WORK="$(mktemp -d)"

echo "Klone Build-Repo -> $WORK"
git clone --depth 1 "$PUBLIC_REPO" "$WORK" 2>/dev/null || {
  mkdir -p "$WORK/repo"; cd "$WORK/repo"; git init -q; git remote add origin "$PUBLIC_REPO"; WORK="$WORK/repo";
}
cd "$WORK"

find . -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +

echo "Spiegle apps/tv (git archive, nur getrackte Dateien)"
git -C "$ROOT" archive HEAD:apps/tv | tar -x -C .

# Bildschirmfotos und Store-Texte gehoeren zur Auslieferung, nicht zum Bauen —
# sie kosten hier nur Uebertragung.
rm -rf screenshots store coverage
# Sicherheitsnetz, falls je etwas Vertrauliches getrackt wuerde.
rm -f credentials.json .env .env.* *.jks *.p12 *.p8 2>/dev/null || true

# Interne Planungs-/Audit-Dokumente gehoeren NICHT in den oeffentlichen
# Spiegel (Vorfall 2026-08-24: USER-TODO.md und docs/ mit internen Audits
# und Ablehnungs-Notizen standen wochenlang oeffentlich lesbar auf GitHub,
# weil `git archive` sie unveraendert mitspiegelt). AGENTS.md/CLAUDE.md/
# BACKLOG.md/PLAN-*/PLAY-* vorsorglich mit ausgeschlossen, falls sie hier
# je auftauchen (existieren in apps/tv aktuell nicht).
rm -rf docs
rm -f USER-TODO.md AGENTS.md CLAUDE.md BACKLOG.md AUDIT-*.md PLAN-*.md PLAY-*.md 2>/dev/null || true

cat > README.md <<'MD'
# Salati TV — Build-Mirror (öffentlich)

Automatisch gespiegelter Build-Mirror von `apps/tv` (Privat-Repo) für
**kostenlose GitHub-Actions-Builds**. Apple-TV-Apps lassen sich nur auf
macOS-Runnern bauen; die sind für öffentliche Repos kostenlos.

**Enthält keine Secrets** — Signierung läuft ausschließlich über verschlüsselte
Actions-Secrets. Nicht direkt hier entwickeln; Änderungen kommen per Sync aus
dem Privat-Repo.
MD

git add -A
if git diff --cached --quiet; then
  echo "Keine Aenderungen."
else
  git -c user.name="MenuCloud Berlin" -c user.email="menucloudberlin@gmail.com" \
      commit -q -m "Sync apps/tv ($(date -u +%Y-%m-%dT%H:%MZ))"
  git branch -M main
  git push -u origin main
  echo "Gepusht."
fi
