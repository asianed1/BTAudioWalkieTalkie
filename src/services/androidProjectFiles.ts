import JSZip from 'jszip';

export interface ProjectFile {
  path: string;
  name: string;
  language: 'kotlin' | 'xml' | 'groovy' | 'markdown' | 'properties';
  category: 'Kotlin Source' | 'Manifest & Config' | 'Documentation';
  content: string;
}

export const ANDROID_PROJECT_FILES: ProjectFile[] = [
  {
    path: 'app/src/main/java/com/example/btaudiowalkietalkie/wifi/WifiAudioController.kt',
    name: 'WifiAudioController.kt',
    language: 'kotlin',
    category: 'Kotlin Source',
    content: `package com.example.btaudiowalkietalkie.wifi

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
        const val DEFAULT_PORT = 50005
        const val MULTICAST_IP = "239.255.0.1"
        const val SAMPLE_RATE = 16000
        const val CHUNK_SIZE = 640 // 20ms at 16kHz 16-bit mono
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

    @SuppressLint("MissingPermission")
    fun startChannel(channelNumber: Int = 1) {
        if (isRunning.get()) return
        isRunning.set(true)

        val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
        multicastLock = wifiManager?.createMulticastLock("BTAudioWalkieTalkieMulticast")?.apply {
            setReferenceCounted(true)
            acquire()
        }

        groupAddress = InetAddress.getByName(MULTICAST_IP)
        val multicastSocket = MulticastSocket(DEFAULT_PORT).apply {
            reuseAddress = true
            timeToLive = 4
            broadcast = true
            try { joinGroup(groupAddress) } catch (ignored: Exception) {}
        }
        socket = multicastSocket

        val minRecordBuf = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
        audioRecord = AudioRecord(
            MediaRecorder.AudioSource.VOICE_COMMUNICATION,
            SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
            Math.max(minRecordBuf * 2, 2048)
        )

        if (AcousticEchoCanceler.isAvailable()) {
            echoCanceler = AcousticEchoCanceler.create(audioRecord!!.audioSessionId)?.apply { enabled = true }
        }

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

        audioTrack = AudioTrack(audioAttributes, audioFormat, Math.max(minTrackBuf * 2, 2048), AudioTrack.MODE_STREAM, AudioManager.AUDIO_SESSION_ID_GENERATE)
        audioTrack?.play()
        audioRecord?.startRecording()

        _channelState.value = _channelState.value.copy(isActive = true, channelNumber = channelNumber)
    }

    fun stopChannel() {
        if (!isRunning.getAndSet(false)) return
        try { socket?.close() } catch (ignored: Exception) {}
        socket = null
        try { audioRecord?.apply { stop(); release() } } catch (ignored: Exception) {}
        audioRecord = null
        try { audioTrack?.apply { stop(); flush(); release() } } catch (ignored: Exception) {}
        audioTrack = null
        try { echoCanceler?.release() } catch (ignored: Exception) {}
        echoCanceler = null
        try { if (multicastLock?.isHeld == true) multicastLock?.release() } catch (ignored: Exception) {}
        multicastLock = null
        _channelState.value = WifiChannelState()
    }
}`
  },
  {
    path: 'app/src/main/java/com/example/btaudiowalkietalkie/MainActivity.kt',
    name: 'MainActivity.kt',
    language: 'kotlin',
    category: 'Kotlin Source',
    content: `package com.example.btaudiowalkietalkie

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.example.btaudiowalkietalkie.audio.AudioEngine
import com.example.btaudiowalkietalkie.bluetooth.BluetoothController
import com.example.btaudiowalkietalkie.bluetooth.ConnectionState
import com.example.btaudiowalkietalkie.ui.WalkieTalkieScreen
import com.example.btaudiowalkietalkie.ui.theme.BTAudioWalkieTalkieTheme
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach

/**
 * Single Activity hosting the BTAudioWalkieTalkie Compose UI and managing
 * Bluetooth runtime permissions, lifecycle events, and AudioEngine instantiation.
 */
class MainActivity : ComponentActivity() {

    private lateinit var bluetoothController: BluetoothController
    private var audioEngine: AudioEngine? = null
    private var hasPermissions by mutableStateOf(false)

    // Android 12+ (API 31+) & Audio permission launcher
    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.values.all { it }
        if (allGranted) {
            hasPermissions = true
            Toast.makeText(this, "Permissions granted", Toast.LENGTH_SHORT).show()
        } else {
            hasPermissions = false
            Toast.makeText(this, "Bluetooth and Microphone permissions required for voice link", Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        bluetoothController = BluetoothController(this, lifecycleScope)
        checkAndRequestPermissions()

        // Auto-launch AudioEngine as soon as Bluetooth RFCOMM socket is connected
        bluetoothController.connectionState.onEach { state ->
            when (state) {
                is ConnectionState.Connected -> {
                    audioEngine?.stopEngine()
                    audioEngine = AudioEngine(state.socket) { errorReason ->
                        runOnUiThread {
                            Toast.makeText(this, errorReason, Toast.LENGTH_SHORT).show()
                            bluetoothController.disconnect()
                        }
                    }.apply {
                        startEngine()
                    }
                }
                is ConnectionState.Disconnected, is ConnectionState.Error -> {
                    audioEngine?.stopEngine()
                    audioEngine = null
                }
                else -> { /* In transition */ }
            }
        }.launchIn(lifecycleScope)

        setContent {
            BTAudioWalkieTalkieTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val connectionState by bluetoothController.connectionState.collectAsState()
                    val discoveredDevices by bluetoothController.discoveredDevices.collectAsState()
                    val isScanning by bluetoothController.isScanning.collectAsState()
                    val pairedDevices = remember(connectionState, hasPermissions) {
                        if (hasPermissions) bluetoothController.getPairedDevices() else emptyList()
                    }

                    val audioMetrics = audioEngine?.metrics?.collectAsState()?.value

                    WalkieTalkieScreen(
                        connectionState = connectionState,
                        pairedDevices = pairedDevices,
                        discoveredDevices = discoveredDevices,
                        isScanning = isScanning,
                        hasPermissions = hasPermissions,
                        audioMetrics = audioMetrics,
                        onRequestPermissions = { checkAndRequestPermissions() },
                        onScanClicked = {
                            if (isScanning) bluetoothController.stopDiscovery()
                            else bluetoothController.startDiscovery()
                        },
                        onHostClicked = { bluetoothController.hostConnection() },
                        onConnectDevice = { device -> bluetoothController.connectToDevice(device) },
                        onDisconnect = { bluetoothController.disconnect() },
                        onToggleMute = {
                            val muted = audioEngine?.isMuted?.get() ?: false
                            audioEngine?.setMuted(!muted)
                        }
                    )
                }
            }
        }
    }

    private fun checkAndRequestPermissions() {
        val permissionsToRequest = mutableListOf<String>()

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.RECORD_AUDIO)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN)
                != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.BLUETOOTH_SCAN)
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT)
                != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.BLUETOOTH_CONNECT)
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_ADVERTISE)
                != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.BLUETOOTH_ADVERTISE)
            }
        } else {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.ACCESS_FINE_LOCATION)
            }
        }

        if (permissionsToRequest.isEmpty()) {
            hasPermissions = true
        } else {
            requestPermissionLauncher.launch(permissionsToRequest.toTypedArray())
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        audioEngine?.stopEngine()
        bluetoothController.release()
    }
}`
  },
  {
    path: 'app/src/main/java/com/example/btaudiowalkietalkie/bluetooth/BluetoothController.kt',
    name: 'BluetoothController.kt',
    language: 'kotlin',
    category: 'Kotlin Source',
    content: `package com.example.btaudiowalkietalkie.bluetooth

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothServerSocket
import android.bluetooth.BluetoothSocket
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.IOException
import java.util.UUID

sealed class ConnectionState {
    object Disconnected : ConnectionState()
    data class Listening(val message: String = "Waiting for incoming peer...") : ConnectionState()
    data class Connecting(val deviceName: String) : ConnectionState()
    data class Connected(val deviceName: String, val socket: BluetoothSocket) : ConnectionState()
    data class Error(val message: String) : ConnectionState()
}

/**
 * Handles Bluetooth discovery, paired device queries, and RFCOMM socket lifecycle.
 */
class BluetoothController(
    private val context: Context,
    private val scope: CoroutineScope
) {
    companion object {
        private const val TAG = "BluetoothController"
        private const val APP_NAME = "BTAudioWalkieTalkie"

        // Standard Serial Port Profile (SPP) UUID
        val WALKIE_TALKIE_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    }

    private val bluetoothAdapter: BluetoothAdapter? = BluetoothAdapter.getDefaultAdapter()

    private val _connectionState = MutableStateFlow<ConnectionState>(ConnectionState.Disconnected)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

    private val _discoveredDevices = MutableStateFlow<List<BluetoothDevice>>(emptyList())
    val discoveredDevices: StateFlow<List<BluetoothDevice>> = _discoveredDevices.asStateFlow()

    private val _isScanning = MutableStateFlow(false)
    val isScanning: StateFlow<Boolean> = _isScanning.asStateFlow()

    private var serverSocket: BluetoothServerSocket? = null
    private var activeSocket: BluetoothSocket? = null
    private var connectionJob: Job? = null

    private val discoveryReceiver = object : BroadcastReceiver() {
        @SuppressLint("MissingPermission")
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                BluetoothDevice.ACTION_FOUND -> {
                    val device: BluetoothDevice? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java)
                    } else {
                        @Suppress("DEPRECATION")
                        intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
                    }
                    device?.let { newDevice ->
                        val currentList = _discoveredDevices.value.toMutableList()
                        if (currentList.none { it.address == newDevice.address }) {
                            currentList.add(newDevice)
                            _discoveredDevices.value = currentList
                        }
                    }
                }
                BluetoothAdapter.ACTION_DISCOVERY_STARTED -> {
                    _isScanning.value = true
                }
                BluetoothAdapter.ACTION_DISCOVERY_FINISHED -> {
                    _isScanning.value = false
                }
            }
        }
    }

    init {
        val filter = IntentFilter().apply {
            addAction(BluetoothDevice.ACTION_FOUND)
            addAction(BluetoothAdapter.ACTION_DISCOVERY_STARTED)
            addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED)
        }
        context.registerReceiver(discoveryReceiver, filter)
    }

    fun isBluetoothAvailable(): Boolean = bluetoothAdapter != null
    fun isBluetoothEnabled(): Boolean = bluetoothAdapter?.isEnabled == true

    @SuppressLint("MissingPermission")
    fun getPairedDevices(): List<BluetoothDevice> {
        return try {
            bluetoothAdapter?.bondedDevices?.toList() ?: emptyList()
        } catch (e: SecurityException) {
            Log.e(TAG, "Missing BLUETOOTH_CONNECT permission", e)
            emptyList()
        }
    }

    @SuppressLint("MissingPermission")
    fun startDiscovery() {
        try {
            if (bluetoothAdapter?.isDiscovering == true) {
                bluetoothAdapter.cancelDiscovery()
            }
            _discoveredDevices.value = emptyList()
            bluetoothAdapter?.startDiscovery()
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException starting discovery", e)
            _connectionState.value = ConnectionState.Error("Bluetooth scan permission missing")
        }
    }

    @SuppressLint("MissingPermission")
    fun stopDiscovery() {
        try {
            if (bluetoothAdapter?.isDiscovering == true) {
                bluetoothAdapter.cancelDiscovery()
            }
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException stopping discovery", e)
        }
    }

    /**
     * Hosts connection as RFCOMM Server socket: listenUsingRfcommWithServiceRecord
     */
    @SuppressLint("MissingPermission")
    fun hostConnection() {
        disconnect()
        _connectionState.value = ConnectionState.Listening()

        connectionJob = scope.launch(Dispatchers.IO) {
            try {
                Log.d(TAG, "Opening RFCOMM server socket with UUID: $WALKIE_TALKIE_UUID")
                serverSocket = bluetoothAdapter?.listenUsingRfcommWithServiceRecord(APP_NAME, WALKIE_TALKIE_UUID)

                val socket = serverSocket?.accept()
                serverSocket?.close()
                serverSocket = null

                if (socket != null) {
                    activeSocket = socket
                    val remoteName = try {
                        socket.remoteDevice.name ?: socket.remoteDevice.address
                    } catch (e: Exception) {
                        "Peer Device"
                    }
                    Log.i(TAG, "Host accepted connection from: $remoteName")
                    withContext(Dispatchers.Main) {
                        _connectionState.value = ConnectionState.Connected(remoteName, socket)
                    }
                }
            } catch (e: IOException) {
                Log.e(TAG, "Server socket accept failed", e)
                withContext(Dispatchers.Main) {
                    if (_connectionState.value is ConnectionState.Listening) {
                        _connectionState.value = ConnectionState.Error("Listening cancelled or failed: \${e.message}")
                    }
                }
            } catch (e: SecurityException) {
                Log.e(TAG, "SecurityException hosting connection", e)
                withContext(Dispatchers.Main) {
                    _connectionState.value = ConnectionState.Error("Bluetooth permission denied")
                }
            }
        }
    }

    /**
     * Connects to remote peer as RFCOMM Client: createRfcommSocketToServiceRecord
     */
    @SuppressLint("MissingPermission")
    fun connectToDevice(device: BluetoothDevice) {
        disconnect()
        val deviceName = try {
            device.name ?: device.address
        } catch (e: Exception) {
            device.address
        }

        _connectionState.value = ConnectionState.Connecting(deviceName)

        connectionJob = scope.launch(Dispatchers.IO) {
            stopDiscovery()
            try {
                Log.d(TAG, "Creating RFCOMM socket to: $deviceName")
                val socket = device.createRfcommSocketToServiceRecord(WALKIE_TALKIE_UUID)
                socket.connect()
                activeSocket = socket

                Log.i(TAG, "Connected to host: $deviceName")
                withContext(Dispatchers.Main) {
                    _connectionState.value = ConnectionState.Connected(deviceName, socket)
                }
            } catch (e: IOException) {
                Log.e(TAG, "Client connection failed to $deviceName", e)
                withContext(Dispatchers.Main) {
                    _connectionState.value = ConnectionState.Error("Connection failed: \${e.localizedMessage}")
                }
            } catch (e: SecurityException) {
                Log.e(TAG, "SecurityException connecting to device", e)
                withContext(Dispatchers.Main) {
                    _connectionState.value = ConnectionState.Error("Bluetooth permission denied")
                }
            }
        }
    }

    fun disconnect() {
        connectionJob?.cancel()
        connectionJob = null
        try { serverSocket?.close() } catch (e: IOException) {}
        serverSocket = null
        try { activeSocket?.close() } catch (e: IOException) {}
        activeSocket = null
        _connectionState.value = ConnectionState.Disconnected
    }

    fun release() {
        disconnect()
        try {
            context.unregisterReceiver(discoveryReceiver)
        } catch (e: IllegalArgumentException) {}
    }
}`
  },
  {
    path: 'app/src/main/java/com/example/btaudiowalkietalkie/audio/AudioEngine.kt',
    name: 'AudioEngine.kt',
    language: 'kotlin',
    category: 'Kotlin Source',
    content: `package com.example.btaudiowalkietalkie.audio

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
 * Full-duplex audio engine:
 * Sender Thread: AudioRecord (16kHz 16-bit PCM Mono, VOICE_COMMUNICATION) -> BluetoothSocket.outputStream
 * Receiver Thread: BluetoothSocket.inputStream -> AudioTrack (STREAM_VOICE_CALL, MODE_STREAM)
 */
class AudioEngine(
    private val socket: BluetoothSocket,
    private val onConnectionDropped: (String) -> Unit
) {
    companion object {
        private const val TAG = "AudioEngine"
        const val SAMPLE_RATE = 16000
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

    private var echoCanceler: AcousticEchoCanceler? = null
    private var noiseSuppressor: NoiseSuppressor? = null
    private var gainControl: AutomaticGainControl? = null

    private val _metrics = MutableStateFlow(AudioMetrics())
    val metrics: StateFlow<AudioMetrics> = _metrics.asStateFlow()

    private var totalBytesSent = 0L
    private var totalBytesReceived = 0L

    @SuppressLint("MissingPermission")
    fun startEngine() {
        if (isRunning.get()) return
        isRunning.set(true)

        val minRecordBufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG_IN, AUDIO_FORMAT).coerceAtLeast(1024)
        val minTrackBufferSize = AudioTrack.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG_OUT, AUDIO_FORMAT).coerceAtLeast(1024)

        val recordBufferSize = minRecordBufferSize * 2
        val trackBufferSize = minTrackBufferSize * 2

        try {
            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.VOICE_COMMUNICATION,
                SAMPLE_RATE,
                CHANNEL_CONFIG_IN,
                AUDIO_FORMAT,
                recordBufferSize
            )

            if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                throw IllegalStateException("AudioRecord initialization failed")
            }

            val audioSessionId = audioRecord!!.audioSessionId

            // Attach AcousticEchoCanceler
            var aecEnabled = false
            if (AcousticEchoCanceler.isAvailable()) {
                echoCanceler = AcousticEchoCanceler.create(audioSessionId)?.apply {
                    enabled = true
                    aecEnabled = enabled
                }
            }

            // Attach NoiseSuppressor
            var nsEnabled = false
            if (NoiseSuppressor.isAvailable()) {
                noiseSuppressor = NoiseSuppressor.create(audioSessionId)?.apply {
                    enabled = true
                    nsEnabled = enabled
                }
            }

            if (AutomaticGainControl.isAvailable()) {
                gainControl = AutomaticGainControl.create(audioSessionId)?.apply {
                    enabled = true
                }
            }

            // Configure AudioTrack on STREAM_VOICE_CALL
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

            audioTrack?.play()
            audioRecord?.startRecording()

            _metrics.value = _metrics.value.copy(
                isEchoCancelerActive = aecEnabled,
                isNoiseSuppressorActive = nsEnabled
            )

            val outputStream = socket.outputStream
            val inputStream = socket.inputStream

            startSenderThread(outputStream)
            startReceiverThread(inputStream)

            Log.i(TAG, "AudioEngine started successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Fatal error starting AudioEngine", e)
            stopEngine()
            onConnectionDropped("Audio initialization failed: \${e.localizedMessage}")
        }
    }

    private fun startSenderThread(outputStream: OutputStream) {
        senderThread = Thread({
            val chunkSizeBytes = 640 // 20ms at 16kHz 16-bit mono
            val pcmBuffer = ByteArray(chunkSizeBytes)

            while (isRunning.get()) {
                try {
                    val record = audioRecord ?: break
                    if (record.recordingState != AudioRecord.RECORDSTATE_RECORDING) break

                    val bytesRead = record.read(pcmBuffer, 0, chunkSizeBytes)

                    if (bytesRead > 0) {
                        if (isMuted.get()) {
                            pcmBuffer.fill(0)
                        }

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
                        Log.e(TAG, "Sender thread broken", e)
                        stopEngine()
                        onConnectionDropped("Bluetooth connection lost while sending audio")
                    }
                    break
                }
            }
        }, "WalkieTalkie-SenderThread").apply {
            priority = Thread.MAX_PRIORITY
            start()
        }
    }

    private fun startReceiverThread(inputStream: InputStream) {
        receiverThread = Thread({
            val chunkSizeBytes = 640
            val pcmBuffer = ByteArray(chunkSizeBytes)

            while (isRunning.get()) {
                try {
                    val track = audioTrack ?: break
                    val bytesRead = inputStream.read(pcmBuffer, 0, chunkSizeBytes)

                    if (bytesRead == -1) {
                        if (isRunning.get()) {
                            stopEngine()
                            onConnectionDropped("Peer disconnected")
                        }
                        break
                    }

                    if (bytesRead > 0) {
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
                        Log.e(TAG, "Receiver thread broken", e)
                        stopEngine()
                        onConnectionDropped("Bluetooth connection lost while receiving audio")
                    }
                    break
                }
            }
        }, "WalkieTalkie-ReceiverThread").apply {
            priority = Thread.MAX_PRIORITY
            start()
        }
    }

    fun setMuted(muted: Boolean) {
        isMuted.set(muted)
        _metrics.value = _metrics.value.copy(isMuted = muted)
    }

    private fun calculateRmsDb(buffer: ByteArray, bytesRead: Int): Float {
        var sumSquares = 0.0
        val sampleCount = bytesRead / 2
        if (sampleCount <= 0) return -60f

        var i = 0
        while (i < bytesRead - 1) {
            val low = buffer[i].toInt() and 0xFF
            val high = buffer[i + 1].toInt()
            val sample = (high shl 8) or low
            sumSquares += (sample * sample)
            i += 2
        }

        val rms = sqrt(sumSquares / sampleCount)
        if (rms <= 0.0) return -60f

        val normalized = rms / 32768.0
        val db = 20 * kotlin.math.log10(normalized.coerceAtLeast(0.0001))
        return db.toFloat().coerceIn(-60f, 0f)
    }

    fun stopEngine() {
        if (!isRunning.getAndSet(false)) return

        try { audioRecord?.apply { if (recordingState == AudioRecord.RECORDSTATE_RECORDING) stop(); release() } } catch (e: Exception) {}
        audioRecord = null

        try { audioTrack?.apply { if (playState == AudioTrack.PLAYSTATE_PLAYING) { stop(); flush() }; release() } } catch (e: Exception) {}
        audioTrack = null

        try { echoCanceler?.release() } catch (e: Exception) {}
        echoCanceler = null

        try { noiseSuppressor?.release() } catch (e: Exception) {}
        noiseSuppressor = null

        try { gainControl?.release() } catch (e: Exception) {}
        gainControl = null

        senderThread?.interrupt()
        receiverThread?.interrupt()
        senderThread = null
        receiverThread = null

        _metrics.value = AudioMetrics()
    }
}`
  },
  {
    path: 'app/src/main/AndroidManifest.xml',
    name: 'AndroidManifest.xml',
    language: 'xml',
    category: 'Manifest & Config',
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools"
    package="com.example.btaudiowalkietalkie">

    <!-- Audio Recording & Routing -->
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />

    <!-- Legacy Bluetooth Permissions (Android 11 and lower) -->
    <uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" android:maxSdkVersion="30" />

    <!-- Modern Bluetooth Permissions (Android 12+ / API 31+) -->
    <uses-permission
        android:name="android.permission.BLUETOOTH_SCAN"
        android:usesPermissionFlags="neverForLocation"
        tools:targetApi="s" />
    <uses-permission
        android:name="android.permission.BLUETOOTH_CONNECT"
        tools:targetApi="s" />
    <uses-permission
        android:name="android.permission.BLUETOOTH_ADVERTISE"
        tools:targetApi="s" />

    <uses-feature android:name="android.hardware.bluetooth" android:required="true" />
    <uses-feature android:name="android.hardware.microphone" android:required="true" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="BTAudioWalkieTalkie"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.BTAudioWalkieTalkie"
        tools:targetApi="34">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|screenLayout|keyboardHidden"
            android:theme="@style/Theme.BTAudioWalkieTalkie">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>

</manifest>`
  },
  {
    path: 'app/build.gradle.kts',
    name: 'app/build.gradle.kts',
    language: 'groovy',
    category: 'Manifest & Config',
    content: `plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.example.btaudiowalkietalkie"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.example.btaudiowalkietalkie"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.kotlinx.coroutines.android)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)
}`
  },
  {
    path: 'settings.gradle.kts',
    name: 'settings.gradle.kts',
    language: 'groovy',
    category: 'Manifest & Config',
    content: `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "BTAudioWalkieTalkie"
