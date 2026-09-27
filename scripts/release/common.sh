# Shared setup for the release scripts. Sourced by them, not run directly.
set -euo pipefail

REPO=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
WORK="$REPO/build/release"  # tool venv, test venv, scratch (gitignored)
DIST="$REPO/dist"           # the sdist and wheel that 5_publish.sh uploads
PYTHON=${PYTHON:-python3}   # used to create the venvs

mkdir -p "$WORK"

# The version lives only in the labextension's package.json (pyproject.toml reads it from there).
version() {
  node -p 'require(process.argv[1]).version' "$REPO/src/plottery_jupyter/package.json"
}

# Prints the bin/ dir of a venv holding the release tools, so they stay out of your dev environment.
tools_bin() {
  if [[ ! -x "$WORK/tools-venv/bin/twine" ]]; then
    "$PYTHON" -m venv "$WORK/tools-venv" >&2
    "$WORK/tools-venv/bin/pip" install --quiet --upgrade pip build twine >&2
  fi
  echo "$WORK/tools-venv/bin"
}

only_file() {  # only_file PATTERN_DESCRIPTION FILES... -> the single file, or fail
  local what=$1; shift
  if [[ $# -ne 1 || ! -e "$1" ]]; then
    echo "Expected exactly one $what in dist/. Run scripts/release/2_build.sh first." >&2
    exit 1
  fi
  echo "$1"
}
the_wheel() { only_file "wheel" "$DIST"/*.whl; }
the_sdist() { only_file "sdist" "$DIST"/*.tar.gz; }

# Files that go into the sdist but differ from the current commit (modified, staged, or untracked).
uncommitted_package_files() {
  git -C "$REPO" status --porcelain --untracked-files=all -- \
    pyproject.toml README.md LICENSE package.json package-lock.json vite.config.js tsconfig.json \
    src/plottery src/frontend src/plottery_jupyter/package.json src/plottery_jupyter/package-lock.json \
    src/plottery_jupyter/plottery_jupyter.js src/plottery_jupyter/install.json
}
