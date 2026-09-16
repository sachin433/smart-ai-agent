#!/usr/bin/env bash
# Trigger one scan immediately via launchd (or run wrapper directly).
set -euo pipefail

if launchctl print "gui/$(id -u)/com.jobradar.scan" &>/dev/null; then
  launchctl kickstart -k "gui/$(id -u)/com.jobradar.scan"
  echo "Triggered com.jobradar.scan via launchd"
else
  echo "Launch agent not installed — running scan directly..."
  "$(dirname "$0")/cron-scan-wrapper.sh"
fi
