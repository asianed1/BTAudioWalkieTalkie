package com.example.btaudiowalkietalkie;

import android.annotation.SuppressLint;
import android.bluetooth.BluetoothSocket;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioRecord;
import android.media.AudioTrack;
import android.media.MediaRecorder;
import android.media.audiofx.AcousticEchoCanceler;
import android.media.audiofx.NoiseSuppressor;
import android.util.Log;

import java.io.InputStream;
import java.io.OutputStream;
import java.util.Arrays;
import java.util.concurrent.atomic.AtomicBoolean;

public class AudioEngine {
    private static final String TAG = "AudioEngine";

    public static final int SAMPLE_RATE = 16000;
    public static final int CHANNEL_IN = AudioFormat.CHANNEL_IN_MONO;
    public static final int CHANNEL_OUT = AudioFormat.CHANNEL_OUT_MONO;
    public static final int ENCODING = AudioFormat.ENCODING_PCM_16BIT;
    public static final int CHUNK_SIZE = 640; // 20ms frame at 16kHz 16-bit mono

    public interface ErrorListener {
        void onConnectionDropped(String reason);
    }

    private final BluetoothSocket socket;
    private final ErrorListener errorListener;

    private final AtomicBoolean isRunning = new AtomicBoolean(false);
    private final AtomicBoolean isMuted = new AtomicBoolean(false);

    private AudioRecord audioRecord;
    private AudioTrack audioTrack;
    private AcousticEchoCanceler echoCanceler;
    private NoiseSuppressor noiseSuppressor;

    private Thread senderThread;
    private Thread receiverThread;

    public AudioEngine(BluetoothSocket socket, ErrorListener listener) {
        this.socket = socket;
        this.errorListener = listener;
    }

    @SuppressLint("MissingPermission")
    public void start() {
        if (isRunning.getAndSet(true)) return;

        try {
            int minRecordBuf = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_IN, ENCODING);
            int recordBufSize = Math.max(minRecordBuf * 2, 2048);

            // Configure AudioRecord with VOICE_COMMUNICATION for hardware AEC coupling
            audioRecord = new AudioRecord(
                    MediaRecorder.AudioSource.VOICE_COMMUNICATION,
                    SAMPLE_RATE,
                    CHANNEL_IN,
                    ENCODING,
                    recordBufSize
            );

            if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                throw new IllegalStateException("AudioRecord initialization failed");
            }

            int sessionId = audioRecord.getAudioSessionId();

            // Enable hardware AcousticEchoCanceler
            if (AcousticEchoCanceler.isAvailable()) {
                echoCanceler = AcousticEchoCanceler.create(sessionId);
                if (echoCanceler != null) {
                    echoCanceler.setEnabled(true);
                    Log.i(TAG, "AcousticEchoCanceler enabled on session " + sessionId);
                }
            }

            // Enable NoiseSuppressor if present
            if (NoiseSuppressor.isAvailable()) {
                noiseSuppressor = NoiseSuppressor.create(sessionId);
                if (noiseSuppressor != null) {
                    noiseSuppressor.setEnabled(true);
                }
            }

            // Configure AudioTrack on STREAM_VOICE_CALL
            int minTrackBuf = AudioTrack.getMinBufferSize(SAMPLE_RATE, CHANNEL_OUT, ENCODING);
            int trackBufSize = Math.max(minTrackBuf * 2, 2048);

            AudioAttributes attrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .setLegacyStreamType(AudioManager.STREAM_VOICE_CALL)
                    .build();

            AudioFormat format = new AudioFormat.Builder()
                    .setEncoding(ENCODING)
                    .setSampleRate(SAMPLE_RATE)
                    .setChannelMask(CHANNEL_OUT)
                    .build();

            audioTrack = new AudioTrack(
                    attrs,
                    format,
                    trackBufSize,
                    AudioTrack.MODE_STREAM,
                    AudioManager.AUDIO_SESSION_ID_GENERATE
            );

            audioTrack.play();
            audioRecord.startRecording();

            final OutputStream outputStream = socket.getOutputStream();
            final InputStream inputStream = socket.getInputStream();

            // Sender Thread
            senderThread = new Thread(new Runnable() {
                @Override
                public void run() {
                    byte[] pcmBuffer = new byte[CHUNK_SIZE];
                    while (isRunning.get()) {
                        try {
                            if (audioRecord == null) break;
                            int read = audioRecord.read(pcmBuffer, 0, CHUNK_SIZE);
                            if (read > 0) {
                                if (isMuted.get()) {
                                    Arrays.fill(pcmBuffer, (byte) 0);
                                }
                                outputStream.write(pcmBuffer, 0, read);
                                outputStream.flush();
                            }
                        } catch (Exception e) {
                            if (isRunning.get()) {
                                stop();
                                if (errorListener != null) {
                                    errorListener.onConnectionDropped("Bluetooth sending stream broken");
                                }
                            }
                            break;
                        }
                    }
                }
            }, "SenderThread");

            // Receiver Thread
            receiverThread = new Thread(new Runnable() {
                @Override
                public void run() {
                    byte[] pcmBuffer = new byte[CHUNK_SIZE];
                    while (isRunning.get()) {
                        try {
                            int read = inputStream.read(pcmBuffer, 0, CHUNK_SIZE);
                            if (read == -1) {
                                if (isRunning.get()) {
                                    stop();
                                    if (errorListener != null) {
                                        errorListener.onConnectionDropped("Peer disconnected");
                                    }
                                }
                                break;
                            }
                            if (read > 0 && audioTrack != null) {
                                audioTrack.write(pcmBuffer, 0, read);
                            }
                        } catch (Exception e) {
                            if (isRunning.get()) {
                                stop();
                                if (errorListener != null) {
                                    errorListener.onConnectionDropped("Bluetooth receiving stream broken");
                                }
                            }
                            break;
                        }
                    }
                }
            }, "ReceiverThread");

            senderThread.start();
            receiverThread.start();
            Log.i(TAG, "Full-duplex AudioEngine started successfully");

        } catch (Exception e) {
            Log.e(TAG, "AudioEngine error", e);
            stop();
            if (errorListener != null) {
                errorListener.onConnectionDropped("Audio init failed: " + e.getMessage());
            }
        }
    }

    public void setMuted(boolean muted) {
        isMuted.set(muted);
    }

    public boolean isMuted() {
        return isMuted.get();
    }

    public void stop() {
        if (!isRunning.getAndSet(false)) return;

        try {
            if (audioRecord != null) {
                if (audioRecord.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) {
                    audioRecord.stop();
                }
                audioRecord.release();
            }
        } catch (Exception ignored) {}
        audioRecord = null;

        try {
            if (audioTrack != null) {
                if (audioTrack.getPlayState() == AudioTrack.PLAYSTATE_PLAYING) {
                    audioTrack.stop();
                    audioTrack.flush();
                }
                audioTrack.release();
            }
        } catch (Exception ignored) {}
        audioTrack = null;

        try {
            if (echoCanceler != null) echoCanceler.release();
        } catch (Exception ignored) {}
        echoCanceler = null;

        try {
            if (noiseSuppressor != null) noiseSuppressor.release();
        } catch (Exception ignored) {}
        noiseSuppressor = null;

        if (senderThread != null) {
            senderThread.interrupt();
            senderThread = null;
        }
        if (receiverThread != null) {
            receiverThread.interrupt();
            receiverThread = null;
        }
    }
}
