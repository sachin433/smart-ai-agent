#!/usr/bin/env bash
set -euo pipefail

PLIST="$HOME/Library/LaunchAgents/com.jobradar.scan.plist"

launchctl bootout "gui/$(id -u)/com.jobradar.scan" 2>/dev/null || true
rm -f "$PLIST"

echo "Removed com.jobradar.scan launch agent."