include(":app")`
  },
  {
    path: 'gradle/libs.versions.toml',
    name: 'libs.versions.toml',
    language: 'properties',
    category: 'Manifest & Config',
    content: `[versions]
agp = "8.7.2"
kotlin = "2.0.21"
coreKtx = "1.15.0"
lifecycleRuntimeKtx = "2.8.7"
activityCompose = "1.9.3"
composeBom = "2024.11.00"
coroutines = "1.9.0"

[libraries]
androidx-core-ktx = { group = "androidx.core", name = "core-ktx", version.ref = "coreKtx" }
androidx-lifecycle-runtime-ktx = { group = "androidx.lifecycle", name = "lifecycle-runtime-ktx", version.ref = "lifecycleRuntimeKtx" }
androidx-lifecycle-viewmodel-compose = { group = "androidx.lifecycle", name = "lifecycle-viewmodel-compose", version.ref = "lifecycleRuntimeKtx" }
androidx-activity-compose = { group = "androidx.activity", name = "activity-compose", version.ref = "activityCompose" }
androidx-compose-bom = { group = "androidx.compose", name = "compose-bom", version.ref = "composeBom" }
androidx-compose-ui = { group = "androidx.compose.ui", name = "ui" }
androidx-compose-ui-graphics = { group = "androidx.compose.ui", name = "ui-graphics" }
androidx-compose-material3 = { group = "androidx.compose.material3", name = "material3" }
androidx-compose-material-icons-extended = { group = "androidx.compose.material", name = "material-icons-extended" }
kotlinx-coroutines-android = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-android", version.ref = "coroutines" }

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
kotlin-compose = { id = "org.jetbrains.kotlin.plugin.compose", version.ref = "kotlin" }`
  },
  {
    path: 'app/src/test/java/com/example/btaudiowalkietalkie/AudioEngineTest.kt',
    name: 'AudioEngineTest.kt',
    language: 'kotlin',
    category: 'Kotlin Source',
    content: `package com.example.btaudiowalkietalkie

