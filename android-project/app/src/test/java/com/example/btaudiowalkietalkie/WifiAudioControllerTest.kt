package com.example.btaudiowalkietalkie

import com.example.btaudiowalkietalkie.wifi.WifiAudioController
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.nio.ByteBuffer

class WifiAudioControllerTest {

    @Test
    fun testWifiProtocolMagicBytesAndPort() {
        assertEquals(50005, WifiAudioController.DEFAULT_PORT)
        assertEquals("239.255.0.1", WifiAudioController.MULTICAST_IP)

        // Check magic bytes "WTLK"
        val magicStr = String(WifiAudioController.MAGIC_BYTES)
        assertEquals("WTLK", magicStr)
    }

    @Test
    fun testDatagramPacketHeaderLayout() {
        val magic = WifiAudioController.MAGIC_BYTES
        val packet = ByteArray(14 + 640)
        System.arraycopy(magic, 0, packet, 0, 4)
        packet[4] = WifiAudioController.TYPE_AUDIO
        packet[5] = 1 // Channel 1

        val testDeviceId = 0x123456789ABCDEFL
        ByteBuffer.wrap(packet, 6, 8).putLong(testDeviceId)

        // Verify parsing
        assertEquals('W'.code.toByte(), packet[0])
        assertEquals('T'.code.toByte(), packet[1])
        assertEquals('L'.code.toByte(), packet[2])
        assertEquals('K'.code.toByte(), packet[3])
        assertEquals(WifiAudioController.TYPE_AUDIO, packet[4])
        assertEquals(1.toByte(), packet[5])

        val parsedId = ByteBuffer.wrap(packet, 6, 8).long
        assertEquals(testDeviceId, parsedId)
    }
}
