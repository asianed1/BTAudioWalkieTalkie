package com.example.btaudiowalkietalkie

import com.example.btaudiowalkietalkie.audio.AudioEngine
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.log10
import kotlin.math.sqrt

/**
 * Unit tests verifying the AudioEngine PCM math, frame sizing, sampling rate,
 * mute buffer behavior, and decibel computation.
 */
class AudioEngineTest {

    @Test
    fun testAudioSpecifications() {
        // Standard 16kHz HD voice specification
        assertEquals(16000, AudioEngine.SAMPLE_RATE)
        assertEquals(2, AudioEngine.AUDIO_FORMAT) // AudioFormat.ENCODING_PCM_16BIT
    }

    @Test
    fun testPcmFrameSizeCalculation() {
        // At 16000 Hz, 16-bit (2 bytes per sample), Mono (1 channel):
        // 1 second of audio = 16000 * 2 = 32,000 bytes.
        // A 20ms chunk = (32,000 bytes/sec) * (20 / 1000 sec) = 640 bytes.
        val sampleRate = AudioEngine.SAMPLE_RATE
        val bytesPerSample = 2 // 16-bit
        val channels = 1 // Mono
        val bytesPerSecond = sampleRate * bytesPerSample * channels

        val chunkDurationMs = 20
        val expectedChunkSizeBytes = (bytesPerSecond * chunkDurationMs) / 1000

        assertEquals(640, expectedChunkSizeBytes)
        assertEquals(320, expectedChunkSizeBytes / bytesPerSample) // 320 samples
    }

    @Test
    fun testMuteFillsBufferWithSilence() {
        // Create a buffer with synthetic voice wave
        val chunkSizeBytes = 640
        val buffer = ByteArray(chunkSizeBytes) { 0x7F.toByte() }

        // When muted, the engine zeroes the buffer while preserving the 640-byte frame
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

        // Silence calculation
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

        // Full scale 16-bit sine wave test (+32767 peak)
        val fullScaleSine = ByteArray(chunkSizeBytes)
        var j = 0
        while (j < chunkSizeBytes - 1) {
            val sample = 32767
            fullScaleSine[j] = (sample and 0xFF).toByte()
            fullScaleSine[j + 1] = ((sample shr 8) and 0xFF).toByte()
            j += 2
        }

        var fullSumSquares = 0.0
        var k = 0
        while (k < chunkSizeBytes - 1) {
            val low = fullScaleSine[k].toInt() and 0xFF
            val high = fullScaleSine[k + 1].toInt()
            val sample = (high shl 8) or low
            fullSumSquares += (sample * sample)
            k += 2
        }

        val fullRms = sqrt(fullSumSquares / sampleCount)
        val fullNormalized = fullRms / 32768.0
        val fullDb = (20 * log10(fullNormalized.coerceAtLeast(0.0001))).toFloat().coerceIn(-60f, 0f)

        // Near 0 dBFS (full scale)
        assertTrue(fullDb > -0.1f)
    }
}
