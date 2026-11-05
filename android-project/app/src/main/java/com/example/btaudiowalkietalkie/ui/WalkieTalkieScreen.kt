package com.example.btaudiowalkietalkie.ui

import android.bluetooth.BluetoothDevice
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bluetooth
import androidx.compose.material.icons.filled.BluetoothConnected
import androidx.compose.material.icons.filled.BluetoothSearching
import androidx.compose.material.icons.filled.CallEnd
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material.icons.filled.Radio
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.btaudiowalkietalkie.audio.AudioMetrics
import com.example.btaudiowalkietalkie.bluetooth.ConnectionState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WalkieTalkieScreen(
    connectionState: ConnectionState,
    pairedDevices: List<BluetoothDevice>,
    discoveredDevices: List<BluetoothDevice>,
    isScanning: Boolean,
    hasPermissions: Boolean,
    audioMetrics: AudioMetrics?,
    onRequestPermissions: () -> Unit,
    onScanClicked: () -> Unit,
    onHostClicked: () -> Unit,
    onConnectDevice: (BluetoothDevice) -> Unit,
    onDisconnect: () -> Unit,
    onToggleMute: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Radio,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(28.dp)
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = "BTAudioWalkieTalkie",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "RFCOMM 16kHz Full-Duplex PCM",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surfaceContainer
                ),
                actions = {
                    if (connectionState is ConnectionState.Connected) {
                        IconButton(onClick = onDisconnect) {
                            Icon(
                                imageVector = Icons.Default.CallEnd,
                                contentDescription = "Disconnect",
                                tint = MaterialTheme.colorScheme.error
                            )
                        }
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Permission Banner if missing
            if (!hasPermissions) {
                Card(
                    modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.Warning, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Permissions Required", fontWeight = FontWeight.SemiBold)
                            Text("Microphone and Bluetooth Scan/Connect permissions are needed.", style = MaterialTheme.typography.bodySmall)
                        }
                        Button(onClick = onRequestPermissions) {
                            Text("Grant")
                        }
                    }
                }
            }

            // Connection Status Banner
            ConnectionStatusCard(connectionState)

            Spacer(modifier = Modifier.height(16.dp))

            when (connectionState) {
                is ConnectionState.Connected -> {
                    // Active Full-Duplex Talk Dashboard
                    ActiveCallView(
                        peerName = connectionState.deviceName,
                        metrics = audioMetrics ?: AudioMetrics(),
                        onToggleMute = onToggleMute,
                        onDisconnect = onDisconnect
                    )
                }
                is ConnectionState.Listening -> {
                    // Host Waiting Screen
                    HostListeningView(onCancel = onDisconnect)
                }
                is ConnectionState.Connecting -> {
                    // Connecting Screen
                    ConnectingView(deviceName = connectionState.deviceName, onCancel = onDisconnect)
                }
                else -> {
                    // Disconnected: Device Connection & Discovery Center
                    SetupConnectionView(
                        pairedDevices = pairedDevices,
                        discoveredDevices = discoveredDevices,
                        isScanning = isScanning,
                        onScanClicked = onScanClicked,
                        onHostClicked = onHostClicked,
                        onConnectDevice = onConnectDevice
                    )
                }
            }
        }
    }
}

