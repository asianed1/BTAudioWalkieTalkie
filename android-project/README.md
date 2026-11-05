# BTAudioWalkieTalkie (Android Kotlin)

**BTAudioWalkieTalkie** is a standalone Android application implemented in Kotlin that establishes a direct, peer-to-peer full-duplex voice communication channel between two nearby Android smartphones using Bluetooth RFCOMM (Serial Port Profile).

## Architecture Overview

```
                      +-----------------------------+
                      |       Jetpack Compose       |
                      |   (Material 3 Dashboard)    |
                      +--------------+--------------+
                                     |
               +---------------------+---------------------+
               |                                           |
  +------------v------------+                 +------------v------------+
  |   BluetoothController   |                 |       AudioEngine       |
  |  - Server: listenUsing- |                 |  - Concurrent Sender    |
  |    RfcommWithService-   |                 |    & Receiver Threads   |
  |    Record (UUID SPP)    |                 |  - 16kHz 16-bit PCM     |
  |  - Client: create-      |                 |  - AudioRecord VOICE_   |
  |    RfcommSocketTo-      |                 |    COMMUNICATION        |
  |    ServiceRecord        |                 |  - AudioTrack STREAM_   |
  |  - Discovery & Pairing  |                 |    VOICE_CALL           |
  |  - Android 12+ perms    |                 |  - AcousticEchoCanceler |
  +------------+------------+                 +------------+------------+
               |                                           |
               +---------------------+---------------------+
                                     |
                     +---------------v---------------+
                     |   BluetoothSocket (RFCOMM)    |
                     |  InputStream / OutputStream   |
                     +-------------------------------+
```

### Key Technical Specs

1. **Bluetooth RFCOMM Link & Topology:**
   - **Strict Point-to-Point (1-to-1):** Only two phones can connect at any time. As soon as `serverSocket.accept()` returns an established socket, `serverSocket.close()` is immediately executed. A third device attempting to connect will receive an immediate `Connection refused / IOException`.
   - **Standard SPP UUID:** `00001101-0000-1000-8000-00805F9B34FB` (Serial Port Profile)
   - Server listens with `bluetoothAdapter.listenUsingRfcommWithServiceRecord(APP_NAME, UUID)`
   - Client initiates connection with `device.createRfcommSocketToServiceRecord(UUID)`
   - Automatic discovery cancellation before connecting to prevent 2.4GHz interference and buffer stalling.

2. **Audio Streaming Engine:**
   - **Sample Rate:** 16,000 Hz (16kHz wideband audio / HD voice standard)
   - **Encoding:** 16-bit Signed PCM Mono (Little-Endian)
   - **Bitrate:** 256 kbps (32 kB/second) — perfectly fits within standard Bluetooth RFCOMM throughput limits (300-800 kbps) with zero compression artifacts or encoding latency.
   - **Sender:** `AudioRecord` with `MediaRecorder.AudioSource.VOICE_COMMUNICATION`
   - **Receiver:** `AudioTrack` with `AudioAttributes.USAGE_VOICE_COMMUNICATION` and `AudioManager.STREAM_VOICE_CALL` in `MODE_STREAM`
   - **Acoustic Echo Cancellation (AEC):** `android.media.audiofx.AcousticEchoCanceler` attached to the `audioRecord.audioSessionId` prevents acoustic loopback feedback when both phone speakers and microphones are active simultaneously.
   - **Noise Suppression (NS):** `android.media.audiofx.NoiseSuppressor` filters ambient environmental noise.

3. **Android 12+ Permission Compatibility:**
   - `android.permission.RECORD_AUDIO`
   - `android.permission.MODIFY_AUDIO_SETTINGS`
   - `android.permission.BLUETOOTH_SCAN` (`neverForLocation`)
   - `android.permission.BLUETOOTH_CONNECT`
   - `android.permission.BLUETOOTH_ADVERTISE`

## How to Build in Android Studio

1. Open Android Studio (Ladybug or newer).
2. Select **File -> Open...** and select this directory (`android-project`).
3. Allow Gradle to sync dependencies.
4. Connect two physical Android test devices with Developer Options enabled via USB or Wi-Fi debugging.
5. Click **Run** (`Shift + F10`) to install on Phone 1, then repeat for Phone 2.

## Testing Two Devices

1. Launch **BTAudioWalkieTalkie** on both Phone 1 and Phone 2.
2. Grant the Bluetooth and Microphone permissions when prompted.
3. On **Phone 1**: Tap **Host Connection**. Phone 1 begins listening for incoming peer sockets.
4. On **Phone 2**: Tap **Scan & Discover** (or select Phone 1 from the "Paired Devices" list if already paired in Android settings).
5. On **Phone 2**: Tap **Connect** next to Phone 1.
6. Once connected, both phones immediately establish full-duplex voice link:
   - Talk into Phone 1 -> Heard instantly through Phone 2 speaker.
   - Talk into Phone 2 -> Heard instantly through Phone 1 speaker.
   - Both microphones can transmit at the exact same time without muting or half-duplex walkie-talkie clipping.
7. Tap the large center button anytime to mute/unmute your microphone.
8. Tap **End Voice Link** or the top red phone icon to disconnect cleanly and release audio hardware.
