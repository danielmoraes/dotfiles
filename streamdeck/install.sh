#!/usr/bin/env bash
# Bootstrap the Stream Deck configuration on macOS.
#
# - Verifies the Stream Deck app (and optionally the @elgato/cli) are present.
# - Builds the TypeScript glue commands and links the executables into
#   ~/.local/bin as `sd-<name>`.
# - Creates a git-ignored secrets template at ~/.config/streamdeck/secrets.env.
# - Prints the plugin install checklist.
#
# Safe to re-run (idempotent).

set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$DIR/.." && pwd)"

BIN_DIR="$HOME/.local/bin"
CFG_DIR="$HOME/.config/streamdeck"
SECRETS="$CFG_DIR/secrets.env"

info()  { printf '\033[1;34m•\033[0m %s\n' "$*"; }
ok()    { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
warn()  { printf '\033[1;33m!\033[0m %s\n' "$*"; }

echo "Stream Deck bootstrap"
echo "====================="

# 1. App check
if [[ -d "/Applications/Elgato Stream Deck.app" ]]; then
  ok "Stream Deck app found"
else
  warn "Stream Deck app not found. Install: brew install --cask elgato-stream-deck"
fi

# 2. Toolchain check (pnpm builds the plugins + scripts)
if command -v pnpm >/dev/null 2>&1; then
  ok "pnpm present ($(pnpm --version 2>/dev/null || echo '?'))"
else
  warn "pnpm not found — install with: corepack enable && corepack prepare pnpm@10.15.0 --activate"
fi
if command -v streamdeck >/dev/null 2>&1; then
  ok "@elgato/cli present ($(streamdeck --version 2>/dev/null || echo '?'))"
else
  info "@elgato/cli not installed (only needed to build custom plugins): pnpm add -g @elgato/cli"
fi

# 3. Build + link the TypeScript glue commands
if command -v pnpm >/dev/null 2>&1; then
  info "Installing workspace deps + building scripts"
  (
    cd "$REPO_ROOT" || exit
    pnpm install --frozen-lockfile >/dev/null 2>&1 || pnpm install >/dev/null 2>&1
  )
  (
    cd "$DIR/scripts" || exit
    pnpm run build >/dev/null 2>&1
  )
  # Install lefthook git hooks (check on commit, test on push).
  if [[ -d "$REPO_ROOT/.git" ]]; then
    if ( cd "$REPO_ROOT" || exit; pnpm exec lefthook install >/dev/null 2>&1 ); then
      ok "Git hooks installed (lefthook: check on commit, test on push)"
    fi
  fi
fi

mkdir -p "$BIN_DIR"
info "Linking commands into $BIN_DIR"
shopt -s nullglob
linked=0
for f in "$DIR"/scripts/bin/*.js; do
  base="$(basename "$f" .js)"
  # Skip tsdown shared chunks (hashed names like ctx-XXXX.js); link only the
  # command entrypoints. Node resolves the sibling chunks via the real path.
  case "$base" in
    switch-claude-account|summon-agent|summon-claude|focus-mode|meeting-mode|quick-capture|standup)
      chmod +x "$f"
      ln -sf "$f" "$BIN_DIR/sd-${base}"
      ok "sd-${base} -> $f"
      linked=1
      ;;
  esac
done
[[ "$linked" == 1 ]] || warn "No built commands found — run: pnpm -C \"$DIR/scripts\" run build"
case ":$PATH:" in
  *":$BIN_DIR:"*) : ;;
  *) warn "$BIN_DIR is not on your PATH — add it in your shell rc" ;;
esac

# 4. Secrets template
mkdir -p "$CFG_DIR"
if [[ ! -f "$SECRETS" ]]; then
  cat > "$SECRETS" <<'EOF'
# Stream Deck secrets — DO NOT COMMIT. Chmod 600.
GITHUB_TOKEN=
SLACK_TOKEN=
WAKATIME_API_KEY=
JIRA_BASE_URL=
JIRA_EMAIL=
JIRA_API_TOKEN=
ICAL_URL=
# Optional preferences
STREAMDECK_TERMINAL=terminal        # terminal|iterm|wezterm|kitty
STREAMDECK_DEFAULT_REPO=$HOME/code
STREAMDECK_INBOX=$HOME/inbox.md
STREAMDECK_FOCUS_PLAYLIST=          # spotify: URI
EOF
  chmod 600 "$SECRETS"
  ok "Created secrets template: $SECRETS (fill it in)"
else
  ok "Secrets file already exists: $SECRETS"
fi

# 5. Plugin checklist
echo
info "Next: install these plugins (see streamdeck/plugins/README.md)"
cat <<'EOF'
  [ ] AgentDeck                 github.com/puritysb/AgentDeck        (daemon + plugin)
  [ ] stream-deck-ai-limits     github.com/lenadweb/stream-deck-ai-limits
  [ ] stream-deck-ical          github.com/pedrofuentes/stream-deck-ical
  [ ] essentials-for-spotify    github.com/ntanis-dev/essentials-for-spotify
  [ ] streamdeck-jira           github.com/mediabounds/streamdeck-jira
  [ ] github-stats   (custom, this repo — pnpm -C plugins/github-stats build)
  [ ] slack-unread   (custom, this repo)
  [ ] weekly-metrics (custom, this repo)
EOF
echo
ok "Bootstrap complete. Then import profiles from streamdeck/profiles/."
