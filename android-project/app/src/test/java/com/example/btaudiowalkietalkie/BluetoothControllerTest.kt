package com.example.btaudiowalkietalkie

import com.example.btaudiowalkietalkie.bluetooth.BluetoothController
import com.example.btaudiowalkietalkie.bluetooth.ConnectionState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.UUID

/**
 * Unit tests verifying Bluetooth SPP UUID compliance and state transitions.
 */
class BluetoothControllerTest {

    @Test
    fun testStandardSppUuidMatchesBluetoothSigSpec() {
        // Bluetooth SIG standard SPP (Serial Port Profile) UUID
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
}
