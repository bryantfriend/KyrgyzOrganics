#!/usr/bin/env bash
set -euo pipefail

# Explicit integration test only. All npm installs, emulator writes and Firebase
# config live in a new temporary directory; no production app config is loaded.
test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "$test_dir/../.." && pwd)"
work_dir="$(mktemp -d "${TMPDIR:-/tmp}/oako-cost-emulator.XXXXXX")"
trap 'rm -rf "$work_dir"' EXIT

cp "$test_dir/validate-campaign-counts.emulator.mjs" "$work_dir/verify.mjs"
cp "$repo_dir/admin/campaign-stats.mjs" "$repo_dir/admin/reporting-repository.mjs" "$work_dir/"
cd "$work_dir"
printf '%s\n' '{"private":true,"type":"module"}' > package.json
printf '%s\n' '{"emulators":{"firestore":{"host":"127.0.0.1","port":18780},"ui":{"enabled":false},"singleProjectMode":true},"firestore":{"rules":"firestore.rules"}}' > firebase.json
printf '%s\n' "rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if true; } } }" > firestore.rules

npm install --cache "$work_dir/npm-cache" --ignore-scripts --no-audit --no-fund --save-exact firebase@10.7.1 firebase-tools@15.34.1
export HOME="$work_dir/home" XDG_CONFIG_HOME="$work_dir/config" XDG_CACHE_HOME="$work_dir/cache"
export CI=1 NO_UPDATE_NOTIFIER=1 FIREBASE_CLI_DISABLE_TELEMETRY=1
export NO_PROXY="localhost,127.0.0.1" no_proxy="localhost,127.0.0.1"
./node_modules/.bin/firebase emulators:exec --project demo-cost-tests --only firestore 'node verify.mjs'
