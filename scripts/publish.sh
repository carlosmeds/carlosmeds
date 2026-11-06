#!/usr/bin/env bash
# Publishes the generated SVGs to the `generated` branch.
#
# - Never checks out or modifies main: the commit is built with git plumbing from a
#   temporary index, with the previous `generated` commit (if any) as its parent.
# - Creates the branch on first run.
# - Creates no commit when the files are byte-identical to the published ones.
# - Commits as github-actions[bot], never as the repository owner.
#
# Usage: scripts/publish.sh <dir-with-svgs>
# Env:   PUBLISH_BRANCH (default: generated), PUBLISH_REMOTE (default: origin),
#        PUBLISH_PATH (default: assets), PUBLISH_DRY_RUN=1 to skip the push.
set -euo pipefail

src_dir="${1:?usage: publish.sh <dir-with-svgs>}"
branch="${PUBLISH_BRANCH:-generated}"
remote="${PUBLISH_REMOTE:-origin}"
target="${PUBLISH_PATH:-assets}"
bot_name="github-actions[bot]"
bot_email="41898282+github-actions[bot]@users.noreply.github.com"

case "$branch" in
  main | master | "") echo "::error::Refusing to publish to '$branch'"; exit 1 ;;
esac

shopt -s nullglob
files=("$src_dir"/*.svg)
if ((${#files[@]} == 0)); then
  echo "::error::No SVG files found in $src_dir; nothing published"
  exit 1
fi
for f in "${files[@]}"; do
  if [[ ! -s "$f" ]] || ! head -c 256 "$f" | grep -q '<svg '; then
    echo "::error::$f is empty or not an SVG; nothing published"
    exit 1
  fi
done

parent=""
if git ls-remote --exit-code --heads "$remote" "$branch" >/dev/null 2>&1; then
  git fetch --quiet --no-tags --depth=1 "$remote" "refs/heads/$branch"
  parent="$(git rev-parse FETCH_HEAD)"
  echo "Found existing '$branch' at ${parent:0:12}"
else
  echo "Branch '$branch' does not exist yet; it will be created"
fi

index="$(mktemp)"
trap 'rm -f "$index"' EXIT
rm -f "$index"
export GIT_INDEX_FILE="$index"

for f in "${files[@]}"; do
  blob="$(git hash-object -w -- "$f")"
  git update-index --add --cacheinfo "100644,$blob,$target/$(basename "$f")"
done

readme_blob="$(git hash-object -w --stdin <<README
# Generated stats card

This branch is written automatically by the \`Update stats card\` workflow.
Do not edit or merge it; the source code lives on \`main\`.

Files in \`$target/\` are referenced from the profile README.
README
)"
git update-index --add --cacheinfo "100644,$readme_blob,README.md"

tree="$(git write-tree)"
unset GIT_INDEX_FILE

if [[ -n "$parent" && "$(git rev-parse "$parent^{tree}")" == "$tree" ]]; then
  echo "SVGs unchanged; no commit created"
  exit 0
fi

message="chore: update stats card ($(date -u +%Y-%m-%d))"
commit="$(
  GIT_AUTHOR_NAME="$bot_name" GIT_AUTHOR_EMAIL="$bot_email" \
    GIT_COMMITTER_NAME="$bot_name" GIT_COMMITTER_EMAIL="$bot_email" \
    git commit-tree "$tree" ${parent:+-p "$parent"} -m "$message"
)"
echo "Created commit ${commit:0:12} on '$branch'"

if [[ "${PUBLISH_DRY_RUN:-}" == "1" ]]; then
  echo "Dry run: not pushing"
  exit 0
fi

# Plain (non-force) push: if someone else moved the branch meanwhile, fail loudly.
git push --quiet "$remote" "$commit:refs/heads/$branch"
echo "Pushed to $remote/$branch"