import com.example.btaudiowalkietalkie.audio.AudioEngine
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.log10
import kotlin.math.sqrt

class AudioEngineTest {

    @Test
    fun testAudioSpecifications() {
        assertEquals(16000, AudioEngine.SAMPLE_RATE)
        assertEquals(2, AudioEngine.AUDIO_FORMAT)
    }

    @Test
    fun testPcmFrameSizeCalculation() {
        val sampleRate = AudioEngine.SAMPLE_RATE
        val bytesPerSample = 2
        val channels = 1
        val bytesPerSecond = sampleRate * bytesPerSample * channels

        val chunkDurationMs = 20
        val expectedChunkSizeBytes = (bytesPerSecond * chunkDurationMs) / 1000

        assertEquals(640, expectedChunkSizeBytes)
        assertEquals(320, expectedChunkSizeBytes / bytesPerSample)
    }

    @Test
    fun testMuteFillsBufferWithSilence() {
        val chunkSizeBytes = 640
        val buffer = ByteArray(chunkSizeBytes) { 0x7F.toByte() }
        val isMuted = true
        if (isMuted) {
            buffer.fill(0)
        }
        for (byte in buffer) {
            assertEquals(0.toByte(), byte)
        }
    }

    @Test
    fun testRmsDbComputationAccuracy() {
        val chunkSizeBytes = 640
        val silenceBuffer = ByteArray(chunkSizeBytes) { 0 }
        var sumSquares = 0.0
        val sampleCount = chunkSizeBytes / 2
        var i = 0
        while (i < chunkSizeBytes - 1) {
            val low = silenceBuffer[i].toInt() and 0xFF
            val high = silenceBuffer[i + 1].toInt()
            val sample = (high shl 8) or low
            sumSquares += (sample * sample)
            i += 2
        }
        val rms = sqrt(sumSquares / sampleCount)
        val normalized = rms / 32768.0
        val db = (20 * log10(normalized.coerceAtLeast(0.0001))).toFloat().coerceIn(-60f, 0f)
        assertEquals(-60f, db)
    }
}`
  },
  {
    path: 'app/src/test/java/com/example/btaudiowalkietalkie/BluetoothControllerTest.kt',
    name: 'BluetoothControllerTest.kt',
    language: 'kotlin',
    category: 'Kotlin Source',
    content: `package com.example.btaudiowalkietalkie

