package com.example.btaudiowalkietalkie.wifi

import android.annotation.SuppressLint
import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.media.audiofx.AcousticEchoCanceler
import android.media.audiofx.NoiseSuppressor
import android.net.wifi.WifiManager
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.io.IOException
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.MulticastSocket
import java.nio.ByteBuffer
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

data class WifiChannelState(
    val isActive: Boolean = false,
    val channelNumber: Int = 1,
    val isTransmitting: Boolean = false,
    val isReceiving: Boolean = false,
    val isMuted: Boolean = false,
    val activeSpeaker: String? = null,
    val onlinePeerCount: Int = 1,
    val onlinePeers: List<String> = emptyList(),
    val outgoingDb: Float = -60f,
    val incomingDb: Float = -60f,
    val packetsSent: Long = 0L,
    val packetsReceived: Long = 0L
)

/**
 * Handles group walkie-talkie communication over local Wi-Fi Hotspot or local Wi-Fi LAN
 * using high-speed UDP Broadcast / Multicast datagram packets.
 */
class WifiAudioController(
    private val context: Context,
    private val scope: CoroutineScope,
    private val deviceName: String = "Android Device"
) {
    companion object {
        private const val TAG = "WifiAudioController"
        const val DEFAULT_PORT = 50005
        const val MULTICAST_IP = "239.255.0.1"
        const val SAMPLE_RATE = 16000
        const val CHUNK_SIZE = 640 // 20ms at 16kHz 16-bit mono

        // Protocol Magic: "WTLK" (WalkieTalkie)
        val MAGIC_BYTES = byteArrayOf('W'.code.toByte(), 'T'.code.toByte(), 'L'.code.toByte(), 'K'.code.toByte())
        const val TYPE_AUDIO = 0x01.toByte()
        const val TYPE_HEARTBEAT = 0x02.toByte()
    }

    private val deviceId = UUID.randomUUID().mostSignificantBits

    private val _channelState = MutableStateFlow(WifiChannelState())
    val channelState: StateFlow<WifiChannelState> = _channelState.asStateFlow()

    private val isRunning = AtomicBoolean(false)
    val isMuted = AtomicBoolean(false)

    private var multicastLock: WifiManager.MulticastLock? = null
    private var socket: DatagramSocket? = null
    private var groupAddress: InetAddress? = null

    private var audioRecord: AudioRecord? = null
    private var audioTrack: AudioTrack? = null
    private var echoCanceler: AcousticEchoCanceler? = null
    private var noiseSuppressor: NoiseSuppressor? = null

    private var senderThread: Thread? = null
    private var receiverThread: Thread? = null
    private var heartbeatJob: Job? = null

    private val activePeersMap = ConcurrentHashMap<Long, Pair<String, Long>>()
    private var packetsSentCount = 0L
    private var packetsReceivedCount = 0L

    /**
     * Joins or starts the Wi-Fi Hotspot group channel.
     */
    @SuppressLint("MissingPermission")
    fun startChannel(channelNumber: Int = 1) {
        if (isRunning.get()) return
        isRunning.set(true)

        try {
            // 1. Acquire Android MulticastLock (critical for receiving UDP multicast packets)
            val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
            multicastLock = wifiManager?.createMulticastLock("BTAudioWalkieTalkieMulticast")?.apply {
                setReferenceCounted(true)
                acquire()
            }

            // 2. Setup UDP Socket bound to port 50005
            groupAddress = InetAddress.getByName(MULTICAST_IP)
            val multicastSocket = MulticastSocket(DEFAULT_PORT).apply {
                reuseAddress = true
                timeToLive = 4
                broadcast = true
                try {
                    joinGroup(groupAddress)
                } catch (e: Exception) {
                    Log.w(TAG, "Multicast joinGroup fallback to broadcast: ${e.message}")
                }
            }
            socket = multicastSocket

            // 3. Setup Hardware AudioRecord (VOICE_COMMUNICATION + Echo Cancellation)
            val minRecordBuf = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.VOICE_COMMUNICATION,
                SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                Math.max(minRecordBuf * 2, 2048)
            )

            if (AcousticEchoCanceler.isAvailable()) {
                echoCanceler = AcousticEchoCanceler.create(audioRecord!!.audioSessionId)?.apply {
                    enabled = true
                }
            }
            if (NoiseSuppressor.isAvailable()) {
                noiseSuppressor = NoiseSuppressor.create(audioRecord!!.audioSessionId)?.apply {
                    enabled = true
                }
            }

            // 4. Setup AudioTrack on STREAM_VOICE_CALL
            val minTrackBuf = AudioTrack.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT)
            val audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .setLegacyStreamType(AudioManager.STREAM_VOICE_CALL)
                .build()

            val audioFormat = AudioFormat.Builder()
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setSampleRate(SAMPLE_RATE)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                .build()

            audioTrack = AudioTrack(
                audioAttributes,
                audioFormat,
                Math.max(minTrackBuf * 2, 2048),
                AudioTrack.MODE_STREAM,
                AudioManager.AUDIO_SESSION_ID_GENERATE
            )

            audioTrack?.play()
            audioRecord?.startRecording()

            _channelState.value = _channelState.value.copy(
                isActive = true,
                channelNumber = channelNumber
            )

            // 5. Start Sender, Receiver, and Heartbeat worker loops
            startSenderLoop(channelNumber)
            startReceiverLoop()
            startHeartbeatLoop(channelNumber)

            Log.i(TAG, "Wi-Fi Hotspot Walkie-Talkie Channel $channelNumber started on port $DEFAULT_PORT")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start Wi-Fi Walkie-Talkie channel", e)
            stopChannel()
        }
    }

    private fun startSenderLoop(channelNumber: Int) {
        senderThread = Thread({
            val pcmBuffer = ByteArray(CHUNK_SIZE)
            // Packet layout: 4B Magic + 1B Type + 1B Channel + 8B DeviceID + 640B Audio Payload
            val packetData = ByteArray(14 + CHUNK_SIZE)
            System.arraycopy(MAGIC_BYTES, 0, packetData, 0, 4)
            packetData[4] = TYPE_AUDIO
            packetData[5] = channelNumber.toByte()

            // Put device ID in header
            val bb = ByteBuffer.wrap(packetData, 6, 8)
            bb.putLong(deviceId)

            while (isRunning.get()) {
                try {
                    val record = audioRecord ?: break
                    val read = record.read(pcmBuffer, 0, CHUNK_SIZE)

                    if (read > 0) {
                        if (isMuted.get()) {
                            pcmBuffer.fill(0)
                        }

                        System.arraycopy(pcmBuffer, 0, packetData, 14, read)
                        val targetAddr = groupAddress ?: InetAddress.getByName("255.255.255.255")
                        val datagram = DatagramPacket(packetData, 14 + read, targetAddr, DEFAULT_PORT)
                        socket?.send(datagram)

                        packetsSentCount++
                        val rms = calculateRmsDb(pcmBuffer, read)

                        _channelState.value = _channelState.value.copy(
                            isTransmitting = !isMuted.get(),
                            outgoingDb = if (isMuted.get()) -60f else rms,
                            packetsSent = packetsSentCount,
                            isMuted = isMuted.get()
                        )
                    }
                } catch (e: Exception) {
                    if (isRunning.get()) {
                        Log.e(TAG, "Wi-Fi Sender loop error", e)
                    }
                    break
                }
            }
        }, "WifiWalkieTalkie-Sender").apply {
            priority = Thread.MAX_PRIORITY
            start()
        }
    }

    private fun startReceiverLoop() {
        receiverThread = Thread({
            val recvBuffer = ByteArray(1500)
            val packet = DatagramPacket(recvBuffer, recvBuffer.size)

            while (isRunning.get()) {
                try {
                    val s = socket ?: break
                    s.receive(packet)

                    val len = packet.length
                    if (len < 14) continue

                    // Validate Magic Bytes
                    if (recvBuffer[0] != MAGIC_BYTES[0] || recvBuffer[1] != MAGIC_BYTES[1] ||
                        recvBuffer[2] != MAGIC_BYTES[2] || recvBuffer[3] != MAGIC_BYTES[3]) {
                        continue
                    }

                    val type = recvBuffer[4]
                    val senderId = ByteBuffer.wrap(recvBuffer, 6, 8).long

                    // Discard our own broadcast packets (prevent local echo)
                    if (senderId == deviceId) {
                        continue
                    }

                    if (type == TYPE_AUDIO) {
                        val audioPayloadLen = len - 14
                        if (audioPayloadLen > 0 && audioTrack != null) {
                            audioTrack?.write(recvBuffer, 14, audioPayloadLen)
                            packetsReceivedCount++

                            val rms = calculateRmsDb(recvBuffer, 14, audioPayloadLen)
                            val peerName = activePeersMap[senderId]?.first ?: "Peer Device"

                            _channelState.value = _channelState.value.copy(
                                isReceiving = true,
                                activeSpeaker = peerName,
                                incomingDb = rms,
                                packetsReceived = packetsReceivedCount
                            )
                        }
                    } else if (type == TYPE_HEARTBEAT) {
                        // Extract Peer Display Name from heartbeat payload
                        val nameLen = (len - 14).coerceAtLeast(0)
                        val nameStr = if (nameLen > 0) String(recvBuffer, 14, nameLen) else "Peer (${packet.address.hostAddress})"
                        activePeersMap[senderId] = Pair(nameStr, System.currentTimeMillis())
                    }
                } catch (e: Exception) {
                    if (isRunning.get()) {
                        Log.e(TAG, "Wi-Fi Receiver loop error", e)
                    }
                    break
                }
            }
        }, "WifiWalkieTalkie-Receiver").apply {
            priority = Thread.MAX_PRIORITY
            start()
        }
    }

    private fun startHeartbeatLoop(channelNumber: Int) {
        heartbeatJob = scope.launch(Dispatchers.IO) {
            val nameBytes = deviceName.toByteArray()
            val hbData = ByteArray(14 + nameBytes.size)
            System.arraycopy(MAGIC_BYTES, 0, hbData, 0, 4)
            hbData[4] = TYPE_HEARTBEAT
            hbData[5] = channelNumber.toByte()
            ByteBuffer.wrap(hbData, 6, 8).putLong(deviceId)
            System.arraycopy(nameBytes, 0, hbData, 14, nameBytes.size)

            val packet = DatagramPacket(hbData, hbData.size, groupAddress ?: InetAddress.getByName("255.255.255.255"), DEFAULT_PORT)

            while (isActive && isRunning.get()) {
                try {
                    socket?.send(packet)

                    // Prune inactive peers (older than 5 seconds)
                    val now = System.currentTimeMillis()
                    activePeersMap.entries.removeIf { now - it.value.second > 5000 }

                    val peersList = activePeersMap.values.map { it.first }
                    _channelState.value = _channelState.value.copy(
                        onlinePeerCount = peersList.size + 1, // Peers + Self
                        onlinePeers = peersList
                    )
                } catch (e: Exception) {
                    Log.w(TAG, "Heartbeat error: ${e.message}")
                }
                delay(2000)
            }
        }
    }

    fun setMuted(muted: Boolean) {
        isMuted.set(muted)
        _channelState.value = _channelState.value.copy(isMuted = muted)
    }

    private fun calculateRmsDb(buffer: ByteArray, bytesRead: Int): Float {
        return calculateRmsDb(buffer, 0, bytesRead)
    }

    private fun calculateRmsDb(buffer: ByteArray, offset: Int, length: Int): Float {
        var sumSquares = 0.0
        val sampleCount = length / 2
        if (sampleCount <= 0) return -60f

        var i = offset
        val end = offset + length - 1
        while (i < end) {
            val low = buffer[i].toInt() and 0xFF
            val high = buffer[i + 1].toInt()
            val sample = (high shl 8) or low
            sumSquares += (sample * sample)
            i += 2
        }

        val rms = Math.sqrt(sumSquares / sampleCount)
        if (rms <= 0.0) return -60f
        val normalized = rms / 32768.0
        val db = 20 * Math.log10(normalized.coerceAtLeast(0.0001))
        return db.toFloat().coerceIn(-60f, 0f)
    }

    fun stopChannel() {
        if (!isRunning.getAndSet(false)) return

        heartbeatJob?.cancel()
        heartbeatJob = null

        try { socket?.close() } catch (e: Exception) {}
        socket = null

        try {
            audioRecord?.apply {
                if (recordingState == AudioRecord.RECORDSTATE_RECORDING) stop()
                release()
            }
        } catch (e: Exception) {}
        audioRecord = null

        try {
            audioTrack?.apply {
                if (playState == AudioTrack.PLAYSTATE_PLAYING) {
                    stop()
                    flush()
                }
                release()
            }
        } catch (e: Exception) {}
        audioTrack = null

        try { echoCanceler?.release() } catch (e: Exception) {}
        echoCanceler = null

        try { noiseSuppressor?.release() } catch (e: Exception) {}
        noiseSuppressor = null

        try {
            if (multicastLock?.isHeld == true) {
                multicastLock?.release()
            }
        } catch (e: Exception) {}
        multicastLock = null

        senderThread?.interrupt()
        receiverThread?.interrupt()
        senderThread = null
        receiverThread = null

        _channelState.value = WifiChannelState()
        activePeersMap.clear()
        Log.i(TAG, "Wi-Fi Walkie-Talkie channel stopped")
    }
}
