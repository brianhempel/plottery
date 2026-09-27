#!/usr/bin/env bash
# Step 5: upload dist/ to TestPyPI or PyPI. Nothing is uploaded unless you name where.
#   scripts/release/5_publish.sh --testpypi   # practice run: https://test.pypi.org/project/plottery-ui/
#   scripts/release/5_publish.sh --pypi       # the real release; also tags the commit locally
# PyPI (and TestPyPI) never let you reuse a version number, even after deleting a release.
source "$(dirname "$0")/common.sh"

case "${1:-}" in
  --testpypi) REPOSITORY=testpypi ;;
  --pypi)     REPOSITORY=pypi ;;
  *) sed -n '2,5p' "$0" | sed 's/^# \{0,1\}//'; exit 2 ;;
esac

TOOLS=$(tools_bin)
WHEEL=$(the_wheel)
SDIST=$(the_sdist)
VERSION=$(version)
PEP440_VERSION=$("$TOOLS/python" -c 'import sys; from packaging.version import Version; print(Version(sys.argv[1]))' "$VERSION")

[[ "$(basename "$WHEEL")" == "plottery_ui-$PEP440_VERSION-py3-none-any.whl" ]] || {
  echo "dist/ holds $(basename "$WHEEL"), but the version is $VERSION. Rebuild with 2_build.sh." >&2
  exit 1
}
[[ -f "$WORK/built-from.txt" ]] || { echo "No record of the build. Rebuild with 2_build.sh." >&2; exit 1; }
BUILT_FROM_COMMIT=$(head -1 "$WORK/built-from.txt")
BUILT_WITH_CHANGES=$(tail -n +2 "$WORK/built-from.txt")

if [[ $REPOSITORY == pypi ]]; then
  fail() { echo "Not publishing: $*" >&2; exit 1; }
  [[ "$(git -C "$REPO" branch --show-current)" == main ]] || fail "not on main."
  [[ "$BUILT_FROM_COMMIT" == "$(git -C "$REPO" rev-parse HEAD)" ]] || fail "dist/ was built from a different commit. Rebuild with 2_build.sh."
  [[ -z "$BUILT_WITH_CHANGES$(uncommitted_package_files)" ]] || fail "packaged files have uncommitted changes. Commit, then rebuild with 2_build.sh."
  if git -C "$REPO" rev-parse -q --verify "refs/tags/v$VERSION" >/dev/null; then fail "tag v$VERSION already exists."; fi

  read -r -p "Publish plottery-ui $PEP440_VERSION to PyPI for everyone? Type the version to confirm: " CONFIRM
  [[ "$CONFIRM" == "$PEP440_VERSION" || "$CONFIRM" == "$VERSION" ]] || fail "confirmation didn't match."
elif [[ -n "$BUILT_WITH_CHANGES" ]]; then
  echo "Note: this build included uncommitted changes."
fi

"$TOOLS/twine" upload --repository "$REPOSITORY" "$WHEEL" "$SDIST"

if [[ $REPOSITORY == testpypi ]]; then
  echo
  echo "Uploaded to https://test.pypi.org/project/plottery-ui/$PEP440_VERSION/"
  echo "Try it in a fresh venv (dependencies still come from the real PyPI):"
  echo "  pip install -i https://test.pypi.org/simple/ --extra-index-url https://pypi.org/simple/ 'plottery-ui[lab]==$PEP440_VERSION'"
else
  git -C "$REPO" tag -a "v$VERSION" -m "plottery-ui $VERSION"
  echo
  echo "Published https://pypi.org/project/plottery-ui/$PEP440_VERSION/ and tagged v$VERSION locally. Push the tag with:"
  echo "  git push origin v$VERSION"
fi
