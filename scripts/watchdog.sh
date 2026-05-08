#!/usr/bin/env bash
# Watchdog: kills all "Copilot Plugin Manager" processes if more than
# MAX_INSTANCES are detected. Checks every INTERVAL seconds.

MAX_INSTANCES=${1:-5}
INTERVAL=${2:-5}
APP_NAME="Copilot Plugin Manager"

echo "🐕 Watchdog started — killing all if > $MAX_INSTANCES instances (checking every ${INTERVAL}s)"
echo "   Press Ctrl+C to stop"

while true; do
  # Count Electron processes whose command line contains the app name
  count=$(pgrep -f "$APP_NAME" 2>/dev/null | wc -l | tr -d ' ')

  if [ "$count" -gt "$MAX_INSTANCES" ]; then
    echo "⚠️  $(date '+%H:%M:%S') — $count instances detected (threshold: $MAX_INSTANCES). Killing all..."
    pgrep -f "$APP_NAME" 2>/dev/null | xargs kill -9 2>/dev/null || true
    echo "✅ Done. All instances killed."
  fi

  sleep "$INTERVAL"
done