@Composable
fun ConnectionStatusCard(state: ConnectionState) {
    val (statusText, statusColor) = when (state) {
        is ConnectionState.Connected -> "Connected: Full-Duplex Active" to Color(0xFF10B981)
        is ConnectionState.Connecting -> "Connecting to ${state.deviceName}..." to Color(0xFFF59E0B)
        is ConnectionState.Listening -> "Host Mode: Listening for peer..." to Color(0xFF3B82F6)
        is ConnectionState.Error -> "Error: ${state.message}" to MaterialTheme.colorScheme.error
        is ConnectionState.Disconnected -> "Disconnected" to MaterialTheme.colorScheme.outline
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(12.dp)
                    .clip(CircleShape)
                    .background(statusColor)
            )
            Spacer(modifier = Modifier.width(10.dp))
            Text(
                text = statusText,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
fun SetupConnectionView(
    pairedDevices: List<BluetoothDevice>,
    discoveredDevices: List<BluetoothDevice>,
    isScanning: Boolean,
    onScanClicked: () -> Unit,
    onHostClicked: () -> Unit,
    onConnectDevice: (BluetoothDevice) -> Unit
) {
    Column(modifier = Modifier.fillMaxSize()) {
        // Quick Action Buttons: Host vs Scan
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Button(
                onClick = onHostClicked,
                modifier = Modifier.weight(1f).height(50.dp),
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
            ) {
                Icon(Icons.Default.Bluetooth, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Host Connection")
            }

            Button(
                onClick = onScanClicked,
                modifier = Modifier.weight(1f).height(50.dp),
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary)
            ) {
                if (isScanning) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Scanning...")
                } else {
                    Icon(Icons.Default.BluetoothSearching, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Scan & Discover")
                }
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Device Lists
        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            item {
                Text(
                    text = "Paired Devices",
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Bold
                )
            }

            if (pairedDevices.isEmpty()) {
                item {
                    Text(
                        text = "No paired devices found. Pair in Android Settings or use Scan & Discover.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.outline
                    )
                }
            } else {
                items(pairedDevices) { device ->
                    DeviceRowItem(device = device, isPaired = true, onConnect = { onConnectDevice(device) })
                }
            }

            item {
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = "Discovered Nearby Devices",
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.secondary,
                    fontWeight = FontWeight.Bold
                )
            }

            if (discoveredDevices.isEmpty()) {
                item {
                    Text(
                        text = if (isScanning) "Searching for nearby Bluetooth RFCOMM peers..." else "Tap 'Scan & Discover' above to detect nearby devices.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.outline
                    )
                }
            } else {
                items(discoveredDevices) { device ->
                    DeviceRowItem(device = device, isPaired = false, onConnect = { onConnectDevice(device) })
                }
            }
        }
    }
}

@Composable
fun DeviceRowItem(device: BluetoothDevice, isPaired: Boolean, onConnect: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onConnect),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh)
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.Bluetooth,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                @Suppress("MissingPermission")
                val name = try { device.name ?: "Unknown Device" } catch (e: SecurityException) { "Bluetooth Device" }
                Text(text = name, fontWeight = FontWeight.Medium)
                Text(text = device.address, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.outline)
            }
            Button(
                onClick = onConnect,
                modifier = Modifier.height(36.dp)
            ) {
                Text("Connect", fontSize = 12.sp)
            }
        }
    }
}

@Composable
fun HostListeningView(onCancel: () -> Unit) {
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val scale by infiniteTransition.animateFloat(
        initialValue = 0.95f,
        targetValue = 1.08f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulseScale"
    )

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Box(
            modifier = Modifier
                .size(120.dp)
                .scale(scale)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.primaryContainer),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.Radio,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(54.dp)
            )
        }
        Spacer(modifier = Modifier.height(24.dp))
        Text(
            text = "Listening as RFCOMM Server",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = "UUID: 00001101-0000-1000-8000-00805F9B34FB\nHave the second phone scan and connect to this device.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.outline,
            modifier = Modifier.padding(top = 8.dp)
        )
        Spacer(modifier = Modifier.height(32.dp))
        Button(
            onClick = onCancel,
            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
        ) {
            Text("Stop Hosting")
        }
    }
}

@Composable
fun ConnectingView(deviceName: String, onCancel: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        CircularProgressIndicator(modifier = Modifier.size(56.dp))
        Spacer(modifier = Modifier.height(24.dp))
        Text(
            text = "Connecting to $deviceName...",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = "Establishing RFCOMM serial stream...",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.outline,
            modifier = Modifier.padding(top = 6.dp)
        )
        Spacer(modifier = Modifier.height(32.dp))
        Button(onClick = onCancel) {
            Text("Cancel")
        }
    }
}

