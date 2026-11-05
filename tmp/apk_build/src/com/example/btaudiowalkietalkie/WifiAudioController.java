package com.example.btaudiowalkietalkie;

import android.annotation.SuppressLint;
import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioRecord;
import android.media.AudioTrack;
import android.media.MediaRecorder;
import android.media.audiofx.AcousticEchoCanceler;
import android.media.audiofx.NoiseSuppressor;
import android.net.wifi.WifiManager;
import android.util.Log;

import java.net.DatagramPacket;
import java.net.InetAddress;
import java.net.MulticastSocket;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

public class WifiAudioController {
    private static final String TAG = "WifiAudioController";

    public static final int DEFAULT_PORT = 50005;
    public static final String MULTICAST_IP = "239.255.0.1";
    public static final int SAMPLE_RATE = 16000;
    public static final int CHUNK_SIZE = 640;

    public static final byte[] MAGIC = new byte[]{'W', 'T', 'L', 'K'};
    public static final byte TYPE_AUDIO = 0x01;
    public static final byte TYPE_HEARTBEAT = 0x02;

    public interface Listener {
        void onChannelStarted(int channel);
        void onPeerListUpdated(List<String> peers);
        void onSpeakerChanged(String speakerName);
        void onChannelStopped();
        void onError(String message);
    }

    private final Context context;
    private final Listener listener;
    private final String deviceName;
    private final long deviceId = UUID.randomUUID().getMostSignificantBits();

    private final AtomicBoolean isRunning = new AtomicBoolean(false);
    private final AtomicBoolean isMuted = new AtomicBoolean(false);

    private WifiManager.MulticastLock multicastLock;
    private MulticastSocket socket;
    private InetAddress groupAddress;

    private AudioRecord audioRecord;
    private AudioTrack audioTrack;
    private AcousticEchoCanceler echoCanceler;
    private NoiseSuppressor noiseSuppressor;

    private Thread senderThread;
    private Thread receiverThread;
    private Thread heartbeatThread;

    private final ConcurrentHashMap<Long, String> peerNames = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<Long, Long> peerTimestamps = new ConcurrentHashMap<>();

    public WifiAudioController(Context context, String deviceName, Listener listener) {
        this.context = context;
        this.deviceName = deviceName;
        this.listener = listener;
    }

    @SuppressLint("MissingPermission")
    public void start(final int channel) {
        if (isRunning.getAndSet(true)) return;

        try {
            WifiManager wifiManager = (WifiManager) context.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wifiManager != null) {
                multicastLock = wifiManager.createMulticastLock("WalkieTalkieWifiLock");
                multicastLock.setReferenceCounted(true);
                multicastLock.acquire();
            }

            groupAddress = InetAddress.getByName(MULTICAST_IP);
            socket = new MulticastSocket(DEFAULT_PORT);
            socket.setReuseAddress(true);
            socket.setTimeToLive(4);
            socket.setBroadcast(true);
            try {
                socket.joinGroup(groupAddress);
            } catch (Exception ignored) {}

            int minRecordBuf = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
            audioRecord = new AudioRecord(
                    MediaRecorder.AudioSource.VOICE_COMMUNICATION,
                    SAMPLE_RATE,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT,
                    Math.max(minRecordBuf * 2, 2048)
            );

            int sessionId = audioRecord.getAudioSessionId();
            if (AcousticEchoCanceler.isAvailable()) {
                echoCanceler = AcousticEchoCanceler.create(sessionId);
                if (echoCanceler != null) echoCanceler.setEnabled(true);
            }
            if (NoiseSuppressor.isAvailable()) {
                noiseSuppressor = NoiseSuppressor.create(sessionId);
                if (noiseSuppressor != null) noiseSuppressor.setEnabled(true);
            }

            int minTrackBuf = AudioTrack.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT);
            AudioAttributes attrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .setLegacyStreamType(AudioManager.STREAM_VOICE_CALL)
                    .build();

            AudioFormat format = new AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(SAMPLE_RATE)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build();

            audioTrack = new AudioTrack(attrs, format, Math.max(minTrackBuf * 2, 2048), AudioTrack.MODE_STREAM, AudioManager.AUDIO_SESSION_ID_GENERATE);
            audioTrack.play();
            audioRecord.startRecording();

            if (listener != null) listener.onChannelStarted(channel);

