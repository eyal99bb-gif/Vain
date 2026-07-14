#!/usr/bin/env bash
# Turn alerts.json into GitHub Issues (deduped by title) and close stale
# alert issues whose signal is gone. Requires: gh CLI + GH_TOKEN.
set -euo pipefail

REPO="${GITHUB_REPOSITORY:?}"

open_titles=$(gh issue list --repo "$REPO" --state open --search "🔔 in:title" --json title --jq '.[].title')

count=$(jq length alerts.json)
for i in $(seq 0 $((count - 1))); do
  title=$(jq -r ".[$i].title" alerts.json)
  if grep -qxF "$title" <<<"$open_titles"; then
    echo "already open: $title"
  else
    body=$(jq -r ".[$i].body" alerts.json)
    gh issue create --repo "$REPO" --title "$title" --body "$body"
    echo "created: $title"
  fi
done

# close stale alerts (open 🔔 issues whose title is no longer produced)
current_titles=$(jq -r '.[].title' alerts.json)
while IFS= read -r t; do
  [ -z "$t" ] && continue
  if ! grep -qxF "$t" <<<"$current_titles"; then
    num=$(gh issue list --repo "$REPO" --state open --search "\"$t\" in:title" --json number,title --jq ".[] | select(.title == \"$t\") | .number" | head -1)
    if [ -n "$num" ]; then
      gh issue close "$num" --repo "$REPO" --comment "האות הזה כבר לא פעיל — נסגר אוטומטית."
      echo "closed stale: $t"
    fi
  fi
done <<<"$open_titles"