@Composable
fun ActiveCallView(
    peerName: String,
    metrics: AudioMetrics,
    onToggleMute: () -> Unit,
    onDisconnect: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Peer Title Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(Icons.Default.BluetoothConnected, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text("Connected to $peerName", fontWeight = FontWeight.Bold)
                    Text("Full-Duplex (Simultaneous Send & Receive)", style = MaterialTheme.typography.bodySmall)
                }
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Hardware Echo Cancellation & Audio Pipeline Telemetry
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
        ) {
            Column(modifier = Modifier.padding(14.dp)) {
                Text("Hardware Audio Pipeline & Echo Cancellation", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                Spacer(modifier = Modifier.height(8.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Acoustic Echo Canceler (AEC):", style = MaterialTheme.typography.bodySmall)
                    Text(
                        if (metrics.isEchoCancelerActive) "ACTIVE (Hardware)" else "Disabled / Unsupported",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Bold,
                        color = if (metrics.isEchoCancelerActive) Color(0xFF10B981) else Color(0xFFF59E0B)
                    )
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Noise Suppressor (NS):", style = MaterialTheme.typography.bodySmall)
                    Text(
                        if (metrics.isNoiseSuppressorActive) "ACTIVE" else "Inactive",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Bold,
                        color = if (metrics.isNoiseSuppressorActive) Color(0xFF10B981) else Color.Gray
                    )
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Format / Bandwidth:", style = MaterialTheme.typography.bodySmall)
                    Text("16kHz 16-bit PCM Mono (256 kbps)", style = MaterialTheme.typography.bodySmall, fontFamily = FontFamily.Monospace)
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Bytes Transferred (Tx / Rx):", style = MaterialTheme.typography.bodySmall)
                    Text("${metrics.bytesSent / 1024} KB / ${metrics.bytesReceived / 1024} KB", style = MaterialTheme.typography.bodySmall, fontFamily = FontFamily.Monospace)
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Audio Meters (Outgoing Mic & Incoming Speaker)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            AudioLevelIndicator(
                label = "Microphone (Tx)",
                icon = if (metrics.isMuted) Icons.Default.MicOff else Icons.Default.Mic,
                levelDb = metrics.outgoingRmsDb,
                isActive = !metrics.isMuted,
                modifier = Modifier.weight(1f)
            )
            AudioLevelIndicator(
                label = "Speaker (Rx)",
                icon = Icons.Default.VolumeUp,
                levelDb = metrics.incomingRmsDb,
                isActive = metrics.isReceiving,
                modifier = Modifier.weight(1f)
            )
        }

        Spacer(modifier = Modifier.weight(1f))

        // Giant PTT / Toggle Mute Button
        val buttonColor by animateColorAsState(
            targetValue = if (metrics.isMuted) MaterialTheme.colorScheme.errorContainer else MaterialTheme.colorScheme.primary,
            label = "btnColor"
        )

        Box(
            modifier = Modifier
                .size(140.dp)
                .clip(CircleShape)
                .background(buttonColor)
                .clickable { onToggleMute() },
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    imageVector = if (metrics.isMuted) Icons.Default.MicOff else Icons.Default.Mic,
                    contentDescription = null,
                    tint = if (metrics.isMuted) MaterialTheme.colorScheme.onErrorContainer else MaterialTheme.colorScheme.onPrimary,
                    modifier = Modifier.size(50.dp)
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = if (metrics.isMuted) "MIC MUTED" else "MIC LIVE",
                    fontWeight = FontWeight.Bold,
                    color = if (metrics.isMuted) MaterialTheme.colorScheme.onErrorContainer else MaterialTheme.colorScheme.onPrimary,
                    fontSize = 13.sp
                )
            }
        }

        Text(
            text = "Tap to mute / un-mute your mic in full duplex",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.outline,
            modifier = Modifier.padding(top = 10.dp)
        )

        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = onDisconnect,
            modifier = Modifier.fillMaxWidth().height(48.dp),
            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
        ) {
            Icon(Icons.Default.CallEnd, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("End Voice Link")
        }
    }
}

@Composable
fun AudioLevelIndicator(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    levelDb: Float,
    isActive: Boolean,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(icon, contentDescription = null, modifier = Modifier.size(18.dp), tint = MaterialTheme.colorScheme.primary)
                Spacer(modifier = Modifier.width(6.dp))
                Text(label, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
            Spacer(modifier = Modifier.height(10.dp))

            // Normalized level 0.0f to 1.0f based on -60dB to 0dB
            val normalized = if (!isActive) 0f else ((levelDb + 60f) / 60f).coerceIn(0f, 1f)

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(12.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(normalized)
                        .height(12.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(if (normalized > 0.8f) Color(0xFFEF4444) else Color(0xFF10B981))
                )
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "${levelDb.toInt()} dBFS",
                style = MaterialTheme.typography.labelSmall,
                fontFamily = FontFamily.Monospace,
                color = MaterialTheme.colorScheme.outline
            )
        }
    }
}
