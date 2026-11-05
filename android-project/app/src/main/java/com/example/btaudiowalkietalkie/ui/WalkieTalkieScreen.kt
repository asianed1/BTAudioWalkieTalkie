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
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material.icons.filled.WifiTethering
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
import com.example.btaudiowalkietalkie.wifi.WifiChannelState

enum class AppRadioMode {
    BLUETOOTH,
    WIFI_HOTSPOT
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WalkieTalkieScreen(
    currentMode: AppRadioMode,
    onSelectMode: (AppRadioMode) -> Unit,
    // Bluetooth State
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
    onDisconnectBt: () -> Unit,
    onToggleMuteBt: () -> Unit,
    // Wi-Fi State
    wifiState: WifiChannelState,
    onStartWifiChannel: (Int) -> Unit,
    onStopWifiChannel: () -> Unit,
    onToggleMuteWifi: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = if (currentMode == AppRadioMode.BLUETOOTH) Icons.Default.Radio else Icons.Default.WifiTethering,
                            contentDescription = null,
                            tint = if (currentMode == AppRadioMode.BLUETOOTH) MaterialTheme.colorScheme.primary else Color(0xFF10B981),
                            modifier = Modifier.size(26.dp)
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                text = "BTAudioWalkieTalkie",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = if (currentMode == AppRadioMode.BLUETOOTH) "Bluetooth Direct (1-to-1)" else "Wi-Fi Hotspot LAN (Group Channel)",
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
                    if (currentMode == AppRadioMode.BLUETOOTH && connectionState is ConnectionState.Connected) {
                        IconButton(onClick = onDisconnectBt) {
                            Icon(Icons.Default.CallEnd, contentDescription = "Disconnect", tint = MaterialTheme.colorScheme.error)
                        }
                    } else if (currentMode == AppRadioMode.WIFI_HOTSPOT && wifiState.isActive) {
                        IconButton(onClick = onStopWifiChannel) {
                            Icon(Icons.Default.CallEnd, contentDescription = "Leave Channel", tint = MaterialTheme.colorScheme.error)
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
                .padding(14.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Permission Banner if missing
            if (!hasPermissions) {
                Card(
                    modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)
                ) {
                    Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Warning, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                        Spacer(modifier = Modifier.width(10.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Permissions Needed", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            Text("Microphone and Wireless permissions required.", style = MaterialTheme.typography.bodySmall)
                        }
                        Button(onClick = onRequestPermissions) {
                            Text("Grant", fontSize = 12.sp)
                        }
                    }
                }
            }

            // Radio Mode Selector (Bluetooth vs Wi-Fi Hotspot)
            RadioModeSelector(
                selectedMode = currentMode,
                onModeSelected = onSelectMode,
                isBtConnected = connectionState is ConnectionState.Connected,
                isWifiActive = wifiState.isActive
            )

            Spacer(modifier = Modifier.height(14.dp))

            // Content switch based on chosen radio mode
            if (currentMode == AppRadioMode.BLUETOOTH) {
                // BLUETOOTH VIEW
                ConnectionStatusCard(connectionState)
                Spacer(modifier = Modifier.height(14.dp))

                when (connectionState) {
                    is ConnectionState.Connected -> {
                        ActiveCallView(
                            peerName = connectionState.deviceName,
                            metrics = audioMetrics ?: AudioMetrics(),
                            onToggleMute = onToggleMuteBt,
                            onDisconnect = onDisconnectBt
                        )
                    }
                    is ConnectionState.Listening -> {
                        HostListeningView(onCancel = onDisconnectBt)
                    }
                    is ConnectionState.Connecting -> {
                        ConnectingView(deviceName = connectionState.deviceName, onCancel = onDisconnectBt)
                    }
                    else -> {
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
            } else {
                // WI-FI HOTSPOT VIEW
                WifiHotspotChannelView(
                    state = wifiState,
                    onStartChannel = onStartWifiChannel,
                    onStopChannel = onStopWifiChannel,
                    onToggleMute = onToggleMuteWifi
                )
            }
        }
    }
}

@Composable
fun RadioModeSelector(
    selectedMode: AppRadioMode,
    onModeSelected: (AppRadioMode) -> Unit,
    isBtConnected: Boolean,
    isWifiActive: Boolean
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(modifier = Modifier.padding(10.dp)) {
            Text(
                text = "RADIO LINK MODE",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.outline,
                letterSpacing = 1.sp
            )
            Spacer(modifier = Modifier.height(6.dp))

            // Option 1: Bluetooth
            ModeOptionRow(
                title = "Bluetooth",
                subtitle = "Low power consumption · Short range (~25m) · 2 persons",
                icon = Icons.Default.Bluetooth,
                isSelected = selectedMode == AppRadioMode.BLUETOOTH,
                onClick = { if (!isWifiActive) onModeSelected(AppRadioMode.BLUETOOTH) }
            )

            Spacer(modifier = Modifier.height(6.dp))

            // Option 2: Wi-Fi Hotspot
            ModeOptionRow(
                title = "Wi-Fi Hotspot",
                subtitle = "High power consumption · Long range (~100m) · 2–10 phones",
                icon = Icons.Default.Wifi,
                isSelected = selectedMode == AppRadioMode.WIFI_HOTSPOT,
                onClick = { if (!isBtConnected) onModeSelected(AppRadioMode.WIFI_HOTSPOT) }
            )
        }
    }
}

@Composable
fun ModeOptionRow(
    title: String,
    subtitle: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(if (isSelected) MaterialTheme.colorScheme.surfaceContainerHigh else Color.Transparent)
            .clickable(onClick = onClick)
            .padding(8.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(16.dp)
                    .clip(CircleShape)
                    .background(if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant),
                contentAlignment = Alignment.Center
            ) {
                if (isSelected) {
                    Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(Color.White))
                }
            }
            Spacer(modifier = Modifier.width(10.dp))
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(10.dp))
            Column {
                Text(text = title, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                Text(text = subtitle, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
fun WifiHotspotChannelView(
    state: WifiChannelState,
    onStartChannel: (Int) -> Unit,
    onStopChannel: () -> Unit,
    onToggleMute: () -> Unit
) {
    if (!state.isActive) {
        // Setup Channel View
        Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.SpaceBetween) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh)
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text("How Wi-Fi Hotspot Mode Works:", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    Spacer(modifier = Modifier.height(6.dp))
                    Text("1. One person turns on Android Portable Hotspot (Settings ➔ Hotspot).", fontSize = 11.sp, color = MaterialTheme.colorScheme.outline)
                    Text("2. Other phones connect to that Wi-Fi network (No internet needed).", fontSize = 11.sp, color = MaterialTheme.colorScheme.outline)
                    Text("3. All phones tap 'Join Channel 1' below to voice talk together!", fontSize = 11.sp, color = MaterialTheme.colorScheme.outline)
                }
            }

            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(vertical = 24.dp)) {
                Icon(Icons.Default.WifiTethering, contentDescription = null, modifier = Modifier.size(64.dp), tint = Color(0xFF10B981))
                Spacer(modifier = Modifier.height(14.dp))
                Text("Group Channel 1 (Alpha Team)", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Text("UDP Multicast Broadcast · Port 50005 · 16kHz PCM", fontSize = 11.sp, color = MaterialTheme.colorScheme.outline)
            }

            Button(
                onClick = { onStartChannel(1) },
                modifier = Modifier.fillMaxWidth().height(50.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981))
            ) {
                Icon(Icons.Default.Wifi, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Join / Start Group Channel", fontWeight = FontWeight.Bold)
            }
        }
    } else {
        // Active Wi-Fi Group Channel View
        Column(modifier = Modifier.fillMaxSize()) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF064E3B))
            ) {
                Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.WifiTethering, contentDescription = null, tint = Color(0xFF34D399))
                    Spacer(modifier = Modifier.width(10.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Active on Channel ${state.channelNumber} (Wi-Fi LAN)", fontWeight = FontWeight.Bold, color = Color.White)
                        Text("${state.onlinePeerCount} Phones in Group · Range: ~100m", fontSize = 11.sp, color = Color(0xFFA7F3D0))
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Online Group Members
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text("Group Members Online (${state.onlinePeerCount}):", fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text("• This Phone (You)", fontSize = 11.sp, color = MaterialTheme.colorScheme.primary)
                    state.onlinePeers.forEach { peer ->
                        Text("• $peer", fontSize = 11.sp, color = Color(0xFF10B981))
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Audio Level Indicators
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                AudioLevelIndicator(
                    label = "Microphone (Tx)",
                    icon = if (state.isMuted) Icons.Default.MicOff else Icons.Default.Mic,
                    levelDb = state.outgoingDb,
                    isActive = !state.isMuted,
                    modifier = Modifier.weight(1f)
                )
                AudioLevelIndicator(
                    label = if (state.activeSpeaker != null) state.activeSpeaker!! else "Channel Audio (Rx)",
                    icon = Icons.Default.VolumeUp,
                    levelDb = state.incomingDb,
                    isActive = state.isReceiving,
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(modifier = Modifier.weight(1f))

            // Big PTT Button for Wi-Fi Channel
            Box(
                modifier = Modifier
                    .size(130.dp)
                    .align(Alignment.CenterHorizontally)
                    .clip(CircleShape)
                    .background(if (state.isMuted) MaterialTheme.colorScheme.errorContainer else Color(0xFF10B981))
                    .clickable { onToggleMute() },
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        imageVector = if (state.isMuted) Icons.Default.MicOff else Icons.Default.Mic,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(46.dp)
                    )
                    Text(
                        text = if (state.isMuted) "MIC MUTED" else "MIC LIVE",
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        fontSize = 12.sp
                    )
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            Button(
                onClick = onStopChannel,
                modifier = Modifier.fillMaxWidth().height(46.dp),
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
            ) {
                Icon(Icons.Default.CallEnd, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Leave Group Channel")
            }
        }
    }
}

// Re-use Bluetooth subviews below:
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
        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(modifier = Modifier.size(10.dp).clip(CircleShape).background(statusColor))
            Spacer(modifier = Modifier.width(8.dp))
            Text(text = statusText, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
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
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Button(
                onClick = onHostClicked,
                modifier = Modifier.weight(1f).height(46.dp),
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
            ) {
                Icon(Icons.Default.Bluetooth, contentDescription = null)
                Spacer(modifier = Modifier.width(6.dp))
                Text("Host Connection", fontSize = 12.sp)
            }
            Button(
                onClick = onScanClicked,
                modifier = Modifier.weight(1f).height(46.dp),
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary)
            ) {
                if (isScanning) {
                    CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White, strokeWidth = 2.dp)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Scanning...", fontSize = 12.sp)
                } else {
                    Icon(Icons.Default.BluetoothSearching, contentDescription = null)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Scan & Discover", fontSize = 12.sp)
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            item {
                Text("Paired Devices", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
            }
            if (pairedDevices.isEmpty()) {
                item {
                    Text("No paired devices found.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.outline)
                }
            } else {
                items(pairedDevices) { device ->
                    DeviceRowItem(device = device, isPaired = true, onConnect = { onConnectDevice(device) })
                }
            }
            item {
                Spacer(modifier = Modifier.height(8.dp))
                Text("Discovered Nearby", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.secondary, fontWeight = FontWeight.Bold)
            }
            if (discoveredDevices.isEmpty()) {
                item {
                    Text(if (isScanning) "Searching..." else "Tap 'Scan & Discover' above.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.outline)
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
        modifier = Modifier.fillMaxWidth().clickable(onClick = onConnect),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh)
    ) {
        Row(modifier = Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.Bluetooth, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
            Spacer(modifier = Modifier.width(10.dp))
            Column(modifier = Modifier.weight(1f)) {
                @Suppress("MissingPermission")
                val name = try { device.name ?: device.address } catch (e: Exception) { "Bluetooth Device" }
                Text(text = name, fontWeight = FontWeight.Medium, fontSize = 13.sp)
                Text(text = device.address, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.outline, fontSize = 11.sp)
            }
            Button(onClick = onConnect, modifier = Modifier.height(34.dp)) {
                Text("Connect", fontSize = 11.sp)
            }
        }
    }
}

@Composable
fun HostListeningView(onCancel: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Box(
            modifier = Modifier.size(100.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primaryContainer),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Default.Radio, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(46.dp))
        }
        Spacer(modifier = Modifier.height(20.dp))
        Text("Listening as RFCOMM Server", fontWeight = FontWeight.Bold)
        Text("UUID: 00001101-0000-1000-8000-00805F9B34FB\nHave the second phone connect to this device.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.outline, modifier = Modifier.padding(top = 6.dp))
        Spacer(modifier = Modifier.height(24.dp))
        Button(onClick = onCancel, colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)) {
            Text("Stop Hosting")
        }
    }
}

@Composable
fun ConnectingView(deviceName: String, onCancel: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        CircularProgressIndicator(modifier = Modifier.size(48.dp))
        Spacer(modifier = Modifier.height(16.dp))
        Text("Connecting to $deviceName...", fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(24.dp))
        Button(onClick = onCancel) { Text("Cancel") }
    }
}

@Composable
fun ActiveCallView(
    peerName: String,
    metrics: AudioMetrics,
    onToggleMute: () -> Unit,
    onDisconnect: () -> Unit
) {
    Column(modifier = Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
        ) {
            Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.BluetoothConnected, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                Spacer(modifier = Modifier.width(10.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text("Linked with $peerName", fontWeight = FontWeight.Bold)
                    Text("Full-Duplex (Simultaneous Send & Receive)", style = MaterialTheme.typography.bodySmall, fontSize = 11.sp)
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
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

        Box(
            modifier = Modifier
                .size(130.dp)
                .clip(CircleShape)
                .background(if (metrics.isMuted) MaterialTheme.colorScheme.errorContainer else MaterialTheme.colorScheme.primary)
                .clickable { onToggleMute() },
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    imageVector = if (metrics.isMuted) Icons.Default.MicOff else Icons.Default.Mic,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(46.dp)
                )
                Text(
                    text = if (metrics.isMuted) "MIC MUTED" else "MIC LIVE",
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    fontSize = 12.sp
                )
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        Button(
            onClick = onDisconnect,
            modifier = Modifier.fillMaxWidth().height(46.dp),
            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
        ) {
            Icon(Icons.Default.CallEnd, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("End Bluetooth Link")
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
        Column(modifier = Modifier.padding(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(icon, contentDescription = null, modifier = Modifier.size(16.dp), tint = MaterialTheme.colorScheme.primary)
                Spacer(modifier = Modifier.width(6.dp))
                Text(label, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            }
            Spacer(modifier = Modifier.height(8.dp))
            val normalized = if (!isActive) 0f else ((levelDb + 60f) / 60f).coerceIn(0f, 1f)
            Box(
                modifier = Modifier.fillMaxWidth().height(10.dp).clip(RoundedCornerShape(5.dp)).background(MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Box(
                    modifier = Modifier.fillMaxWidth(normalized).height(10.dp).clip(RoundedCornerShape(5.dp)).background(if (normalized > 0.8f) Color(0xFFEF4444) else Color(0xFF10B981))
                )
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(text = "${levelDb.toInt()} dBFS", style = MaterialTheme.typography.labelSmall, fontFamily = FontFamily.Monospace, color = MaterialTheme.colorScheme.outline)
        }
    }
}
