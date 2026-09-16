#!/usr/bin/env bash
# Install macOS launchd agent — runs Job Radar scan every 4 hours while logged in.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WRAPPER="$PROJECT_DIR/scripts/cron-scan-wrapper.sh"
PLIST="$HOME/Library/LaunchAgents/com.jobradar.scan.plist"
LOG_DIR="$HOME/Library/Logs/JobRadar"

chmod +x "$WRAPPER"
mkdir -p "$LOG_DIR"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.jobradar.scan</string>
  <key>ProgramArguments</key>
  <array>
    <string>${WRAPPER}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${PROJECT_DIR}</string>
  <key>StartInterval</key>
  <integer>14400</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/scan.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/scan.err.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>
EOF

# Reload if already installed
launchctl bootout "gui/$(id -u)/com.jobradar.scan" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

echo "Installed: com.jobradar.scan"
echo "  Interval: every 4 hours (14400s) + once at login"
echo "  Logs:     ${LOG_DIR}/scan.log"
echo "  Errors:   ${LOG_DIR}/scan.err.log"
echo ""
echo "Commands:"
echo "  npm run cron:status   — check if agent is loaded"
echo "  npm run cron:run      — trigger scan now"
echo "  npm run cron:uninstall — remove agent"
