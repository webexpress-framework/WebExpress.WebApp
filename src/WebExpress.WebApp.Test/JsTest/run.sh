#!/usr/bin/env bash
# Runs the headless engine and control tests with Node.
#
# It uses node from the PATH when available, and otherwise falls back to the
# conventional install locations. Set WEBEXPRESS_NODE to pin a specific runtime
# (for example on a CI agent where node is not on the PATH).
#
# Usage from this folder:
#   ./run.sh

set -euo pipefail

resolve_node() {
    if [ -n "${WEBEXPRESS_NODE:-}" ] && [ -x "${WEBEXPRESS_NODE}" ]; then
        printf '%s\n' "${WEBEXPRESS_NODE}"
        return 0
    fi

    if command -v node >/dev/null 2>&1; then
        command -v node
        return 0
    fi

    for candidate in /usr/local/bin/node /usr/bin/node /opt/homebrew/bin/node; do
        if [ -x "${candidate}" ]; then
            printf '%s\n' "${candidate}"
            return 0
        fi
    done

    return 1
}

if ! node_bin="$(resolve_node)"; then
    echo "node was not found on the PATH or in a conventional location. Install Node 18 or newer (or set WEBEXPRESS_NODE)." >&2
    exit 1
fi

echo "using node: ${node_bin}"
cd "$(dirname "$0")"
exec "${node_bin}" --test
