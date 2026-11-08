#!/bin/bash
# On the cloud Mac: start an iPhone simulator, install the test build, and photograph the main screens.
set -u
APP=ios-app/ios/App/build/Build/Products/Debug-iphonesimulator/App.app
mkdir -p shots
LOG=shots/steps.txt
step() { echo "$(date +%T) $*" >> "$LOG"; perl -e 'alarm shift; exec @ARGV' 120 "$@" >> "$LOG" 2>&1; echo "  -> $?" >> "$LOG"; }
DEV=$(xcrun simctl list devices available -j | python3 -c "
import json,sys
d=json.load(sys.stdin)['devices']
c=[x for r,l in d.items() if 'iOS' in r for x in l if x['name'].startswith('iPhone') and 'Pro Max' not in x['name'] and 'Plus' not in x['name'] and 'SE' not in x['name']]
print(c[-1]['udid'])")
xcrun simctl list devices available | grep "$DEV" > shots/device.txt
step xcrun simctl boot "$DEV"
step xcrun simctl bootstatus "$DEV" -b
step xcrun simctl status_bar "$DEV" override --time 9:41 --batteryState charged --batteryLevel 100 --cellularBars 4
step xcrun simctl location "$DEV" set 43.7393,7.4278      # Casino Square, Monaco
step xcrun simctl install "$DEV" "$APP"
step xcrun simctl privacy "$DEV" grant location com.monacomadeeasy.app
step xcrun simctl launch "$DEV" com.monacomadeeasy.app
sleep 17
for n in 1-home 2-map 3-transport 4-guide-eat 5-villages 6-info 7-pro; do
  step xcrun simctl io "$DEV" screenshot "shots/$n.png"
  sleep 10
done
perl -e 'alarm 60; exec @ARGV' xcrun simctl spawn "$DEV" log show --last 3m --style compact --predicate 'process == "App"' 2>/dev/null | grep -iE "error|fail|⚡️|crash" | tail -80 > shots/app-log.txt || true
exit 0
