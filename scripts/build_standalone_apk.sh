#!/bin/bash
set -e

DIR="/app/applet/tmp/apk_build"
mkdir -p "$DIR/res/values" "$DIR/res/layout" "$DIR/res/drawable" "$DIR/bin"
cd "$DIR"

echo "=== 1. Generating Android Manifest & Resources ==="
python3 build.py

rm -rf bin
mkdir -p bin

echo "=== 2. Generating R.java with AAPT ==="
aapt package -f -m -J src -M AndroidManifest.xml -S res -I /tmp/android.jar

echo "=== 3. Compiling Java Source Files ==="
javac -d bin -cp /tmp/android.jar -source 8 -target 8 $(find src -name "*.java")

echo "=== 4. Translating Bytecode to Dalvik DEX ==="
dalvik-exchange --dex --output=bin/classes.dex bin

echo "=== 5. Packaging APK with AAPT ==="
aapt package -f -M AndroidManifest.xml -S res -I /tmp/android.jar -F bin/unaligned.apk

echo "=== 6. Adding classes.dex to APK ==="
cd bin
aapt add unaligned.apk classes.dex
cd "$DIR"

echo "=== 7. ZipAligning APK ==="
zipalign -f -p 4 bin/unaligned.apk bin/aligned.apk

echo "=== 8. Creating Debug Keystore if needed ==="
if [ ! -f /tmp/debug.keystore ]; then
    keytool -genkey -v -keystore /tmp/debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"
fi

echo "=== 9. Signing APK with apksigner ==="
apksigner sign --ks /tmp/debug.keystore --ks-pass pass:android --min-sdk-version 26 --out BTAudioWalkieTalkie.apk bin/aligned.apk

echo "=== 10. Verifying APK Signature & Validity ==="
apksigner verify -v BTAudioWalkieTalkie.apk

echo "=== 11. Publishing APK to web public/ and android-project/ ==="
mkdir -p /app/applet/public
cp BTAudioWalkieTalkie.apk /app/applet/public/BTAudioWalkieTalkie.apk
cp BTAudioWalkieTalkie.apk /app/applet/android-project/BTAudioWalkieTalkie.apk

ls -lh BTAudioWalkieTalkie.apk
echo "SUCCESS: BTAudioWalkieTalkie.apk built and published successfully!"
