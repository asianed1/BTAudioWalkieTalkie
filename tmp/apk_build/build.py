import os
import subprocess
import sys

BASE = "/app/applet/tmp/apk_build"

# 1. AndroidManifest.xml
manifest_content = """<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.example.btaudiowalkietalkie"
    android:versionCode="1"
    android:versionName="1.0.0">

    <uses-sdk android:minSdkVersion="26" android:targetSdkVersion="34" />

    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />

    <uses-feature android:name="android.hardware.bluetooth" android:required="true" />
    <uses-feature android:name="android.hardware.microphone" android:required="true" />

    <application
        android:label="BTAudioWalkieTalkie"
        android:icon="@drawable/ic_launcher"
        android:theme="@android:style/Theme.Material.NoActionBar">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|screenLayout|keyboardHidden">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
"""

with open(f"{BASE}/AndroidManifest.xml", "w") as f:
    f.write(manifest_content)

# 2. Resources
with open(f"{BASE}/res/values/strings.xml", "w") as f:
    f.write("""<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">BTAudioWalkieTalkie</string>
</resources>
""")

with open(f"{BASE}/res/values/colors.xml", "w") as f:
    f.write("""<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="primary">#0284C7</color>
    <color name="background">#0F172A</color>
    <color name="surface">#1E293B</color>
    <color name="text_white">#F8FAFC</color>
    <color name="accent_green">#10B981</color>
    <color name="accent_red">#EF4444</color>
</resources>
""")

with open(f"{BASE}/res/layout/activity_main.xml", "w") as f:
    f.write("""<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:background="#0F172A"
    android:padding="20dp">

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="BTAudioWalkieTalkie"
        android:textColor="#FFFFFF"
        android:textSize="22sp"
        android:textStyle="bold" />

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="RFCOMM 16kHz PCM Full-Duplex"
        android:textColor="#94A3B8"
        android:textSize="12sp"
        android:layout_marginBottom="16dp" />

    <TextView
        android:id="@+id/tvStatus"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Status: Disconnected"
        android:background="#1E293B"
        android:textColor="#38BDF8"
        android:padding="12dp"
        android:textSize="14sp"
        android:textStyle="bold"
        android:layout_marginBottom="16dp" />

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:layout_marginBottom="16dp">

        <Button
            android:id="@+id/btnHost"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:text="Host Link"
            android:backgroundTint="#0284C7"
            android:textColor="#FFFFFF"
            android:layout_marginEnd="8dp" />

        <Button
            android:id="@+id/btnScan"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:text="Scan Peers"
            android:backgroundTint="#334155"
            android:textColor="#FFFFFF" />
    </LinearLayout>

    <TextView
        android:id="@+id/tvMetrics"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="AEC: Hardware Ready | Format: 16kHz 16-bit Mono (256 kbps)"
        android:textColor="#64748B"
        android:textSize="11sp"
        android:layout_marginBottom="16dp" />

    <ListView
        android:id="@+id/listDevices"
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1"
        android:background="#1E293B"
        android:divider="#334155"
        android:dividerHeight="1dp"
        android:layout_marginBottom="16dp" />

    <Button
        android:id="@+id/btnMuteToggle"
        android:layout_width="match_parent"
        android:layout_height="64dp"
        android:text="MIC LIVE (FULL DUPLEX)"
        android:backgroundTint="#10B981"
        android:textColor="#FFFFFF"
        android:textStyle="bold"
        android:textSize="16sp"
        android:layout_marginBottom="12dp" />

    <Button
        android:id="@+id/btnDisconnect"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Disconnect Voice Link"
        android:backgroundTint="#EF4444"
        android:textColor="#FFFFFF" />

</LinearLayout>
""")

import struct
import zlib

def make_png(w=48, h=48):
    raw = b"".join(b"\x00" + b"\x02\x84\xC7\xFF" * w for _ in range(h))
    def chunk(tag, data):
        return struct.pack("!I", len(data)) + tag + data + struct.pack("!I", zlib.crc32(tag + data) & 0xffffffff)
    ihdr = struct.pack("!IIBBBBB", w, h, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")

with open(f"{BASE}/res/drawable/ic_launcher.png", "wb") as f:
    f.write(make_png())

print("Manifest and resources generated successfully.")
