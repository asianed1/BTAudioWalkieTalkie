package com.example.btaudiowalkietalkie

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
import com.example.btaudiowalkietalkie.ui.AppRadioMode
import com.example.btaudiowalkietalkie.ui.WalkieTalkieScreen
import com.example.btaudiowalkietalkie.ui.theme.BTAudioWalkieTalkieTheme
import com.example.btaudiowalkietalkie.wifi.WifiAudioController
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach

class MainActivity : ComponentActivity() {

    private lateinit var bluetoothController: BluetoothController
    private var audioEngine: AudioEngine? = null
    private lateinit var wifiAudioController: WifiAudioController

    private var currentMode by mutableStateOf(AppRadioMode.BLUETOOTH)
    private var hasPermissions by mutableStateOf(false)

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.values.all { it }
        hasPermissions = allGranted
        if (allGranted) {
            Toast.makeText(this, "Permissions granted", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(this, "Required permissions needed for audio streaming", Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val deviceModel = Build.MODEL ?: "Android Phone"
        bluetoothController = BluetoothController(this, lifecycleScope)
        wifiAudioController = WifiAudioController(this, lifecycleScope, deviceModel)

        checkAndRequestPermissions()

        // Auto-launch Bluetooth AudioEngine when RFCOMM socket is connected
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
                else -> {}
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
                    val wifiState by wifiAudioController.channelState.collectAsState()

                    WalkieTalkieScreen(
                        currentMode = currentMode,
                        onSelectMode = { mode ->
                            if (mode != currentMode) {
                                // Stop previous mode
                                if (currentMode == AppRadioMode.BLUETOOTH) {
                                    bluetoothController.disconnect()
                                } else {
                                    wifiAudioController.stopChannel()
                                }
                                currentMode = mode
                            }
                        },
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
                        onDisconnectBt = { bluetoothController.disconnect() },
                        onToggleMuteBt = {
                            val muted = audioEngine?.isMuted?.get() ?: false
                            audioEngine?.setMuted(!muted)
                        },
                        wifiState = wifiState,
                        onStartWifiChannel = { channelId -> wifiAudioController.startChannel(channelId) },
                        onStopWifiChannel = { wifiAudioController.stopChannel() },
                        onToggleMuteWifi = {
                            val muted = wifiAudioController.isMuted.get()
                            wifiAudioController.setMuted(!muted)
                        }
                    )
                }
            }
        }
    }

    private fun checkAndRequestPermissions() {
        val permissionsToRequest = mutableListOf<String>()

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.RECORD_AUDIO)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.BLUETOOTH_SCAN)
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.BLUETOOTH_CONNECT)
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_ADVERTISE) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.BLUETOOTH_ADVERTISE)
            }
        } else {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
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
        wifiAudioController.stopChannel()
    }
}
