#!/usr/bin/env bash
# Read-only manual backup. Requires stopped writers and Python 3/PostgreSQL.
set -euo pipefail
exec python3 "$(dirname "$0")/backup-atelier.py" "$@"
