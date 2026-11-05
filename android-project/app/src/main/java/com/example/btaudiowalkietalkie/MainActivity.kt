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
import com.example.btaudiowalkietalkie.ui.WalkieTalkieScreen
import com.example.btaudiowalkietalkie.ui.theme.BTAudioWalkieTalkieTheme
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach

class MainActivity : ComponentActivity() {

    private lateinit var bluetoothController: BluetoothController
    private var audioEngine: AudioEngine? = null

    private var hasPermissions by mutableStateOf(false)

    // Permission launcher for Android 12+ and earlier
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

        // Listen for Bluetooth socket connection events to automatically start AudioEngine
        bluetoothController.connectionState.onEach { state ->
            when (state) {
                is ConnectionState.Connected -> {
                    // Launch full-duplex AudioEngine automatically once RFCOMM socket is ready
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

        // Audio permission
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.RECORD_AUDIO)
        }

        // Bluetooth permissions based on Android API level
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Android 12+ (API 31+)
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
            // Android 11 and lower
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
}
