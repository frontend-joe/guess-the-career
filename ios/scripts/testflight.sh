#!/usr/bin/env bash
# Archive, export and upload a build to TestFlight.
#
# What you need once, before this will work:
#   1. An app record in App Store Connect for com.guessthelist.GuessTheList.
#   2. An App Store Connect API key (Users and Access → Integrations → Keys),
#      with the .p8 saved to ~/.appstoreconnect/private_keys/.
#   3. These in the environment:
#        ASC_KEY_ID      the key's ID
#        ASC_ISSUER_ID   the issuer ID shown above the key list
#
# The API key is the part worth guarding: it can upload builds to your
# account. It is a file on disk and an env var, never anything committed.
#
# Set them once in ios/.testflight.env (gitignored) and this picks them up
# every run:
#     ASC_KEY_ID=XXXXXXXXXX
#     ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
set -euo pipefail
cd "$(dirname "$0")/.."

# An env file beats remembering two opaque identifiers before every release.
# It is gitignored, and it holds identifiers rather than the key itself — the
# .p8 stays in ~/.appstoreconnect/private_keys and is never copied in here.
if [ -f .testflight.env ]; then
  set -a; . ./.testflight.env; set +a
fi

# Only one key installed? Then that is the one, and there is nothing to set.
if [ -z "${ASC_KEY_ID:-}" ]; then
  keys=(~/.appstoreconnect/private_keys/AuthKey_*.p8)
  if [ "${#keys[@]}" -eq 1 ] && [ -f "${keys[0]}" ]; then
    ASC_KEY_ID="$(basename "${keys[0]}" .p8)"; ASC_KEY_ID="${ASC_KEY_ID#AuthKey_}"
    echo "▸ Using the only installed key: $ASC_KEY_ID"
  fi
fi

# Everything up to the upload works without these, so --dry-run proves the
# build and the signing without needing them — which is most of what goes
# wrong, and all of what went wrong the first time this was tried. The checks
# therefore come AFTER the flag, or a dry run would demand credentials it is
# never going to use.
DRY_RUN=""
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

if [ -z "$DRY_RUN" ]; then
  : "${ASC_KEY_ID:?Set ASC_KEY_ID in ios/.testflight.env — see the top of this script}"
  : "${ASC_ISSUER_ID:?Set ASC_ISSUER_ID in ios/.testflight.env — the UUID above the key list in App Store Connect → Users and Access → Integrations → Keys}"
fi

BUILD_DIR="${TMPDIR:-/tmp}/gtl-testflight"
ARCHIVE="$BUILD_DIR/GuessTheList.xcarchive"
# App Store Connect refuses a build number it has already seen, and the most
# reliable way never to collide is the clock.
BUILD_NUMBER="$(date +%Y%m%d%H%M)"

echo "▸ Regenerating the project from project.yml…"
xcodegen generate

echo "▸ Archiving (build $BUILD_NUMBER)…"
rm -rf "$BUILD_DIR"
# -configuration Release is belt and braces. A synthesised scheme — and
# project.yml declares none, so this is one — already archives in Release,
# which is Xcode's default for the Archive action. Stated anyway so that a
# scheme added to project.yml later cannot quietly change what ships.
xcodebuild archive \
  -project GuessTheList.xcodeproj \
  -scheme GuessTheList \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" \
  -allowProvisioningUpdates \
  CURRENT_PROJECT_VERSION="$BUILD_NUMBER"


echo "▸ Exporting the ipa…"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportPath "$BUILD_DIR/export" \
  -exportOptionsPlist ExportOptions.plist \
  -allowProvisioningUpdates

IPA="$(find "$BUILD_DIR/export" -name '*.ipa' | head -1)"
[ -n "$IPA" ] || { echo "✗ No ipa was produced"; exit 1; }

# The ipa, not the archive.
#
# Do not be tempted to check the archive instead: it is signed for DEVELOPMENT
# and reads aps-environment development quite correctly, because Xcode signs
# an archive with whatever profile builds it and re-signs for distribution
# here, at export. Checking the archive looks like it has caught a disaster
# and has caught nothing at all.
#
# Worth checking at all because a build signed for the wrong APNs environment
# cannot be told apart from a phone with the app deleted — both come back
# BadDeviceToken. That is not a thing to learn from a tester saying
# notifications do not work.
echo "▸ Checking the ipa is signed for production push…"
VERIFY="$BUILD_DIR/verify"
rm -rf "$VERIFY" && mkdir -p "$VERIFY"
unzip -q "$IPA" -d "$VERIFY"
APP="$(find "$VERIFY/Payload" -maxdepth 1 -name '*.app' | head -1)"
APS="$(codesign -d --entitlements - --xml "$APP" 2>/dev/null \
  | plutil -extract aps-environment raw -o - - 2>/dev/null)"
if [ "$APS" != "production" ]; then
  echo "✗ The ipa has aps-environment '$APS', expected 'production'."
  echo "  Its push token would only work on Apple's sandbox gateway, and the"
  echo "  production one would refuse it as BadDeviceToken."
  exit 1
fi
echo "  aps-environment: production"

if [ -n "$DRY_RUN" ]; then
  echo ""
  echo "✓ Built and exported $IPA"
  echo "  Stopping before the upload because --dry-run was passed."
  exit 0
fi

echo "▸ Uploading ${IPA}…"
xcrun altool --upload-app -f "$IPA" -t ios \
  --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID"

echo ""
echo "✓ Uploaded build $BUILD_NUMBER."
echo "  It will sit in 'Processing' in App Store Connect for 5–15 minutes"
echo "  before testers can install it."
