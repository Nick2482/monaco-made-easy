#!/bin/bash
# On the cloud Mac: start an iPhone simulator, install the test build, and photograph the main screens.
set -u
APP=ios-app/ios/App/build/Build/Products/Debug-iphonesimulator/App.app
mkdir -p shots
DEV=$(xcrun simctl list devices available -j | python3 -c "
import json,sys
d=json.load(sys.stdin)['devices']
c=[x for r,l in d.items() if 'iOS' in r for x in l if x['name'].startswith('iPhone') and 'Pro Max' not in x['name'] and 'Plus' not in x['name'] and 'SE' not in x['name']]
print(c[-1]['udid'])")
xcrun simctl list devices available | grep "$DEV" | tee shots/device.txt
xcrun simctl boot "$DEV"; xcrun simctl bootstatus "$DEV" -b >/dev/null
xcrun simctl status_bar "$DEV" override --time 9:41 --batteryState charged --batteryLevel 100 --cellularBars 4 || true
xcrun simctl location "$DEV" set 43.7393,7.4278 || true      # Casino Square, Monaco
xcrun simctl install "$DEV" "$APP"
xcrun simctl privacy "$DEV" grant location com.monacomadeeasy.app || true
xcrun simctl launch "$DEV" com.monacomadeeasy.app
sleep 17
for n in 1-home 2-map 3-transport 4-guide-eat 5-villages 6-info 7-pro; do
  xcrun simctl io "$DEV" screenshot "shots/$n.png" >/dev/null 2>&1
  sleep 10
done
xcrun simctl spawn "$DEV" log show --last 3m --style compact --predicate 'process == "App"' 2>/dev/null | grep -iE "error|fail|⚡️" | tail -80 > shots/app-log.txt || true
