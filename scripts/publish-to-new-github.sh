#!/usr/bin/env bash
set -euo pipefail

OWNER="${1:?Usage: ./scripts/publish-to-new-github.sh <github-owner> <new-repo-name> [visibility]}"
REPO="${2:?Usage: ./scripts/publish-to-new-github.sh <github-owner> <new-repo-name> [visibility]}"
VISIBILITY="${3:-public}"

case "$VISIBILITY" in
  public|private) ;;
  *) echo "Visibility must be public or private" >&2; exit 2 ;;
esac

if git remote get-url origin >/dev/null 2>&1; then
  echo "origin already exists; refusing to overwrite it." >&2
  exit 3
fi

git remote add origin "https://github.com/${OWNER}/${REPO}.git"
git push -u origin main

echo "Pushed to ${OWNER}/${REPO}. Existing repositories were not modified."
