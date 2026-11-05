import React, { useState, useEffect, useRef } from 'react';
import { 
  Radio, 
  Smartphone, 
  Code2, 
  Layers, 
  Download, 
  Sparkles, 
  CheckCircle2, 
  RotateCcw, 
  Volume2, 
  Mic, 
  ShieldCheck, 
  Wifi, 
  Users,
  Zap,
  Cpu
} from 'lucide-react';
import { PhoneSimulator } from './components/PhoneSimulator';
import { TelemetryConsole } from './components/TelemetryConsole';
import { CodeInspector } from './components/CodeInspector';
import { TestRunner } from './components/TestRunner';
import { RadioMode, ConnectionState, DeviceInfo, AudioTelemetry, PacketLog } from './types';
import { downloadProjectZip, downloadApkDirectly } from './services/androidProjectFiles';

export default function App() {
  const [activeTab, setActiveTab] = useState<'SIMULATOR' | 'CODE' | 'TESTS' | 'ARCHITECTURE'>('SIMULATOR');

  // Dual Mode Radio State (Global or synced per device)
  const [radioMode, setRadioMode] = useState<RadioMode>('BLUETOOTH');

  // Wi-Fi Hotspot State
  const [isWifiActive, setIsWifiActive] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<string | undefined>(undefined);
  const [wifiPeers, setWifiPeers] = useState<string[]>([
    'Galaxy S24 (Peer 1)',
    'Pixel 7 Pro (Peer 2 - Field Unit)'
  ]);

  // Phone A (Host) State
  const [stateA, setStateA] = useState<ConnectionState>('disconnected');
  const [scanningA, setScanningA] = useState(false);
  const [permsA, setPermsA] = useState(true);
  const [simMicA, setSimMicA] = useState(false);
  const [telemetryA, setTelemetryA] = useState<AudioTelemetry>({
    isTransmitting: false,
    isReceiving: false,
    micMuted: false,
    outgoingDb: -60,
    incomingDb: -60,
    bytesSent: 0,
    bytesReceived: 0,
    packetsSent: 0,
    packetsReceived: 0,
    echoCancelerEnabled: true,
    noiseSuppressorEnabled: true,
    sampleRate: 16000,
    latencyMs: 32
  });

  // Phone B (Client) State
  const [stateB, setStateB] = useState<ConnectionState>('disconnected');
  const [scanningB, setScanningB] = useState(false);
  const [permsB, setPermsB] = useState(true);
  const [simMicB, setSimMicB] = useState(false);
  const [telemetryB, setTelemetryB] = useState<AudioTelemetry>({
    isTransmitting: false,
    isReceiving: false,
    micMuted: false,
    outgoingDb: -60,
    incomingDb: -60,
    bytesSent: 0,
    bytesReceived: 0,
    packetsSent: 0,
    packetsReceived: 0,
    echoCancelerEnabled: true,
    noiseSuppressorEnabled: true,
    sampleRate: 16000,
    latencyMs: 32
  });

  const [discoveredByA, setDiscoveredByA] = useState<DeviceInfo[]>([]);
  const [discoveredByB, setDiscoveredByB] = useState<DeviceInfo[]>([]);

  // Logs
  const [logs, setLogs] = useState<PacketLog[]>([
    {
      id: 'init-1',
      timestamp: '10:35:01.120',
      sender: 'Phone A',
      type: 'SOCKET_EVENT',
      detail: 'Dual-Mode System Ready: Bluetooth RFCOMM (1-to-1) & Wi-Fi Hotspot Multicast (Group).'
    }
  ]);

  const addLog = (sender: 'Phone A' | 'Phone B' | 'Phone C (Group)', type: PacketLog['type'], detail: string, bytes?: number) => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
    setLogs(prev => [
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: timeStr,
        sender,
        type,
        detail,
        bytes
      },
      ...prev.slice(0, 75)
    ]);
  };

  const isBtConnected = stateA === 'connected' && stateB === 'connected';

  // Audio simulation loop: runs when either Bluetooth is connected OR Wi-Fi Channel is active
  const audioIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    const isTransmittingLoop = (radioMode === 'BLUETOOTH' && isBtConnected) || (radioMode === 'WIFI_HOTSPOT' && isWifiActive);

    if (isTransmittingLoop) {
      audioIntervalRef.current = window.setInterval(() => {
        const aIsSpeaking = simMicA && !telemetryA.micMuted;
        const bIsSpeaking = simMicB && !telemetryB.micMuted;

        const levelA = aIsSpeaking ? -22 + (Math.sin(Date.now() / 140) * 8) + (Math.random() * 4) : -60;
        const levelB = bIsSpeaking ? -20 + (Math.cos(Date.now() / 160) * 7) + (Math.random() * 4) : -60;

        if (radioMode === 'WIFI_HOTSPOT') {
          if (aIsSpeaking) setActiveSpeaker('Pixel 8 Pro (You)');
          else if (bIsSpeaking) setActiveSpeaker('Galaxy S24 (Field)');
          else setActiveSpeaker(undefined);
        }

        setTelemetryA(prev => ({
          ...prev,
          isTransmitting: aIsSpeaking,
          isReceiving: bIsSpeaking,
          outgoingDb: levelA,
          incomingDb: levelB,
          bytesSent: prev.bytesSent + 640,
          bytesReceived: prev.bytesReceived + 640,
          packetsSent: prev.packetsSent + 1,
          packetsReceived: prev.packetsReceived + 1,
          latencyMs: radioMode === 'BLUETOOTH' ? 30 + Math.floor(Math.sin(Date.now() / 800) * 4) : 9 + Math.floor(Math.sin(Date.now() / 800) * 3)
        }));

        setTelemetryB(prev => ({
          ...prev,
          isTransmitting: bIsSpeaking,
          isReceiving: aIsSpeaking,
          outgoingDb: levelB,
          incomingDb: levelA,
          bytesSent: prev.bytesSent + 640,
          bytesReceived: prev.bytesReceived + 640,
          packetsSent: prev.packetsSent + 1,
          packetsReceived: prev.packetsReceived + 1,
          latencyMs: radioMode === 'BLUETOOTH' ? 31 + Math.floor(Math.cos(Date.now() / 800) * 4) : 10 + Math.floor(Math.cos(Date.now() / 800) * 3)
        }));

        if (Math.random() < 0.12) {
          if (radioMode === 'BLUETOOTH') {
            if (aIsSpeaking) addLog('Phone A', 'PCM_AUDIO_CHUNK', 'AudioRecord 640 B -> BluetoothSocket.outputStream.write()', 640);
            if (bIsSpeaking) addLog('Phone B', 'PCM_AUDIO_CHUNK', 'AudioRecord 640 B -> BluetoothSocket.outputStream.write()', 640);
          } else {
            if (aIsSpeaking) addLog('Phone A', 'WIFI_MULTICAST', 'Multicast UDP datagram broadcast to 239.255.0.1:50005 (Channel 1)', 654);
            if (bIsSpeaking) addLog('Phone B', 'WIFI_MULTICAST', 'Multicast UDP datagram broadcast to 239.255.0.1:50005 (Channel 1)', 654);
          }
        }
      }, 100);
    } else {
      if (audioIntervalRef.current) {
        clearInterval(audioIntervalRef.current);
        audioIntervalRef.current = null;
      }
    }

    return () => {
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    };
  }, [radioMode, isBtConnected, isWifiActive, simMicA, simMicB, telemetryA.micMuted, telemetryB.micMuted]);

  // Mode Selection Handler
  const handleSelectRadioMode = (newMode: RadioMode) => {
    if (newMode === radioMode) return;

    // Disconnect active states
    setStateA('disconnected');
    setStateB('disconnected');
    setIsWifiActive(false);
    setSimMicA(false);
    setSimMicB(false);
    setRadioMode(newMode);

    if (newMode === 'BLUETOOTH') {
      addLog('Phone A', 'SOCKET_EVENT', 'Switched to Bluetooth Mode: Low power, short range (~25m), 2 persons.');
    } else {
      addLog('Phone A', 'SOCKET_EVENT', 'Switched to Wi-Fi Hotspot Mode: High power, long range (~100m), 2–10 phones.');
    }
  };

  // Bluetooth Actions
  const handleHostA = () => {
    setStateA('listening');
    addLog('Phone A', 'RFCOMM_HANDSHAKE', 'Opened RFCOMM server socket (UUID 00001101-0000-1000-8000-00805F9B34FB).');
  };

  const handleScanB = () => {
    setScanningB(true);
    addLog('Phone B', 'SOCKET_EVENT', 'Scanning for nearby Bluetooth peers (BLUETOOTH_SCAN)...');
    setTimeout(() => {
      setScanningB(false);
      setDiscoveredByB([
        { name: 'Pixel 8 Pro (Walkie-Talkie Host)', address: '78:2B:46:9A:12:34', isPaired: false, rssi: -56 }
      ]);
      addLog('Phone B', 'SOCKET_EVENT', 'Found "Pixel 8 Pro (Walkie-Talkie Host)".');
    }, 1000);
  };

  const handleConnectBToA = (device: DeviceInfo) => {
    setStateB('connecting');
    addLog('Phone B', 'RFCOMM_HANDSHAKE', `Connecting RFCOMM socket to ${device.address}...`);
    setTimeout(() => {
      setStateA('connected');
      setStateB('connected');
      setSimMicA(true);
      addLog('Phone A', 'RFCOMM_HANDSHAKE', 'Accepted incoming Bluetooth socket. Full-duplex link established.');
      addLog('Phone B', 'AEC_FILTER', 'Hardware AcousticEchoCanceler enabled on AudioRecord session.');
    }, 800);
  };

  const handleQuickConnectBt = () => {
    setRadioMode('BLUETOOTH');
    setStateA('connected');
    setStateB('connected');
    setSimMicA(true);
    addLog('Phone A', 'RFCOMM_HANDSHAKE', 'Auto-connected 1-to-1 Bluetooth RFCOMM session.');
  };

  const handleDisconnectBt = () => {
    setStateA('disconnected');
    setStateB('disconnected');
    setSimMicA(false);
    setSimMicB(false);
    addLog('Phone A', 'SOCKET_EVENT', 'BluetoothSocket closed. Threads terminated.');
    addLog('Phone B', 'SOCKET_EVENT', 'BluetoothSocket closed.');
  };

  // Wi-Fi Actions
  const handleStartWifiChannel = () => {
    setIsWifiActive(true);
    setSimMicA(true);
    addLog('Phone A', 'WIFI_MULTICAST', 'Joined Wi-Fi Hotspot Channel 1. Multicast lock acquired.');
    addLog('Phone B', 'WIFI_HEARTBEAT', 'Phone B joined Channel 1 on UDP port 50005. 3 phones online in group.');
  };

  const handleStopWifiChannel = () => {
    setIsWifiActive(false);
    setSimMicA(false);
    setSimMicB(false);
    setActiveSpeaker(undefined);
    addLog('Phone A', 'WIFI_MULTICAST', 'Left Wi-Fi Hotspot Channel 1. Multicast lock released.');
  };

  const handleSimulateInterference = () => {
    addLog('Phone A', 'SOCKET_EVENT', 'Injected jitter/packet loss. Jitter buffer compensated; audio recovered.');
    setTelemetryA(prev => ({ ...prev, latencyMs: 95 }));
    setTelemetryB(prev => ({ ...prev, latencyMs: 95 }));
    setTimeout(() => {
      setTelemetryA(prev => ({ ...prev, latencyMs: radioMode === 'BLUETOOTH' ? 32 : 12 }));
      setTelemetryB(prev => ({ ...prev, latencyMs: radioMode === 'BLUETOOTH' ? 32 : 12 }));
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500/30 selection:text-sky-200">
      
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 via-teal-400 to-emerald-400 p-0.5 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                {radioMode === 'BLUETOOTH' ? (
                  <Radio className="w-5 h-5 text-sky-400" />
                ) : (
                  <Wifi className="w-5 h-5 text-emerald-400" />
                )}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight">
                  BTAudioWalkieTalkie
                </h1>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-gradient-to-r from-sky-500/10 to-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Dual-Mode (BT + Wi-Fi)
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Peer-to-Peer Voice System: Bluetooth (1-to-1) &amp; Wi-Fi Hotspot (Group)
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('SIMULATOR')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                activeTab === 'SIMULATOR'
                  ? 'bg-slate-800 text-sky-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Dual-Device Simulator
            </button>

            <button
              onClick={() => setActiveTab('CODE')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                activeTab === 'CODE'
                  ? 'bg-slate-800 text-sky-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              Android Studio Project
            </button>

            <button
              onClick={() => setActiveTab('TESTS')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                activeTab === 'TESTS'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Test Suite (10/10)
            </button>

            <button
              onClick={() => setActiveTab('ARCHITECTURE')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                activeTab === 'ARCHITECTURE'
                  ? 'bg-slate-800 text-sky-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Radio Architecture
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadApkDirectly()}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition"
              title="Download installable BTAudioWalkieTalkie.apk"
            >
              <Download className="w-3.5 h-3.5" />
              Download APK (.apk)
            </button>

            <button
              onClick={() => downloadProjectZip()}
              className="hidden sm:flex px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              Project (.ZIP)
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* TAB 1: DUAL-DEVICE SIMULATOR */}
        {activeTab === 'SIMULATOR' && (
          <div className="flex flex-col gap-6">
            
            {/* Global Radio Mode Selector Bar */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${
                  (radioMode === 'BLUETOOTH' ? isBtConnected : isWifiActive)
                    ? 'bg-emerald-400 shadow-lg shadow-emerald-500/50 animate-pulse'
                    : 'bg-slate-600'
                }`} />
                <div>
                  <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                    {radioMode === 'BLUETOOTH' ? (
                      isBtConnected ? (
                        <span className="text-sky-400">Bluetooth Mode: 1-to-1 Full-Duplex Link Active (~25m)</span>
                      ) : (
                        <span className="text-slate-300">Bluetooth Mode: Low Power · Short Range · 2 Persons</span>
                      )
                    ) : (
                      isWifiActive ? (
                        <span className="text-emerald-400">Wi-Fi Hotspot Mode: Channel 1 Active (Group Intercom, ~100m)</span>
                      ) : (
                        <span className="text-slate-300">Wi-Fi Hotspot Mode: High Power · Long Range · 2–10 Phones</span>
                      )
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {radioMode === 'BLUETOOTH' 
                      ? 'Serial Port Profile (UUID 00001101-...) · 16kHz 16-bit PCM (256 kbps)'
                      : 'UDP Multicast (239.255.0.1:50005) · No cellular/internet needed · All-phone broadcast'}
                  </div>
                </div>
              </div>

              {/* Mode Quick-Toggle Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSelectRadioMode('BLUETOOTH')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                    radioMode === 'BLUETOOTH'
                      ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5" />
                  Bluetooth Mode
                </button>

                <button
                  onClick={() => handleSelectRadioMode('WIFI_HOTSPOT')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                    radioMode === 'WIFI_HOTSPOT'
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Wifi className="w-3.5 h-3.5" />
                  Wi-Fi Hotspot Mode
                </button>

                {radioMode === 'BLUETOOTH' && !isBtConnected && (
                  <button
                    onClick={handleQuickConnectBt}
                    className="ml-2 px-3 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                    Quick Connect BT
                  </button>
                )}

                {radioMode === 'WIFI_HOTSPOT' && !isWifiActive && (
                  <button
                    onClick={handleStartWifiChannel}
                    className="ml-2 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    Join All to Channel 1
                  </button>
                )}
              </div>
            </div>

            {/* Side-by-Side Smartphone Mockups */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center justify-center p-4 bg-slate-900/40 border border-slate-800/80 rounded-3xl">
              
              {/* Phone A */}
              <div className="flex flex-col items-center">
                <div className="mb-2 text-xs font-semibold text-sky-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  Device 1 (Pixel 8 Pro)
                </div>
                <PhoneSimulator
                  deviceName="Pixel 8 Pro"
                  deviceModel="Google Pixel 8 Pro"
                  macAddress="78:2B:46:9A:12:34"
                  themeColor="blue"
                  currentMode={radioMode}
                  onSelectMode={handleSelectRadioMode}
                  connectionState={stateA}
                  remotePeerName="Galaxy S24"
                  pairedDevices={[
                    { name: 'Galaxy S24', address: '9C:64:5E:28:FE:8B', isPaired: true }
                  ]}
                  discoveredDevices={discoveredByA}
                  isScanning={scanningA}
                  hasPermissions={permsA}
                  telemetry={telemetryA}
                  isSimulatingMicInput={simMicA}
                  isWifiActive={isWifiActive}
                  onlinePeers={wifiPeers}
                  activeSpeaker={activeSpeaker}
                  onRequestPermissions={() => setPermsA(true)}
                  onHost={handleHostA}
                  onScan={() => {
                    setScanningA(true);
                    setTimeout(() => setScanningA(false), 1500);
                  }}
                  onConnect={(device) => {
                    setStateA('connecting');
                    setTimeout(() => {
                      setStateA('connected');
                      setStateB('connected');
                    }, 800);
                  }}
                  onDisconnectBt={handleDisconnectBt}
                  onToggleMuteBt={() => {
                    setTelemetryA(prev => ({ ...prev, micMuted: !prev.micMuted }));
                    addLog('Phone A', 'AUDIO', `Microphone ${telemetryA.micMuted ? 'UNMUTED' : 'MUTED'}`);
                  }}
                  onStartWifiChannel={handleStartWifiChannel}
                  onStopWifiChannel={handleStopWifiChannel}
                  onToggleMuteWifi={() => {
                    setTelemetryA(prev => ({ ...prev, micMuted: !prev.micMuted }));
                    addLog('Phone A', 'AUDIO', `Wi-Fi Mic ${telemetryA.micMuted ? 'UNMUTED' : 'MUTED'}`);
                  }}
                  onToggleMicSimulation={() => setSimMicA(!simMicA)}
                />
              </div>

              {/* Phone B */}
              <div className="flex flex-col items-center">
                <div className="mb-2 text-xs font-semibold text-teal-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-teal-400" />
                  Device 2 (Galaxy S24)
                </div>
                <PhoneSimulator
                  deviceName="Galaxy S24"
                  deviceModel="Samsung Galaxy S24"
                  macAddress="9C:64:5E:28:FE:8B"
                  themeColor="indigo"
                  currentMode={radioMode}
                  onSelectMode={handleSelectRadioMode}
                  connectionState={stateB}
                  remotePeerName="Pixel 8 Pro"
                  pairedDevices={[
                    { name: 'Pixel 8 Pro (Walkie-Talkie Host)', address: '78:2B:46:9A:12:34', isPaired: true }
                  ]}
                  discoveredDevices={discoveredByB}
                  isScanning={scanningB}
                  hasPermissions={permsB}
                  telemetry={telemetryB}
                  isSimulatingMicInput={simMicB}
                  isWifiActive={isWifiActive}
                  onlinePeers={['Pixel 8 Pro (Host)', 'Pixel 7 Pro (Field Unit)']}
                  activeSpeaker={activeSpeaker}
                  onRequestPermissions={() => setPermsB(true)}
                  onHost={() => {
                    setStateB('listening');
                    addLog('Phone B', 'RFCOMM_HANDSHAKE', 'Opened RFCOMM server socket on Galaxy S24.');
                  }}
                  onScan={handleScanB}
                  onConnect={handleConnectBToA}
                  onDisconnectBt={handleDisconnectBt}
                  onToggleMuteBt={() => {
                    setTelemetryB(prev => ({ ...prev, micMuted: !prev.micMuted }));
                    addLog('Phone B', 'AUDIO', `Microphone ${telemetryB.micMuted ? 'UNMUTED' : 'MUTED'}`);
                  }}
                  onStartWifiChannel={handleStartWifiChannel}
                  onStopWifiChannel={handleStopWifiChannel}
                  onToggleMuteWifi={() => {
                    setTelemetryB(prev => ({ ...prev, micMuted: !prev.micMuted }));
                    addLog('Phone B', 'AUDIO', `Wi-Fi Mic ${telemetryB.micMuted ? 'UNMUTED' : 'MUTED'}`);
                  }}
                  onToggleMicSimulation={() => setSimMicB(!simMicB)}
                />
              </div>

            </div>

            {/* Real-time Telemetry & Socket Console */}
            <TelemetryConsole
              telemetryA={telemetryA}
              telemetryB={telemetryB}
              isConnected={isBtConnected}
              isWifiActive={isWifiActive}
              radioMode={radioMode}
              onlinePeersCount={wifiPeers.length + 1}
              logs={logs}
              onSimulateInterference={handleSimulateInterference}
              onClearLogs={() => setLogs([])}
            />

          </div>
        )}

        {/* TAB 2: CODE INSPECTOR & ZIP EXPORTER */}
        {activeTab === 'CODE' && (
          <CodeInspector />
        )}

        {/* TAB 3: TEST SUITE */}
        {activeTab === 'TESTS' && (
          <TestRunner />
        )}

        {/* TAB 4: ARCHITECTURE & RADIO MODES EXPLANATION */}
        {activeTab === 'ARCHITECTURE' && (
          <div className="flex flex-col gap-6">
            
            <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800">
              <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Layers className="w-5 h-5 text-sky-400" />
                Dual-Mode Radio Architecture (Bluetooth vs. Wi-Fi Hotspot)
              </h2>
              <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
                BTAudioWalkieTalkie implements an adaptive dual-radio transport architecture. Users can toggle between short-range, ultra-low-power Bluetooth for two people, or long-range, multi-party Wi-Fi Hotspot LAN communication for groups.
              </p>
            </div>

            {/* Comparison Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Bluetooth */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-sky-500/30 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
                  <Radio className="w-4 h-4" />
                  Mode 1: Bluetooth (2 Persons, Low Power)
                </div>
                <div className="text-xs text-slate-300">
                  <strong>Transport:</strong> Bluetooth RFCOMM SPP (UUID 00001101-0000-1000-8000-00805F9B34FB)
                </div>
                <ul className="text-[11px] text-slate-400 space-y-1 list-disc list-inside">
                  <li><strong>Range:</strong> ~25–35 meters line-of-sight outdoors</li>
                  <li><strong>Capacity:</strong> Strict 1-to-1 point-to-point (Server socket closes on accept)</li>
                  <li><strong>Power:</strong> Low consumption (~2–3% battery per hour)</li>
                  <li><strong>Audio:</strong> Uncompressed 16kHz 16-bit PCM Mono (256 kbps)</li>
                  <li><strong>Echo Canceler:</strong> Hardware AcousticEchoCanceler coupled to AudioRecord session</li>
                </ul>
              </div>

              {/* Card 2: Wi-Fi Hotspot */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-emerald-500/30 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <Wifi className="w-4 h-4" />
                  Mode 2: Wi-Fi Hotspot (2–10 Phones, Long Range)
                </div>
                <div className="text-xs text-slate-300">
                  <strong>Transport:</strong> Local UDP Multicast (239.255.0.1:50005) or Subnet Broadcast
                </div>
                <ul className="text-[11px] text-slate-400 space-y-1 list-disc list-inside">
                  <li><strong>Range:</strong> ~70–100+ meters outdoors (penetrates 2–3 interior walls)</li>
                  <li><strong>Capacity:</strong> 2 to 10+ phones simultaneously on Channel 1</li>
                  <li><strong>Power:</strong> High consumption on host (~15% battery per hour)</li>
                  <li><strong>Zero Data:</strong> Operates entirely on offline local Wi-Fi LAN; 0 cellular data used</li>
                  <li><strong>Multicast Lock:</strong> Uses WifiManager.MulticastLock to prevent packet dropping</li>
                </ul>
              </div>
            </div>

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>BTAudioWalkieTalkie • Dual-Mode Android Application &amp; Testbench</span>
          <div className="flex items-center gap-3">
            <button onClick={() => downloadApkDirectly()} className="text-emerald-400 hover:text-emerald-300 font-semibold transition">
              Download .APK
            </button>
            <span>•</span>
            <button onClick={() => downloadProjectZip()} className="text-sky-400 hover:text-sky-300 transition">
              Export Project (.ZIP)
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
}
