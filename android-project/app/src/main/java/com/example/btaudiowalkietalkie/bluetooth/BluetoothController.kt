package com.example.btaudiowalkietalkie.bluetooth

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

/**
 * Connection states for Bluetooth RFCOMM session.
 */
sealed class ConnectionState {
    object Disconnected : ConnectionState()
    data class Listening(val message: String = "Waiting for incoming peer...") : ConnectionState()
    data class Connecting(val deviceName: String) : ConnectionState()
    data class Connected(val deviceName: String, val socket: BluetoothSocket) : ConnectionState()
    data class Error(val message: String) : ConnectionState()
}

/**
 * Manages Bluetooth discovery, paired devices, server listening, and client connection.
 * Uses standard RFCOMM Serial Port Profile (SPP) UUID.
 */
class BluetoothController(
    private val context: Context,
    private val scope: CoroutineScope
) {
    companion object {
        private const val TAG = "BluetoothController"
        private const val APP_NAME = "BTAudioWalkieTalkie"

        // Standard Serial Port Profile (SPP) UUID for RFCOMM serial streams
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

    // Broadcast receiver for Bluetooth Discovery
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

    /**
     * Checks if Bluetooth is supported and enabled on this device.
     */
    fun isBluetoothAvailable(): Boolean = bluetoothAdapter != null
    fun isBluetoothEnabled(): Boolean = bluetoothAdapter?.isEnabled == true

    /**
     * Returns paired devices list. Requires BLUETOOTH_CONNECT permission on Android 12+.
     */
    @SuppressLint("MissingPermission")
    fun getPairedDevices(): List<BluetoothDevice> {
        return try {
            bluetoothAdapter?.bondedDevices?.toList() ?: emptyList()
        } catch (e: SecurityException) {
            Log.e(TAG, "Missing BLUETOOTH_CONNECT permission", e)
            emptyList()
        }
    }

    /**
     * Starts device discovery. Requires BLUETOOTH_SCAN permission on Android 12+.
     */
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
     * Hosts connection: Acts as the RFCOMM Server socket listening for incoming peers.
     */
    @SuppressLint("MissingPermission")
    fun hostConnection() {
        disconnect()
        _connectionState.value = ConnectionState.Listening()

        connectionJob = scope.launch(Dispatchers.IO) {
            try {
                Log.d(TAG, "Opening RFCOMM server socket with UUID: $WALKIE_TALKIE_UUID")
                serverSocket = bluetoothAdapter?.listenUsingRfcommWithServiceRecord(APP_NAME, WALKIE_TALKIE_UUID)

                // Blocking accept call until peer connects or socket closed
                val socket = serverSocket?.accept()

                // Close server socket once connected (one-to-one peer connection)
                serverSocket?.close()
                serverSocket = null

                if (socket != null) {
                    activeSocket = socket
                    val remoteName = try {
                        socket.remoteDevice.name ?: socket.remoteDevice.address
                    } catch (e: Exception) {
                        "Unknown Peer"
                    }
                    Log.i(TAG, "Host successfully connected to client: $remoteName")
                    withContext(Dispatchers.Main) {
                        _connectionState.value = ConnectionState.Connected(remoteName, socket)
                    }
                }
            } catch (e: IOException) {
                Log.e(TAG, "Server socket accept failed or was cancelled", e)
                withContext(Dispatchers.Main) {
                    if (_connectionState.value is ConnectionState.Listening) {
                        _connectionState.value = ConnectionState.Error("Listening cancelled or failed: ${e.message}")
                    }
                }
            } catch (e: SecurityException) {
                Log.e(TAG, "SecurityException in hostConnection", e)
                withContext(Dispatchers.Main) {
                    _connectionState.value = ConnectionState.Error("Bluetooth permission denied")
                }
            }
        }
    }

    /**
     * Connects to a remote peer as RFCOMM Client.
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
            // Cancel discovery before connecting to prevent bandwidth and connection speed degradation
            stopDiscovery()

            try {
                Log.d(TAG, "Creating RFCOMM socket to device: $deviceName (${device.address})")
                val socket = device.createRfcommSocketToServiceRecord(WALKIE_TALKIE_UUID)
                
                // Blocking connect call
                socket.connect()
                activeSocket = socket

                Log.i(TAG, "Successfully connected to host: $deviceName")
                withContext(Dispatchers.Main) {
                    _connectionState.value = ConnectionState.Connected(deviceName, socket)
                }
            } catch (e: IOException) {
                Log.e(TAG, "Client connection failed to $deviceName", e)
                withContext(Dispatchers.Main) {
                    _connectionState.value = ConnectionState.Error("Connection failed: ${e.localizedMessage}")
                }
            } catch (e: SecurityException) {
                Log.e(TAG, "SecurityException in connectToDevice", e)
                withContext(Dispatchers.Main) {
                    _connectionState.value = ConnectionState.Error("Bluetooth permission denied")
                }
            }
        }
    }

    /**
     * Closes any open sockets, stops listening, and cleans up resources.
     */
    fun disconnect() {
        connectionJob?.cancel()
        connectionJob = null

        try {
            serverSocket?.close()
        } catch (e: IOException) {
            Log.e(TAG, "Error closing server socket", e)
        }
        serverSocket = null

        try {
            activeSocket?.close()
        } catch (e: IOException) {
            Log.e(TAG, "Error closing active socket", e)
        }
        activeSocket = null

        _connectionState.value = ConnectionState.Disconnected
    }

    /**
     * Call when Activity or Service is destroyed.
     */
    fun release() {
        disconnect()
        try {
            context.unregisterReceiver(discoveryReceiver)
        } catch (e: IllegalArgumentException) {
            // Receiver not registered
        }
    }
}
