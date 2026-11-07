#!/bin/bash
set -euo pipefail

pids=()
cleanup() {
  trap - EXIT TERM INT
  kill "${pids[@]}" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT TERM INT

Xvfb "$DISPLAY" -screen 0 1440x1000x24 -nolisten tcp &
pids+=("$!")
ready=false
for attempt in {1..50}; do
  if xdpyinfo -display "$DISPLAY" >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 0.1
done
if [[ "$ready" != true ]]; then
  echo "Virtual display did not start" >&2
  exit 1
fi

openbox &
pids+=("$!")
x11vnc -display "$DISPLAY" -localhost -forever -shared -noxdamage -rfbport 5900 -nopw &
pids+=("$!")
websockify --web=/usr/share/novnc 6080 localhost:5900 &
pids+=("$!")
# The non-root container supplies isolation when Chromium cannot create nested namespaces.
dbus-run-session -- /app/node_modules/electron/dist/electron /app --no-sandbox --disable-dev-shm-usage &
pids+=("$!")

# A failed display, remote desktop, or application must stop the container.
set +e
wait -n "${pids[@]}"
status=$?
exit "$status"