            // Sender Thread
            senderThread = new Thread(new Runnable() {
                @Override
                public void run() {
                    byte[] pcm = new byte[CHUNK_SIZE];
                    byte[] packetData = new byte[14 + CHUNK_SIZE];
                    System.arraycopy(MAGIC, 0, packetData, 0, 4);
                    packetData[4] = TYPE_AUDIO;
                    packetData[5] = (byte) channel;
                    ByteBuffer.wrap(packetData, 6, 8).putLong(deviceId);

                    while (isRunning.get()) {
                        try {
                            if (audioRecord == null) break;
                            int read = audioRecord.read(pcm, 0, CHUNK_SIZE);
                            if (read > 0) {
                                if (isMuted.get()) {
                                    Arrays.fill(pcm, (byte) 0);
                                }
                                System.arraycopy(pcm, 0, packetData, 14, read);
                                DatagramPacket packet = new DatagramPacket(packetData, 14 + read, groupAddress, DEFAULT_PORT);
                                if (socket != null) socket.send(packet);
                            }
                        } catch (Exception e) {
                            break;
                        }
                    }
                }
            }, "WifiSender");

            // Receiver Thread
            receiverThread = new Thread(new Runnable() {
                @Override
                public void run() {
                    byte[] buf = new byte[1500];
                    DatagramPacket packet = new DatagramPacket(buf, buf.length);

                    while (isRunning.get()) {
                        try {
                            if (socket == null) break;
                            socket.receive(packet);
                            int len = packet.getLength();
                            if (len < 14) continue;

                            if (buf[0] != MAGIC[0] || buf[1] != MAGIC[1] || buf[2] != MAGIC[2] || buf[3] != MAGIC[3]) {
                                continue;
                            }

                            byte type = buf[4];
                            long senderId = ByteBuffer.wrap(buf, 6, 8).getLong();
                            if (senderId == deviceId) continue; // Loopback filter

                            if (type == TYPE_AUDIO) {
                                int audioLen = len - 14;
                                if (audioLen > 0 && audioTrack != null) {
                                    audioTrack.write(buf, 14, audioLen);
                                    String speaker = peerNames.get(senderId);
                                    if (speaker != null && listener != null) {
                                        listener.onSpeakerChanged(speaker);
                                    }
                                }
                            } else if (type == TYPE_HEARTBEAT) {
                                int nameLen = len - 14;
                                String name = nameLen > 0 ? new String(buf, 14, nameLen) : "Peer";
                                peerNames.put(senderId, name);
                                peerTimestamps.put(senderId, System.currentTimeMillis());
                            }
                        } catch (Exception e) {
                            break;
                        }
                    }
                }
            }, "WifiReceiver");

            // Heartbeat loop
            heartbeatThread = new Thread(new Runnable() {
                @Override
                public void run() {
                    byte[] nameBytes = deviceName.getBytes();
                    byte[] hbData = new byte[14 + nameBytes.length];
                    System.arraycopy(MAGIC, 0, hbData, 0, 4);
                    hbData[4] = TYPE_HEARTBEAT;
                    hbData[5] = (byte) channel;
                    ByteBuffer.wrap(hbData, 6, 8).putLong(deviceId);
                    System.arraycopy(nameBytes, 0, hbData, 14, nameBytes.length);

                    while (isRunning.get()) {
                        try {
                            DatagramPacket hbPacket = new DatagramPacket(hbData, hbData.length, groupAddress, DEFAULT_PORT);
                            if (socket != null) socket.send(hbPacket);

                            long now = System.currentTimeMillis();
                            for (Long id : peerTimestamps.keySet()) {
                                Long t = peerTimestamps.get(id);
                                if (t != null && now - t > 6000) {
                                    peerTimestamps.remove(id);
                                    peerNames.remove(id);
                                }
                            }

                            if (listener != null) {
                                listener.onPeerListUpdated(new ArrayList<>(peerNames.values()));
                            }

                            Thread.sleep(2000);
                        } catch (Exception ignored) {}
                    }
                }
            }, "WifiHeartbeat");

            senderThread.start();
            receiverThread.start();
            heartbeatThread.start();

        } catch (Exception e) {
            Log.e(TAG, "Wi-Fi audio init failed", e);
            stop();
            if (listener != null) listener.onError("Wi-Fi init failed: " + e.getMessage());
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

        try { if (socket != null) socket.close(); } catch (Exception ignored) {}
        socket = null;

        try {
            if (audioRecord != null) {
                if (audioRecord.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) audioRecord.stop();
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

        try { if (echoCanceler != null) echoCanceler.release(); } catch (Exception ignored) {}
        echoCanceler = null;

        try { if (noiseSuppressor != null) noiseSuppressor.release(); } catch (Exception ignored) {}
        noiseSuppressor = null;

        try {
            if (multicastLock != null && multicastLock.isHeld()) multicastLock.release();
        } catch (Exception ignored) {}
        multicastLock = null;

        if (senderThread != null) senderThread.interrupt();
        if (receiverThread != null) receiverThread.interrupt();
        if (heartbeatThread != null) heartbeatThread.interrupt();

        senderThread = null;
        receiverThread = null;
        heartbeatThread = null;
        peerNames.clear();
        peerTimestamps.clear();

        if (listener != null) listener.onChannelStopped();
    }
}
