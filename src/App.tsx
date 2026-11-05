import React, { useState, useEffect, useRef } from 'react';
import { 
  Radio, 
  Smartphone, 
  Code2, 
  Layers, 
  Download, 
  Sparkles, 
  CheckCircle2, 
  RefreshCw, 
  Volume2, 
  Mic, 
  ShieldCheck, 
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { PhoneSimulator } from './components/PhoneSimulator';
import { TelemetryConsole } from './components/TelemetryConsole';
import { CodeInspector } from './components/CodeInspector';
import { TestRunner } from './components/TestRunner';
import { ConnectionState, DeviceInfo, AudioTelemetry, PacketLog } from './types';
import { downloadProjectZip } from './services/androidProjectFiles';

export default function App() {
  const [activeTab, setActiveTab] = useState<'SIMULATOR' | 'CODE' | 'TESTS' | 'ARCHITECTURE'>('SIMULATOR');

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

  // Discovered devices lists
  const [discoveredByA, setDiscoveredByA] = useState<DeviceInfo[]>([]);
  const [discoveredByB, setDiscoveredByB] = useState<DeviceInfo[]>([]);

  // Real-time packet logs
  const [logs, setLogs] = useState<PacketLog[]>([
    {
      id: 'init-1',
      timestamp: '10:35:01.120',
      sender: 'Phone A',
      type: 'SOCKET_EVENT',
      detail: 'BluetoothController initialized. Checking BLUETOOTH_CONNECT & RECORD_AUDIO permissions.'
    },
    {
      id: 'init-2',
      timestamp: '10:35:01.145',
      sender: 'Phone B',
      type: 'SOCKET_EVENT',
      detail: 'BluetoothController initialized. Adapter enabled.'
    }
  ]);

  const addLog = (sender: 'Phone A' | 'Phone B', type: PacketLog['type'], detail: string, bytes?: number) => {
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

  const isConnected = stateA === 'connected' && stateB === 'connected';

  // Audio simulation loop: runs when connected and transmitting
  const audioIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isConnected) {
      audioIntervalRef.current = window.setInterval(() => {
        // Phone A Voice Simulation
        const aIsSpeaking = simMicA && !telemetryA.micMuted;
        const bIsSpeaking = simMicB && !telemetryB.micMuted;

        // Generate natural vocal fluctuation between -28dB and -12dB when active, or -60dB when idle
        const levelA = aIsSpeaking ? -22 + (Math.sin(Date.now() / 140) * 8) + (Math.random() * 4) : -60;
        const levelB = bIsSpeaking ? -20 + (Math.cos(Date.now() / 160) * 7) + (Math.random() * 4) : -60;

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
          latencyMs: 30 + Math.floor(Math.sin(Date.now() / 800) * 4)
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
          latencyMs: 31 + Math.floor(Math.cos(Date.now() / 800) * 4)
        }));

        // Log audio frames periodically
        if (Math.random() < 0.15) {
          if (aIsSpeaking) {
            addLog('Phone A', 'PCM_AUDIO_CHUNK', 'AudioRecord read 640 B (20ms @ 16kHz) -> BluetoothSocket.outputStream.write()', 640);
          }
          if (bIsSpeaking) {
            addLog('Phone B', 'PCM_AUDIO_CHUNK', 'AudioRecord read 640 B (20ms @ 16kHz) -> BluetoothSocket.outputStream.write()', 640);
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
      if (audioIntervalRef.current) {
        clearInterval(audioIntervalRef.current);
      }
    };
  }, [isConnected, simMicA, simMicB, telemetryA.micMuted, telemetryB.micMuted]);

  // Phone A: Host connection
  const handleHostA = () => {
    setStateA('listening');
    addLog('Phone A', 'RFCOMM_HANDSHAKE', 'Opened RFCOMM server socket with UUID 00001101-0000-1000-8000-00805F9B34FB. Blocking accept() waiting for peer.');
  };

  // Phone B: Scan for devices
  const handleScanB = () => {
    setScanningB(true);
    addLog('Phone B', 'SOCKET_EVENT', 'Starting Bluetooth discovery (BLUETOOTH_SCAN). Listening for 2.4GHz inquiry responses.');
    setTimeout(() => {
      setScanningB(false);
      setDiscoveredByB([
        {
          name: 'Pixel 8 Pro (Walkie-Talkie Host)',
          address: '78:2B:46:9A:12:34',
          isPaired: false,
          rssi: -58
        },
        {
          name: 'Wireless Headset BT5.3',
          address: 'A4:C3:F0:11:22:33',
          isPaired: false,
          rssi: -74
        }
      ]);
      addLog('Phone B', 'SOCKET_EVENT', 'Discovery found 2 devices including "Pixel 8 Pro (Walkie-Talkie Host)".');
    }, 1200);
  };

  // Phone B connects to Phone A
  const handleConnectBToA = (device: DeviceInfo) => {
    setStateB('connecting');
    addLog('Phone B', 'RFCOMM_HANDSHAKE', `Creating RFCOMM client socket to ${device.address} with SPP UUID.`);

    setTimeout(() => {
      // Connect both
      setStateA('connected');
      setStateB('connected');
      // Enable simulation voice on phone A to show instant full-duplex demo
      setSimMicA(true);

      addLog('Phone B', 'RFCOMM_HANDSHAKE', 'RFCOMM connection established with Pixel 8 Pro.');
      addLog('Phone A', 'RFCOMM_HANDSHAKE', 'Server accepted incoming client socket. Handshake verified.');
      addLog('Phone A', 'AEC_FILTER', 'AudioEngine launched: AudioRecord(VOICE_COMMUNICATION, 16kHz, 16-bit Mono) + AcousticEchoCanceler enabled on session.');
      addLog('Phone B', 'AEC_FILTER', 'AudioEngine launched: AudioTrack(STREAM_VOICE_CALL, MODE_STREAM) started. Full-duplex voice loop active.');
    }, 900);
  };

  // One-Click Quick Connect
  const handleQuickConnect = () => {
    setStateA('connected');
    setStateB('connected');
    setSimMicA(true);
    setSimMicB(false);
    addLog('Phone A', 'RFCOMM_HANDSHAKE', 'Direct RFCOMM session established with Galaxy S24.');
    addLog('Phone B', 'RFCOMM_HANDSHAKE', 'Direct RFCOMM session established with Pixel 8 Pro.');
    addLog('Phone A', 'AEC_FILTER', 'Hardware AcousticEchoCanceler enabled on AudioRecord session.');
    addLog('Phone B', 'AEC_FILTER', 'Hardware AcousticEchoCanceler enabled on AudioRecord session.');
  };

  // Disconnect
  const handleDisconnect = () => {
    setStateA('disconnected');
    setStateB('disconnected');
    setSimMicA(false);
    setSimMicB(false);
    setTelemetryA(prev => ({ ...prev, isTransmitting: false, isReceiving: false, outgoingDb: -60, incomingDb: -60 }));
    setTelemetryB(prev => ({ ...prev, isTransmitting: false, isReceiving: false, outgoingDb: -60, incomingDb: -60 }));
    addLog('Phone A', 'SOCKET_EVENT', 'BluetoothSocket closed. AudioRecord & AudioTrack released cleanly.');
    addLog('Phone B', 'SOCKET_EVENT', 'BluetoothSocket closed. Background sender/receiver threads terminated.');
  };

  const handleSimulateInterference = () => {
    addLog('Phone A', 'SOCKET_EVENT', 'WARNING: RFCOMM buffer jitter detected (simulated interference). Latency peaked at 120ms; dropped 2 frames.');
    setTelemetryA(prev => ({ ...prev, latencyMs: 120 }));
    setTelemetryB(prev => ({ ...prev, latencyMs: 120 }));
    setTimeout(() => {
      setTelemetryA(prev => ({ ...prev, latencyMs: 32 }));
      setTelemetryB(prev => ({ ...prev, latencyMs: 32 }));
      addLog('Phone B', 'SOCKET_EVENT', 'Buffer resynced. Zero-allocation stream stabilized at 16kHz.');
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500/30 selection:text-sky-200">
      
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-teal-400 p-0.5 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Radio className="w-5 h-5 text-sky-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight">
                  BTAudioWalkieTalkie
                </h1>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  Android Kotlin
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Peer-to-Peer Full-Duplex RFCOMM Voice Communication System
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
              Audio Pipeline &amp; RFCOMM
            </button>
          </div>

          {/* Download Button */}
          <button
            onClick={() => downloadProjectZip()}
            className="hidden sm:flex px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-400 hover:to-teal-400 text-white font-semibold text-xs items-center gap-2 shadow-md shadow-sky-500/20 transition"
          >
            <Download className="w-3.5 h-3.5" />
            Download Project (.ZIP)
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* TAB 1: DUAL-PHONE SIMULATOR */}
        {activeTab === 'SIMULATOR' && (
          <div className="flex flex-col gap-6">
            
            {/* Top Quick Actions & Link Status Indicator */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${
                  isConnected ? 'bg-emerald-400 shadow-lg shadow-emerald-500/50 animate-pulse' :
                  (stateA === 'listening' || stateB === 'connecting') ? 'bg-amber-400 animate-pulse' :
                  'bg-slate-600'
                }`} />
                <div>
                  <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                    {isConnected ? (
                      <span className="text-emerald-400">Bluetooth RFCOMM Connected (Full-Duplex Voice Link Active)</span>
                    ) : stateA === 'listening' ? (
                      <span className="text-sky-400">Phone A Listening as Host • Waiting for Phone B</span>
                    ) : (
                      <span className="text-slate-400">P2P Bluetooth Link Disconnected</span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    UUID: 00001101-0000-1000-8000-00805F9B34FB • Audio: 16000Hz 16-bit Mono PCM (256 kbps)
                  </div>
                </div>
              </div>

              {/* Quick Connect / Disconnect Buttons */}
              <div className="flex items-center gap-2.5">
                {!isConnected ? (
                  <button
                    onClick={handleQuickConnect}
                    className="px-3.5 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                    1-Click Auto-Connect Phones
                  </button>
                ) : (
                  <button
                    onClick={handleDisconnect}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    Disconnect Link
                  </button>
                )}
              </div>
            </div>

            {/* Side-by-Side Smartphone Mockups */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center justify-center p-4 bg-slate-900/40 border border-slate-800/80 rounded-3xl">
              
              {/* Phone A (Host / Server) */}
              <div className="flex flex-col items-center">
                <div className="mb-2 text-xs font-semibold text-sky-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  Device 1 (Host / Server Socket)
                </div>
                <PhoneSimulator
                  deviceName="Pixel 8 Pro"
                  deviceModel="Google Pixel 8 Pro (Host)"
                  macAddress="78:2B:46:9A:12:34"
                  themeColor="blue"
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
                  onDisconnect={handleDisconnect}
                  onToggleMute={() => {
                    setTelemetryA(prev => ({ ...prev, micMuted: !prev.micMuted }));
                    addLog('Phone A', 'AUDIO', `Microphone ${telemetryA.micMuted ? 'UNMUTED' : 'MUTED'}`);
                  }}
                  onToggleMicSimulation={() => setSimMicA(!simMicA)}
                />
              </div>

              {/* Phone B (Client) */}
              <div className="flex flex-col items-center">
                <div className="mb-2 text-xs font-semibold text-teal-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-teal-400" />
                  Device 2 (Client Socket)
                </div>
                <PhoneSimulator
                  deviceName="Galaxy S24"
                  deviceModel="Samsung Galaxy S24 (Client)"
                  macAddress="9C:64:5E:28:FE:8B"
                  themeColor="indigo"
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
                  onRequestPermissions={() => setPermsB(true)}
                  onHost={() => {
                    setStateB('listening');
                    addLog('Phone B', 'RFCOMM_HANDSHAKE', 'Opened RFCOMM server socket on Galaxy S24.');
                  }}
                  onScan={handleScanB}
                  onConnect={handleConnectBToA}
                  onDisconnect={handleDisconnect}
                  onToggleMute={() => {
                    setTelemetryB(prev => ({ ...prev, micMuted: !prev.micMuted }));
                    addLog('Phone B', 'AUDIO', `Microphone ${telemetryB.micMuted ? 'UNMUTED' : 'MUTED'}`);
                  }}
                  onToggleMicSimulation={() => setSimMicB(!simMicB)}
                />
              </div>

            </div>

            {/* Real-time Telemetry & Socket Console */}
            <TelemetryConsole
              telemetryA={telemetryA}
              telemetryB={telemetryB}
              isConnected={isConnected}
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

        {/* TAB 3: AUTOMATED TEST SUITE & DIAGNOSTIC RUNNER */}
        {activeTab === 'TESTS' && (
          <TestRunner />
        )}

        {/* TAB 4: ARCHITECTURE & AUDIO ENGINE EXPLANATION */}
        {activeTab === 'ARCHITECTURE' && (
          <div className="flex flex-col gap-6">
            
            {/* Header Card */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800">
              <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Layers className="w-5 h-5 text-sky-400" />
                Technical Architecture: RFCOMM Full-Duplex Audio Engine
              </h2>
              <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
                In contrast to half-duplex walkie-talkies that cut off the receiver when transmitting, this application establishes a bidirectional full-duplex PCM audio pipe. Both smartphones capture, transmit, receive, and play 16,000Hz 16-bit audio simultaneously with hardware Acoustic Echo Cancellation (AEC).
              </p>
            </div>

            {/* Interactive Flow Diagram */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-6">
              <h3 className="text-sm font-semibold text-slate-200">
                Bidirectional Pipeline Topology
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                
                {/* Node 1: Sender Pipeline */}
                <div className="p-4 rounded-xl bg-slate-950 border border-sky-500/30 flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 text-sky-400 font-semibold text-xs">
                    <Mic className="w-4 h-4" />
                    <span>Sender Thread (Phone A)</span>
                  </div>
                  <ul className="text-[11px] text-slate-400 space-y-1.5 list-disc list-inside">
                    <li><strong className="text-slate-200">Source:</strong> MediaRecorder.AudioSource.VOICE_COMMUNICATION</li>
                    <li><strong className="text-slate-200">Format:</strong> 16,000 Hz, 16-bit PCM Mono</li>
                    <li><strong className="text-slate-200">DSP:</strong> AcousticEchoCanceler attached to sessionId</li>
                    <li><strong className="text-slate-200">Buffer:</strong> 640 bytes (20ms frames) read continuously</li>
                    <li><strong className="text-slate-200">Output:</strong> Written to <code className="text-sky-300">socket.outputStream</code></li>
                  </ul>
                </div>

                {/* Node 2: Bluetooth RFCOMM SPP Transport */}
                <div className="p-4 rounded-xl bg-slate-950 border border-purple-500/30 flex flex-col gap-2.5 text-center">
                  <div className="flex items-center justify-center gap-2 text-purple-400 font-semibold text-xs">
                    <Radio className="w-4 h-4" />
                    <span>RFCOMM Socket (UUID SPP)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Direct L2CAP channel over Bluetooth Classic (BR/EDR). Bandwidth: 256 kbps (32 KB/s continuous stream). Roundtrip latency: ~30ms.
                  </p>
                  <div className="py-1 px-2 rounded bg-purple-950/50 border border-purple-800/40 text-[10px] font-mono text-purple-300">
                    UUID: 00001101-0000-1000-8000-00805F9B34FB
                  </div>
                </div>

                {/* Node 3: Receiver Pipeline */}
                <div className="p-4 rounded-xl bg-slate-950 border border-teal-500/30 flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 text-teal-400 font-semibold text-xs">
                    <Volume2 className="w-4 h-4" />
                    <span>Receiver Thread (Phone B)</span>
                  </div>
                  <ul className="text-[11px] text-slate-400 space-y-1.5 list-disc list-inside">
                    <li><strong className="text-slate-200">Input:</strong> Blocking read from <code className="text-teal-300">socket.inputStream</code></li>
                    <li><strong className="text-slate-200">Track:</strong> AudioTrack in <code className="text-teal-300">MODE_STREAM</code></li>
                    <li><strong className="text-slate-200">Routing:</strong> AudioManager.STREAM_VOICE_CALL</li>
                    <li><strong className="text-slate-200">AEC Sync:</strong> USAGE_VOICE_COMMUNICATION ties output to mic filter</li>
                    <li><strong className="text-slate-200">Latency:</strong> Zero jitter-buffer delay, direct hardware DAC play</li>
                  </ul>
                </div>

              </div>
            </div>

            {/* Topology & 2-Device Concurrency Boundary */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Radio className="w-4 h-4 text-sky-400" />
                Network Topology: Strict Point-to-Point (1-to-1) vs Multi-Device Mesh
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                <strong className="text-white">Can a third phone connect once two phones are linked?</strong> <span className="text-amber-300 font-semibold">No, absolutely not.</span> The application is strictly engineered for direct 1-to-1 duplex communication due to the following architectural design:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <h4 className="text-xs font-semibold text-sky-400 mb-1">1. Server Socket Close on Accept</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    In <code className="text-sky-300 font-mono">BluetoothController.kt</code>, as soon as <code className="text-sky-300 font-mono">serverSocket.accept()</code> returns the socket for Phone B, Phone A calls <code className="text-sky-300 font-mono">serverSocket.close()</code>. The SPP service record unregisters from SDP, causing any connection attempt from a 3rd phone to immediately error out (<code className="text-slate-300 font-mono">Connection refused</code>).
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <h4 className="text-xs font-semibold text-teal-400 mb-1">2. Dedicated RFCOMM Bandwidth</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Uncompressed 16kHz 16-bit PCM consumes 256 kbps in each direction (512 kbps total). A Bluetooth Classic BR/EDR ACL piconet link typically maxes out around 700–1000 kbps. Dedicating the link to 2 devices ensures zero packet dropouts and low latency (&lt;35ms).
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <h4 className="text-xs font-semibold text-emerald-400 mb-1">3. Private Session Security</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Because the server listener ceases listening once a peer binds, neither third-party eavesdropping nor accidental packet injection can occur over the established voice link.
                  </p>
                </div>
              </div>
            </div>

            {/* Why VOICE_COMMUNICATION is Critical */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Why VOICE_COMMUNICATION and AcousticEchoCanceler are Essential
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                If an Android app uses standard <code className="text-slate-200 font-mono">AudioSource.MIC</code> and <code className="text-slate-200 font-mono">STREAM_MUSIC</code> in full-duplex, the audio coming out of Phone B&apos;s speaker is immediately picked up by Phone B&apos;s microphone and sent back to Phone A. This creates a deafening, exponential acoustic feedback loop (the howling sound).
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <h4 className="text-xs font-semibold text-slate-300 mb-1">Standard Audio (Feedback Loop)</h4>
                  <p className="text-[11px] text-rose-400">
                    Mic -&gt; RFCOMM -&gt; Speaker -&gt; Mic -&gt; RFCOMM -&gt; Speaker (Echo loop builds indefinitely)
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <h4 className="text-xs font-semibold text-slate-300 mb-1">Our VOICE_COMMUNICATION Pipeline</h4>
                  <p className="text-[11px] text-emerald-400">
                    AcousticEchoCanceler tracks the reference signal playing through AudioTrack (STREAM_VOICE_CALL) and subtracts it from AudioRecord before sending bytes over Bluetooth.
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>BTAudioWalkieTalkie • Standalone Android Application &amp; Testbench</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => downloadProjectZip()}
              className="text-sky-400 hover:text-sky-300 transition"
            >
              Export Project (.zip)
            </button>
            <span>•</span>
            <span>RFCOMM SPP (UUID 00001101-0000-1000-8000-00805F9B34FB)</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