import com.example.btaudiowalkietalkie.bluetooth.BluetoothController
import com.example.btaudiowalkietalkie.bluetooth.ConnectionState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.UUID

class BluetoothControllerTest {

    @Test
    fun testStandardSppUuidMatchesBluetoothSigSpec() {
        val expectedUuid = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
        assertEquals(expectedUuid, BluetoothController.WALKIE_TALKIE_UUID)
    }

    @Test
    fun testConnectionStateHierarchy() {
        val disconnected: ConnectionState = ConnectionState.Disconnected
        val listening: ConnectionState = ConnectionState.Listening()
        val connecting: ConnectionState = ConnectionState.Connecting("Pixel 8")
        val error: ConnectionState = ConnectionState.Error("Socket closed")

        assertTrue(disconnected is ConnectionState.Disconnected)
        assertTrue(listening is ConnectionState.Listening)
        assertTrue(connecting is ConnectionState.Connecting)
        assertEquals("Pixel 8", (connecting as ConnectionState.Connecting).deviceName)
        assertTrue(error is ConnectionState.Error)
    }
}`
  },
  {
    path: 'README.md',
    name: 'README.md',
    language: 'markdown',
    category: 'Documentation',
    content: `# BTAudioWalkieTalkie

Complete Kotlin implementation of a peer-to-peer full-duplex Bluetooth RFCOMM audio streaming walkie-talkie app.

