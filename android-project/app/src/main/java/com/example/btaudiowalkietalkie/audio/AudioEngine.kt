package com.example.btaudiowalkietalkie.audio

import android.annotation.SuppressLint
import android.bluetooth.BluetoothSocket
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.media.audiofx.AcousticEchoCanceler
import android.media.audiofx.AutomaticGainControl
import android.media.audiofx.NoiseSuppressor
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.io.InputStream
import java.io.OutputStream
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.sqrt

/**
 * Audio streaming telemetry state for UI visualization.
 */
data class AudioMetrics(
    val isTransmitting: Boolean = false,
    val isReceiving: Boolean = false,
    val outgoingRmsDb: Float = -60f,
    val incomingRmsDb: Float = -60f,
    val isMuted: Boolean = false,
    val isEchoCancelerActive: Boolean = false,
    val isNoiseSuppressorActive: Boolean = false,
    val bytesSent: Long = 0L,
    val bytesReceived: Long = 0L
)

/**
 * Full-duplex audio engine for peer-to-peer walkie-talkie communication.
 * Runs two concurrent background worker threads:
 * 1. Sender Thread: AudioRecord (16kHz, 16-bit PCM, VOICE_COMMUNICATION) -> BluetoothSocket.outputStream
 * 2. Receiver Thread: BluetoothSocket.inputStream -> AudioTrack (STREAM_VOICE_CALL, MODE_STREAM)
 */
