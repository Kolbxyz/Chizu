#!/usr/bin/env bash
# Optional: a Python environment for Claude's sandboxed code (Claude Code
# engine). The sandbox has no access to PyPI, so libraries are installed here
# once; runs put this environment first on PATH when it exists.
# Usage: scripts/setup-python.sh   (uses $CHIZU_DATA, default ./data)
set -euo pipefail

dir="$(realpath -m "${CHIZU_DATA:-data}")/python"
python3 -m venv "$dir"
"$dir/bin/pip" install --upgrade pip
# numpy/scipy: maths; pillow, opencv, scikit-image: image analysis;
# matplotlib: plots Claude can view; astral: sun position; exifread: full metadata.
"$dir/bin/pip" install numpy scipy pillow opencv-python-headless scikit-image matplotlib astral exifread
echo "Python environment ready: $dir"