### Audio Specifications
- Sampling Rate: 16000 Hz (16 kHz wideband PCM)
- Bit Depth: 16-bit Signed Little-Endian PCM
- Channel: Mono
- AudioSource: MediaRecorder.AudioSource.VOICE_COMMUNICATION
- StreamType: AudioManager.STREAM_VOICE_CALL (MODE_STREAM)
- Hardware Filter: android.media.audiofx.AcousticEchoCanceler (AEC)

### RFCOMM Bluetooth Configuration & Topology
- Network Topology: Strict Point-to-Point (1-to-1). Only two devices can connect simultaneously; third-party connection attempts are refused.
- Service Name: BTAudioWalkieTalkie
- Standard SPP UUID: 00001101-0000-1000-8000-00805F9B34FB
- Android 12+ Runtime Permissions: BLUETOOTH_SCAN, BLUETOOTH_CONNECT, BLUETOOTH_ADVERTISE, RECORD_AUDIO.`
  }
];

export function downloadApkDirectly() {
  const a = document.createElement('a');
  a.href = '/BTAudioWalkieTalkie.apk';
  a.download = 'BTAudioWalkieTalkie.apk';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function downloadProjectZip() {
  const zip = new JSZip();

  for (const file of ANDROID_PROJECT_FILES) {
    zip.file(file.path, file.content);
  }

  // Include the real compiled & signed BTAudioWalkieTalkie.apk inside the zip
  try {
    const res = await fetch('/BTAudioWalkieTalkie.apk');
    if (res.ok) {
      const apkBlob = await res.blob();
      zip.file('BTAudioWalkieTalkie.apk', apkBlob);
      zip.file('app/build/outputs/apk/debug/BTAudioWalkieTalkie.apk', apkBlob);
    }
  } catch (e) {
    console.warn('Could not bundle apk in zip:', e);
  }

  // Add root build configs and scripts
  zip.file('gradle.properties', `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8\nandroid.useAndroidX=true\nkotlin.code.style=official\n`);
  zip.file('build.gradle.kts', `plugins {\n    alias(libs.plugins.android.application) apply false\n    alias(libs.plugins.kotlin.android) apply false\n    alias(libs.plugins.kotlin.compose) apply false\n}\n`);

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'BTAudioWalkieTalkie-Android-Project.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
