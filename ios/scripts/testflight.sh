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
set -euo pipefail
cd "$(dirname "$0")/.."

: "${ASC_KEY_ID:?Set ASC_KEY_ID — see the comment at the top of this script}"
: "${ASC_ISSUER_ID:?Set ASC_ISSUER_ID — see the comment at the top of this script}"

BUILD_DIR="${TMPDIR:-/tmp}/gtl-testflight"
ARCHIVE="$BUILD_DIR/GuessTheList.xcarchive"
# App Store Connect refuses a build number it has already seen, and the most
# reliable way never to collide is the clock.
BUILD_NUMBER="$(date +%Y%m%d%H%M)"

echo "▸ Regenerating the project from project.yml…"
xcodegen generate

echo "▸ Archiving (build $BUILD_NUMBER)…"
rm -rf "$BUILD_DIR"
xcodebuild archive \
  -project GuessTheList.xcodeproj \
  -scheme GuessTheList \
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

echo "▸ Uploading ${IPA}…"
xcrun altool --upload-app -f "$IPA" -t ios \
  --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID"

echo ""
echo "✓ Uploaded build $BUILD_NUMBER."
echo "  It will sit in 'Processing' in App Store Connect for 5–15 minutes"
echo "  before testers can install it."