class AudioEngine(
    private val socket: BluetoothSocket,
    private val onConnectionDropped: (String) -> Unit
) {
    companion object {
        private const val TAG = "AudioEngine"

        // Audio format constants
        const val SAMPLE_RATE = 16000 // 16kHz standard wideband telephony (G.722 / HD Voice spec)
        const val CHANNEL_CONFIG_IN = AudioFormat.CHANNEL_IN_MONO
        const val CHANNEL_CONFIG_OUT = AudioFormat.CHANNEL_OUT_MONO
        const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT
    }

    private val isRunning = AtomicBoolean(false)
    val isMuted = AtomicBoolean(false)

    private var senderThread: Thread? = null
    private var receiverThread: Thread? = null

    private var audioRecord: AudioRecord? = null
    private var audioTrack: AudioTrack? = null

    // Audio effects
    private var echoCanceler: AcousticEchoCanceler? = null
    private var noiseSuppressor: NoiseSuppressor? = null
    private var gainControl: AutomaticGainControl? = null

    private val _metrics = MutableStateFlow(AudioMetrics())
    val metrics: StateFlow<AudioMetrics> = _metrics.asStateFlow()

    private var totalBytesSent = 0L
    private var totalBytesReceived = 0L

    /**
     * Initializes hardware audio pipelines and starts concurrent sender/receiver threads.
     */
    @SuppressLint("MissingPermission")
    fun startEngine() {
        if (isRunning.get()) {
            Log.w(TAG, "AudioEngine is already running")
            return
        }

        isRunning.set(true)

        val minRecordBufferSize = AudioRecord.getMinBufferSize(
            SAMPLE_RATE,
            CHANNEL_CONFIG_IN,
            AUDIO_FORMAT
        ).coerceAtLeast(1024)

        val minTrackBufferSize = AudioTrack.getMinBufferSize(
            SAMPLE_RATE,
            CHANNEL_CONFIG_OUT,
            AUDIO_FORMAT
        ).coerceAtLeast(1024)

        // Use 2x min buffer size to prevent underflow/overflow jitter
        val recordBufferSize = minRecordBufferSize * 2
        val trackBufferSize = minTrackBufferSize * 2

        try {
            // 1. Configure AudioRecord with VOICE_COMMUNICATION for optimal AEC tuning
            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.VOICE_COMMUNICATION,
                SAMPLE_RATE,
                CHANNEL_CONFIG_IN,
                AUDIO_FORMAT,
                recordBufferSize
            )

            // Verify AudioRecord state
            if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                throw IllegalStateException("AudioRecord initialization failed")
            }

            val audioSessionId = audioRecord!!.audioSessionId

            // 2. Attach AcousticEchoCanceler (AEC) if supported by hardware
            var aecEnabled = false
            if (AcousticEchoCanceler.isAvailable()) {
                echoCanceler = AcousticEchoCanceler.create(audioSessionId)?.apply {
                    enabled = true
                    aecEnabled = enabled
                    Log.i(TAG, "AcousticEchoCanceler initialized and enabled: $aecEnabled")
                }
            } else {
                Log.w(TAG, "AcousticEchoCanceler is NOT supported on this device hardware")
            }

            // 3. Attach NoiseSuppressor if available
            var nsEnabled = false
            if (NoiseSuppressor.isAvailable()) {
                noiseSuppressor = NoiseSuppressor.create(audioSessionId)?.apply {
                    enabled = true
                    nsEnabled = enabled
                    Log.i(TAG, "NoiseSuppressor initialized and enabled: $nsEnabled")
                }
            }

            // 4. Attach AutomaticGainControl if available
            if (AutomaticGainControl.isAvailable()) {
                gainControl = AutomaticGainControl.create(audioSessionId)?.apply {
                    enabled = true
                }
            }

            // 5. Configure AudioTrack using STREAM_VOICE_CALL for hardware echo canceler synchronization
            val audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .setLegacyStreamType(AudioManager.STREAM_VOICE_CALL)
                .build()

            val audioFormat = AudioFormat.Builder()
                .setEncoding(AUDIO_FORMAT)
                .setSampleRate(SAMPLE_RATE)
                .setChannelMask(CHANNEL_CONFIG_OUT)
                .build()

            audioTrack = AudioTrack(
                audioAttributes,
                audioFormat,
                trackBufferSize,
                AudioTrack.MODE_STREAM,
                AudioManager.AUDIO_SESSION_ID_GENERATE
            )

            if (audioTrack?.state != AudioTrack.STATE_INITIALIZED) {
                throw IllegalStateException("AudioTrack initialization failed")
            }

            // Start playback & recording
            audioTrack?.play()
            audioRecord?.startRecording()

            _metrics.value = _metrics.value.copy(
                isEchoCancelerActive = aecEnabled,
                isNoiseSuppressorActive = nsEnabled
            )

            val outputStream = socket.outputStream
            val inputStream = socket.inputStream

            // Launch concurrent Sender Thread
            startSenderThread(outputStream, recordBufferSize)

            // Launch concurrent Receiver Thread
            startReceiverThread(inputStream, trackBufferSize)

            Log.i(TAG, "Full-duplex AudioEngine successfully started")
        } catch (e: Exception) {
            Log.e(TAG, "Fatal error starting AudioEngine", e)
            stopEngine()
            onConnectionDropped("Audio initialization failed: ${e.localizedMessage}")
        }
    }

    /**
     * SENDER THREAD:
     * Reads PCM audio continuously from microphone AudioRecord and writes bytes to Bluetooth output stream.
     */
    private fun startSenderThread(outputStream: OutputStream, bufferSize: Int) {
        senderThread = Thread({
            // Process chunks of 640 bytes (320 16-bit samples = 20ms of audio at 16kHz)
            val chunkSizeBytes = 640
            val pcmBuffer = ByteArray(chunkSizeBytes)

            Log.d(TAG, "Sender thread started")

            while (isRunning.get()) {
                try {
                    val record = audioRecord ?: break
                    if (record.recordingState != AudioRecord.RECORDSTATE_RECORDING) break

                    val bytesRead = record.read(pcmBuffer, 0, chunkSizeBytes)

                    if (bytesRead > 0) {
                        // If muted, transmit silence (zeroed buffer) to maintain timing & keep socket alive
                        if (isMuted.get()) {
                            pcmBuffer.fill(0)
                        }

                        // Write to Bluetooth socket
                        outputStream.write(pcmBuffer, 0, bytesRead)
                        outputStream.flush()

                        totalBytesSent += bytesRead
                        val rmsDb = calculateRmsDb(pcmBuffer, bytesRead)

                        _metrics.value = _metrics.value.copy(
                            isTransmitting = !isMuted.get(),
                            outgoingRmsDb = if (isMuted.get()) -60f else rmsDb,
                            bytesSent = totalBytesSent,
                            isMuted = isMuted.get()
                        )
                    }
                } catch (e: Exception) {
                    if (isRunning.get()) {
                        Log.e(TAG, "Sender thread broken or Bluetooth socket lost", e)
                        stopEngine()
                        onConnectionDropped("Bluetooth connection lost while sending audio")
                    }
                    break
                }
            }
            Log.d(TAG, "Sender thread finished")
        }, "WalkieTalkie-SenderThread").apply {
            priority = Thread.MAX_PRIORITY
            start()
        }
    }

    /**
     * RECEIVER THREAD:
     * Reads incoming raw PCM bytes from Bluetooth input stream and plays them via AudioTrack in real time.
     */
    private fun startReceiverThread(inputStream: InputStream, bufferSize: Int) {
        receiverThread = Thread({
            val chunkSizeBytes = 640
            val pcmBuffer = ByteArray(chunkSizeBytes)

            Log.d(TAG, "Receiver thread started")

            while (isRunning.get()) {
                try {
                    val track = audioTrack ?: break

                    // Blocking read from Bluetooth RFCOMM socket
                    val bytesRead = inputStream.read(pcmBuffer, 0, chunkSizeBytes)

                    if (bytesRead == -1) {
                        Log.w(TAG, "Bluetooth input stream reached EOF (peer disconnected)")
                        if (isRunning.get()) {
                            stopEngine()
                            onConnectionDropped("Peer disconnected")
                        }
                        break
                    }

                    if (bytesRead > 0) {
                        // Write directly to AudioTrack for immediate low-latency streaming playback
                        track.write(pcmBuffer, 0, bytesRead)

                        totalBytesReceived += bytesRead
                        val rmsDb = calculateRmsDb(pcmBuffer, bytesRead)

                        _metrics.value = _metrics.value.copy(
                            isReceiving = true,
                            incomingRmsDb = rmsDb,
                            bytesReceived = totalBytesReceived
                        )
                    }
                } catch (e: Exception) {
                    if (isRunning.get()) {
                        Log.e(TAG, "Receiver thread broken or Bluetooth socket lost", e)
                        stopEngine()
                        onConnectionDropped("Bluetooth connection lost while receiving audio")
                    }
                    break
                }
            }
            Log.d(TAG, "Receiver thread finished")
        }, "WalkieTalkie-ReceiverThread").apply {
            priority = Thread.MAX_PRIORITY
            start()
        }
    }

    /**
     * Toggle microphone mute state without dropping the full-duplex socket.
     */
    fun setMuted(muted: Boolean) {
        isMuted.set(muted)
        _metrics.value = _metrics.value.copy(isMuted = muted)
    }

    /**
     * Calculates the Root Mean Square (RMS) volume level in decibels for waveform visualization.
     */
    private fun calculateRmsDb(buffer: ByteArray, bytesRead: Int): Float {
        var sumSquares = 0.0
        val sampleCount = bytesRead / 2
        if (sampleCount <= 0) return -60f

        var i = 0
        while (i < bytesRead - 1) {
            // Little-endian 16-bit signed PCM
            val low = buffer[i].toInt() and 0xFF
            val high = buffer[i + 1].toInt()
            val sample = (high shl 8) or low
            sumSquares += (sample * sample)
            i += 2
        }

        val rms = sqrt(sumSquares / sampleCount)
        if (rms <= 0.0) return -60f

        // Convert normalized sample RMS to Decibels Full Scale (dBFS)
        val normalized = rms / 32768.0
        val db = 20 * kotlin.math.log10(normalized.coerceAtLeast(0.0001))
        return db.toFloat().coerceIn(-60f, 0f)
    }

    /**
     * Releases all audio hardware, audiofx filters, and terminates background threads cleanly.
     */
    fun stopEngine() {
        if (!isRunning.getAndSet(false)) {
            return
        }

        Log.i(TAG, "Stopping AudioEngine and releasing resources...")

        // Stop recording
        try {
            audioRecord?.apply {
                if (recordingState == AudioRecord.RECORDSTATE_RECORDING) {
                    stop()
                }
                release()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error releasing AudioRecord", e)
        }
        audioRecord = null

        // Stop playback
        try {
            audioTrack?.apply {
                if (playState == AudioTrack.PLAYSTATE_PLAYING) {
                    stop()
                    flush()
                }
                release()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error releasing AudioTrack", e)
        }
        audioTrack = null

        // Release hardware audio effects
        try {
            echoCanceler?.release()
        } catch (e: Exception) {
            Log.e(TAG, "Error releasing AcousticEchoCanceler", e)
        }
        echoCanceler = null

        try {
            noiseSuppressor?.release()
        } catch (e: Exception) {
            Log.e(TAG, "Error releasing NoiseSuppressor", e)
        }
        noiseSuppressor = null

        try {
            gainControl?.release()
        } catch (e: Exception) {
            Log.e(TAG, "Error releasing AutomaticGainControl", e)
        }
        gainControl = null

        // Interrupt threads
        senderThread?.interrupt()
        receiverThread?.interrupt()
        senderThread = null
        receiverThread = null

        _metrics.value = AudioMetrics()
        Log.i(TAG, "AudioEngine cleanly stopped")
    }
}
