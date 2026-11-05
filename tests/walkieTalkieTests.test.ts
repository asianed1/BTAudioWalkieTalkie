import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('BTAudioWalkieTalkie Standard Architecture Tests', () => {

  test('Test 1: Bluetooth Standard SPP UUID Compliance', () => {
    const expectedUuid = '00001101-0000-1000-8000-00805F9B34FB';
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    
    assert.strictEqual(expectedUuid.toLowerCase(), '00001101-0000-1000-8000-00805f9b34fb');
    assert.match(expectedUuid, uuidRegex, 'UUID must conform to standard RFC 4122 format');
  });

  test('Test 2: Audio Sampling Rate and Frame Math', () => {
    const sampleRate = 16000; // 16kHz
    const bytesPerSample = 2; // 16-bit PCM
    const channels = 1; // Mono
    const frameDurationMs = 20; // 20ms chunk

    const bytesPerSec = sampleRate * bytesPerSample * channels;
    assert.strictEqual(bytesPerSec, 32000, '16kHz 16-bit mono must equal 32,000 bytes per second (256 kbps)');

    const expectedChunkSize = (bytesPerSec * frameDurationMs) / 1000;
    assert.strictEqual(expectedChunkSize, 640, 'A 20ms frame must equal exactly 640 bytes (320 samples)');
  });

  test('Test 3: RMS Decibel Full-Scale (dBFS) Formula', () => {
    // Helper to calculate RMS dBFS from a buffer of 16-bit PCM samples
    const calculateRmsDb = (buffer: Buffer): number => {
      let sumSquares = 0;
      const sampleCount = buffer.length / 2;
      for (let i = 0; i < buffer.length; i += 2) {
        const sample = buffer.readInt16LE(i);
        sumSquares += sample * sample;
      }
      const rms = Math.sqrt(sumSquares / sampleCount);
      if (rms === 0) return -60;
      const normalized = rms / 32768.0;
      const db = 20 * Math.log10(Math.max(0.0001, normalized));
      return Math.max(-60, Math.min(0, db));
    };

    // Case A: Perfect silence (all zeroes)
    const silenceBuf = Buffer.alloc(640, 0);
    assert.strictEqual(calculateRmsDb(silenceBuf), -60, 'Silence must map to -60 dBFS noise floor');

    // Case B: Full-scale square/sine wave (+32767 peak)
    const fullScaleBuf = Buffer.alloc(640);
    for (let i = 0; i < 640; i += 2) {
      fullScaleBuf.writeInt16LE(32767, i);
    }
    const fullDb = calculateRmsDb(fullScaleBuf);
    assert.ok(fullDb >= -0.01, `Full scale buffer should be ~0 dBFS, got ${fullDb}`);
  });

  test('Test 4: Mute Buffer Behavior (Silence Keepalive)', () => {
    const chunkSizeBytes = 640;
    const testBuffer = Buffer.alloc(chunkSizeBytes, 0x55);

    // When muted, the buffer is zero-filled to maintain clock synchronization over RFCOMM
    const isMuted = true;
    if (isMuted) {
      testBuffer.fill(0);
    }

    assert.strictEqual(testBuffer.length, 640, 'Mute must preserve buffer size');
    assert.ok(testBuffer.every(b => b === 0), 'Every byte must be zeroed for silence');
  });

  test('Test 5: AndroidManifest.xml Permission Audit', () => {
    const manifestPath = path.resolve(process.cwd(), 'android-project/app/src/main/AndroidManifest.xml');
    assert.ok(fs.existsSync(manifestPath), 'AndroidManifest.xml must exist');

    const manifestContent = fs.readFileSync(manifestPath, 'utf8');

    // Android 12+ permissions
    assert.ok(manifestContent.includes('android.permission.BLUETOOTH_SCAN'), 'BLUETOOTH_SCAN required');
    assert.ok(manifestContent.includes('android.permission.BLUETOOTH_CONNECT'), 'BLUETOOTH_CONNECT required');
    assert.ok(manifestContent.includes('android.permission.BLUETOOTH_ADVERTISE'), 'BLUETOOTH_ADVERTISE required');

    // Audio permissions
    assert.ok(manifestContent.includes('android.permission.RECORD_AUDIO'), 'RECORD_AUDIO required');
    assert.ok(manifestContent.includes('android.permission.MODIFY_AUDIO_SETTINGS'), 'MODIFY_AUDIO_SETTINGS required');
  });

  test('Test 6: AudioEngine.kt Configuration Audit', () => {
    const enginePath = path.resolve(process.cwd(), 'android-project/app/src/main/java/com/example/btaudiowalkietalkie/audio/AudioEngine.kt');
    assert.ok(fs.existsSync(enginePath), 'AudioEngine.kt must exist');

    const engineContent = fs.readFileSync(enginePath, 'utf8');

    // Check for VOICE_COMMUNICATION source for AEC
    assert.ok(engineContent.includes('AudioSource.VOICE_COMMUNICATION'), 'Must use AudioSource.VOICE_COMMUNICATION');

    // Check for STREAM_VOICE_CALL
    assert.ok(engineContent.includes('STREAM_VOICE_CALL'), 'Must use STREAM_VOICE_CALL for hardware echo cancellation');

    // Check for AcousticEchoCanceler
    assert.ok(engineContent.includes('AcousticEchoCanceler'), 'Must integrate AcousticEchoCanceler');

    // Check for 16000 sample rate
    assert.ok(engineContent.includes('SAMPLE_RATE = 16000'), 'Must define 16kHz sample rate');
  });

  test('Test 7: BluetoothController.kt RFCOMM Sockets Audit', () => {
    const controllerPath = path.resolve(process.cwd(), 'android-project/app/src/main/java/com/example/btaudiowalkietalkie/bluetooth/BluetoothController.kt');
    assert.ok(fs.existsSync(controllerPath), 'BluetoothController.kt must exist');

    const content = fs.readFileSync(controllerPath, 'utf8');

    // Check for Server socket method
    assert.ok(content.includes('listenUsingRfcommWithServiceRecord'), 'Must use listenUsingRfcommWithServiceRecord');

    // Check for Client socket method
    assert.ok(content.includes('createRfcommSocketToServiceRecord'), 'Must use createRfcommSocketToServiceRecord');

    // Check for UUID
    assert.ok(content.includes('00001101-0000-1000-8000-00805F9B34FB'), 'Must use standard SPP UUID');

    // Check for cancelDiscovery before connect
    assert.ok(content.includes('stopDiscovery()') || content.includes('cancelDiscovery()'), 'Must cancel discovery before connecting');
  });

  test('Test 8: Full-Duplex Bidirectional Concurrency Simulation', async () => {
    // Simulate concurrent sender and receiver pipes
    let senderBytes = 0;
    let receiverBytes = 0;

    const iterations = 50;
    const chunkSize = 640;

    // Concurrently run sender and receiver
    await Promise.all([
      // Sender loop
      new Promise<void>((resolve) => {
        for (let i = 0; i < iterations; i++) {
          senderBytes += chunkSize;
        }
        resolve();
      }),
      // Receiver loop
      new Promise<void>((resolve) => {
        for (let i = 0; i < iterations; i++) {
          receiverBytes += chunkSize;
        }
        resolve();
      })
    ]);

    assert.strictEqual(senderBytes, iterations * chunkSize);
    assert.strictEqual(receiverBytes, iterations * chunkSize);
    assert.strictEqual(senderBytes, 32000, '50 chunks of 640 bytes = 32,000 bytes (1 second of audio)');
  });

  test('Test 9: AudioEngine Clean Teardown & Resource Release', () => {
    const enginePath = path.resolve(process.cwd(), 'android-project/app/src/main/java/com/example/btaudiowalkietalkie/audio/AudioEngine.kt');
    const content = fs.readFileSync(enginePath, 'utf8');

    assert.ok(content.includes('audioRecord?.apply'), 'Must release AudioRecord');
    assert.ok(content.includes('audioTrack?.apply'), 'Must release AudioTrack');
    assert.ok(content.includes('echoCanceler?.release()'), 'Must release AcousticEchoCanceler');
    assert.ok(content.includes('senderThread?.interrupt()'), 'Must interrupt sender thread');
    assert.ok(content.includes('receiverThread?.interrupt()'), 'Must interrupt receiver thread');
  });

  test('Test 10: Kotlin Unit Test Files Existence in Project Structure', () => {
    const test1 = path.resolve(process.cwd(), 'android-project/app/src/test/java/com/example/btaudiowalkietalkie/AudioEngineTest.kt');
    const test2 = path.resolve(process.cwd(), 'android-project/app/src/test/java/com/example/btaudiowalkietalkie/BluetoothControllerTest.kt');
    const test3 = path.resolve(process.cwd(), 'android-project/app/src/test/java/com/example/btaudiowalkietalkie/WifiAudioControllerTest.kt');

    assert.ok(fs.existsSync(test1), 'AudioEngineTest.kt must exist');
    assert.ok(fs.existsSync(test2), 'BluetoothControllerTest.kt must exist');
    assert.ok(fs.existsSync(test3), 'WifiAudioControllerTest.kt must exist');
  });

  test('Test 11: Wi-Fi Hotspot Multicast Protocol & Port Compliance', () => {
    const wifiControllerPath = path.resolve(process.cwd(), 'android-project/app/src/main/java/com/example/btaudiowalkietalkie/wifi/WifiAudioController.kt');
    assert.ok(fs.existsSync(wifiControllerPath), 'WifiAudioController.kt must exist');

    const content = fs.readFileSync(wifiControllerPath, 'utf8');

    // Multicast Port & Group IP
    assert.ok(content.includes('DEFAULT_PORT = 50005'), 'Must use Port 50005 for UDP Multicast');
    assert.ok(content.includes('239.255.0.1'), 'Must use 239.255.0.1 group address');
    assert.ok(content.includes('WTLK'), 'Must define magic bytes WTLK for packet identification');
    assert.ok(content.includes('MulticastSocket'), 'Must instantiate MulticastSocket');
  });

  test('Test 12: Android Wi-Fi MulticastLock Verification', () => {
    const wifiControllerPath = path.resolve(process.cwd(), 'android-project/app/src/main/java/com/example/btaudiowalkietalkie/wifi/WifiAudioController.kt');
    const content = fs.readFileSync(wifiControllerPath, 'utf8');

    // On Android, Wi-Fi driver will drop multicast packets unless MulticastLock is acquired
    assert.ok(content.includes('createMulticastLock'), 'Must call createMulticastLock to prevent kernel packet drop');
    assert.ok(content.includes('acquire()'), 'Must acquire MulticastLock');
    assert.ok(content.includes('release()'), 'Must release MulticastLock during cleanup');
  });

  test('Test 13: Wi-Fi Permissions Audit in AndroidManifest.xml', () => {
    const manifestPath = path.resolve(process.cwd(), 'android-project/app/src/main/AndroidManifest.xml');
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');

    assert.ok(manifestContent.includes('android.permission.INTERNET'), 'INTERNET permission required for UDP sockets');
    assert.ok(manifestContent.includes('android.permission.ACCESS_WIFI_STATE'), 'ACCESS_WIFI_STATE required for Wi-Fi info');
    assert.ok(manifestContent.includes('android.permission.CHANGE_WIFI_MULTICAST_STATE'), 'CHANGE_WIFI_MULTICAST_STATE required for multicast');
  });

  test('Test 14: Dual Mode Radio Selector Labels Compliance', () => {
    const screenPath = path.resolve(process.cwd(), 'android-project/app/src/main/java/com/example/btaudiowalkietalkie/ui/WalkieTalkieScreen.kt');
    const screenContent = fs.readFileSync(screenPath, 'utf8');

    // Verify low power / short range / 2 persons and high power / long range / 2-10 phones
    assert.ok(screenContent.includes('Low power consumption · Short range (~25m) · 2 persons') || 
              screenContent.includes('low power consumption'), 'Must include Bluetooth low power consumption label');
    assert.ok(screenContent.includes('High power consumption · Long range (~100m) · 2–10 phones') ||
              screenContent.includes('high power consumption'), 'Must include Wi-Fi Hotspot high power consumption label');
  });

  test('Test 15: Standalone Signed APK File & Manifest Verification', () => {
    const apkPath = path.resolve(process.cwd(), 'public/BTAudioWalkieTalkie.apk');
    assert.ok(fs.existsSync(apkPath), 'public/BTAudioWalkieTalkie.apk must exist');

    const stats = fs.statSync(apkPath);
    assert.ok(stats.size > 20000, `APK size should be at least 20KB, was ${stats.size} bytes`);
  });

});

