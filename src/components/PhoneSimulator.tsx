import React from 'react';
import { 
  Radio, 
  Bluetooth, 
  BluetoothSearching, 
  BluetoothConnected, 
  Mic, 
  MicOff, 
  PhoneOff, 
  ShieldCheck, 
  Volume2, 
  Wifi, 
  Battery, 
  AlertCircle,
  Users
} from 'lucide-react';
import { AudioVisualizer } from './AudioVisualizer';
import { RadioMode, ConnectionState, DeviceInfo, AudioTelemetry } from '../types';

interface PhoneSimulatorProps {
  deviceName: string;
  deviceModel: string;
  macAddress: string;
  themeColor: 'blue' | 'indigo';
  currentMode: RadioMode;
  onSelectMode: (mode: RadioMode) => void;
  // Bluetooth State
  connectionState: ConnectionState;
  remotePeerName: string;
  pairedDevices: DeviceInfo[];
  discoveredDevices: DeviceInfo[];
  isScanning: boolean;
  hasPermissions: boolean;
  telemetry: AudioTelemetry;
  isSimulatingMicInput: boolean;
  // Wi-Fi State
  isWifiActive: boolean;
  onlinePeers: string[];
  activeSpeaker?: string;
  onRequestPermissions: () => void;
  onHost: () => void;
  onScan: () => void;
  onConnect: (device: DeviceInfo) => void;
  onDisconnectBt: () => void;
  onToggleMuteBt: () => void;
  onStartWifiChannel: () => void;
  onStopWifiChannel: () => void;
  onToggleMuteWifi: () => void;
  onToggleMicSimulation: () => void;
}

export const PhoneSimulator: React.FC<PhoneSimulatorProps> = ({
  deviceName,
  deviceModel,
  macAddress,
  themeColor,
  currentMode,
  onSelectMode,
  connectionState,
  remotePeerName,
  pairedDevices,
  discoveredDevices,
  isScanning,
  hasPermissions,
  telemetry,
  isSimulatingMicInput,
  isWifiActive,
  onlinePeers,
  activeSpeaker,
  onRequestPermissions,
  onHost,
  onScan,
  onConnect,
  onDisconnectBt,
  onToggleMuteBt,
  onStartWifiChannel,
  onStopWifiChannel,
  onToggleMuteWifi,
  onToggleMicSimulation
}) => {
  const isPrimary = themeColor === 'blue';
  const primaryBg = isPrimary ? 'bg-sky-500' : 'bg-teal-500';
  const primaryHover = isPrimary ? 'hover:bg-sky-600' : 'hover:bg-teal-600';

  return (
    <div className="flex flex-col items-center">
      {/* Smartphone Outer Chassis */}
      <div className="relative w-[340px] h-[720px] rounded-[46px] p-3 bg-gradient-to-b from-slate-800 to-slate-950 shadow-2xl border-4 border-slate-700/80 ring-1 ring-white/10 flex flex-col justify-between">
        
        {/* Phone Speaker Grille & Punch Hole Camera */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 z-30 pointer-events-none">
          <div className="w-10 h-1 bg-slate-700 rounded-full" />
          <div className="w-3.5 h-3.5 bg-black rounded-full border border-slate-800 flex items-center justify-center">
            <div className="w-1 h-1 bg-blue-950 rounded-full" />
          </div>
        </div>

        {/* Screen Container */}
        <div className="w-full h-full rounded-[36px] bg-slate-900 overflow-hidden flex flex-col text-slate-100 relative border border-slate-800">
          
          {/* Android Status Bar */}
          <div className="h-7 px-5 pt-1.5 flex items-center justify-between text-[11px] text-slate-400 font-medium select-none z-20">
            <span>10:35</span>
            <div className="flex items-center gap-1.5 text-slate-400">
              {currentMode === 'BLUETOOTH' ? (
                <Bluetooth className={`w-3 h-3 ${connectionState === 'connected' ? 'text-sky-400' : 'text-slate-400'}`} />
              ) : (
                <Wifi className={`w-3 h-3 ${isWifiActive ? 'text-emerald-400' : 'text-slate-400'}`} />
              )}
              <Battery className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Android Material 3 TopAppBar */}
          <div className="px-4 py-2.5 bg-slate-800/80 backdrop-blur border-b border-slate-700/50 flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                currentMode === 'BLUETOOTH' ? 'bg-sky-500/10 text-sky-400' : 'bg-emerald-500/10 text-emerald-400'
              }`}>
                {currentMode === 'BLUETOOTH' ? <Radio className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
              </div>
              <div>
                <h2 className="text-xs font-semibold leading-tight text-white tracking-wide">
                  BTAudioWalkieTalkie
                </h2>
                <p className="text-[9px] text-slate-400 font-mono leading-none">
                  {currentMode === 'BLUETOOTH' ? 'RFCOMM SPP (1-to-1)' : 'Wi-Fi UDP Multicast (Group)'}
                </p>
              </div>
            </div>

            {((currentMode === 'BLUETOOTH' && connectionState === 'connected') || (currentMode === 'WIFI_HOTSPOT' && isWifiActive)) && (
              <button
                onClick={currentMode === 'BLUETOOTH' ? onDisconnectBt : onStopWifiChannel}
                title="Disconnect voice link"
                className="p-1.5 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition"
              >
                <PhoneOff className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Main App Content Area */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
            
            {/* Permission Banner if not granted */}
            {!hasPermissions && (
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-amber-300">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[10px]">Permissions required</span>
                </div>
                <button
                  onClick={onRequestPermissions}
                  className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-semibold text-[10px]"
                >
                  Grant
                </button>
              </div>
            )}

            {/* Exact Dual Mode Switcher */}
            <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 flex flex-col gap-1.5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Radio Link Mode</span>

              {/* Mode A: Bluetooth */}
              <button
                onClick={() => onSelectMode('BLUETOOTH')}
                className={`w-full p-2 rounded-lg text-left transition border ${
                  currentMode === 'BLUETOOTH'
                    ? 'bg-sky-500/20 border-sky-500/50 text-white'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                    currentMode === 'BLUETOOTH' ? 'border-sky-400 bg-sky-400/20' : 'border-slate-600'
                  }`}>
                    {currentMode === 'BLUETOOTH' && <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-bold text-slate-100 flex items-center gap-1.5">
                      <Bluetooth className="w-3 h-3 text-sky-400" />
                      Bluetooth
                    </div>
                    <div className="text-[9px] text-slate-400 leading-tight">
                      low power consumption · short range · 2 persons
                    </div>
                  </div>
                </div>
              </button>

              {/* Mode B: Wi-Fi Hotspot */}
              <button
                onClick={() => onSelectMode('WIFI_HOTSPOT')}
                className={`w-full p-2 rounded-lg text-left transition border ${
                  currentMode === 'WIFI_HOTSPOT'
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-white'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                    currentMode === 'WIFI_HOTSPOT' ? 'border-emerald-400 bg-emerald-400/20' : 'border-slate-600'
                  }`}>
                    {currentMode === 'WIFI_HOTSPOT' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-bold text-slate-100 flex items-center gap-1.5">
                      <Wifi className="w-3 h-3 text-emerald-400" />
                      WiFiHotspot
                    </div>
                    <div className="text-[9px] text-slate-400 leading-tight">
                      high power consumption · long range · 2–10 phones
                    </div>
                  </div>
                </div>
              </button>
            </div>

            {/* MODE 1: BLUETOOTH VIEW */}
            {currentMode === 'BLUETOOTH' && (
              <div className="flex-1 flex flex-col gap-2.5">
                {/* Status Indicator */}
                <div className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      connectionState === 'connected' ? 'bg-emerald-400 animate-pulse' :
                      connectionState === 'connecting' ? 'bg-amber-400 animate-ping' :
                      connectionState === 'listening' ? 'bg-sky-400 animate-pulse' :
                      'bg-slate-500'
                    }`} />
                    <span className="text-[11px] font-medium text-slate-200">
                      {connectionState === 'connected' ? 'Connected: Full-Duplex Active' :
                       connectionState === 'connecting' ? 'Connecting...' :
                       connectionState === 'listening' ? 'Host: Listening (SPP)' :
                       'Bluetooth Ready'}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-400">25m</span>
                </div>

                {/* View State: CONNECTED */}
                {connectionState === 'connected' ? (
                  <div className="flex-1 flex flex-col justify-between py-1">
                    <div className="p-2 rounded-lg bg-sky-950/40 border border-sky-800/40 flex items-center gap-2">
                      <BluetoothConnected className="w-4 h-4 text-sky-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-semibold text-white truncate">Linked with {remotePeerName}</div>
                        <div className="text-[9px] text-sky-300/80">Simultaneous 2-way audio (16kHz PCM)</div>
                      </div>
                    </div>

                    {/* Waveforms */}
                    <div className="flex flex-col gap-2 my-1">
                      <AudioVisualizer
                        isActive={telemetry.isTransmitting && !telemetry.micMuted}
                        rmsDb={telemetry.outgoingDb}
                        color="#38BDF8"
                        label="Microphone (Tx)"
                        height={40}
                      />
                      <AudioVisualizer
                        isActive={telemetry.isReceiving}
                        rmsDb={telemetry.incomingDb}
                        color="#34D399"
                        label="Peer Voice (Rx)"
                        height={40}
                      />
                    </div>

                    {/* PTT / Mute Button */}
                    <div className="flex flex-col items-center my-1">
                      <button
                        onClick={onToggleMuteBt}
                        className={`w-24 h-24 rounded-full border-4 flex flex-col items-center justify-center transition-all shadow-xl active:scale-95 ${
                          telemetry.micMuted
                            ? 'bg-rose-950/80 border-rose-500/50 text-rose-300'
                            : 'bg-gradient-to-b from-sky-500 to-sky-700 border-sky-300 text-white shadow-sky-500/25'
                        }`}
                      >
                        {telemetry.micMuted ? <MicOff className="w-7 h-7 mb-0.5" /> : <Mic className="w-7 h-7 mb-0.5" />}
                        <span className="text-[10px] font-bold">{telemetry.micMuted ? 'MUTED' : 'LIVE'}</span>
                      </button>
                    </div>

                    <button
                      onClick={onDisconnectBt}
                      className="w-full py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                    >
                      <PhoneOff className="w-3.5 h-3.5" />
                      End Bluetooth Link
                    </button>
                  </div>
                ) : connectionState === 'listening' ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-3">
                    <Radio className="w-8 h-8 text-sky-400 mb-2 animate-pulse" />
                    <div className="text-xs font-bold text-white">Hosting Bluetooth Link</div>
                    <div className="text-[10px] text-slate-400 mt-1 mb-3">UUID: 00001101-...</div>
                    <button onClick={onDisconnectBt} className="px-3 py-1 rounded bg-slate-800 text-xs text-slate-300">
                      Cancel
                    </button>
                  </div>
                ) : (
                  /* Disconnected Setup View */
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={onHost}
                        className={`py-2 px-2.5 rounded-xl ${primaryBg} ${primaryHover} text-white font-medium text-xs flex items-center justify-center gap-1 shadow-md`}
                      >
                        <Bluetooth className="w-3.5 h-3.5" />
                        Host Link
                      </button>
                      <button
                        onClick={onScan}
                        disabled={isScanning}
                        className="py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium text-xs flex items-center justify-center gap-1"
                      >
                        <BluetoothSearching className="w-3.5 h-3.5 text-sky-400" />
                        {isScanning ? 'Scanning...' : 'Scan Peers'}
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
                      <div className="text-[10px] font-bold text-slate-400">Paired Devices</div>
                      {pairedDevices.map((device) => (
                        <div key={device.address} className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/50 flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium text-white truncate">{device.name}</div>
                            <div className="text-[9px] font-mono text-slate-400">{device.address}</div>
                          </div>
                          <button onClick={() => onConnect(device)} className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-bold">
                            Connect
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MODE 2: WI-FI HOTSPOT VIEW */}
            {currentMode === 'WIFI_HOTSPOT' && (
              <div className="flex-1 flex flex-col justify-between py-1">
                {!isWifiActive ? (
                  <div className="flex-1 flex flex-col justify-between py-2">
                    <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-xs">
                      <div className="font-bold text-emerald-300 mb-1 flex items-center gap-1.5">
                        <Wifi className="w-3.5 h-3.5" />
                        Wi-Fi Hotspot Instructions
                      </div>
                      <p className="text-[10px] text-slate-300 leading-relaxed">
                        1. One phone enables <strong>Android Portable Hotspot</strong> (0 data used).<br />
                        2. Other phones connect to that Wi-Fi.<br />
                        3. All phones tap <strong>Join Channel 1</strong> below!
                      </p>
                    </div>

                    <div className="flex flex-col items-center justify-center my-auto text-center">
                      <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-2">
                        <Users className="w-8 h-8 text-emerald-400" />
                      </div>
                      <div className="text-xs font-bold text-white">Channel 1 (Alpha Team)</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">UDP Multicast Port 50005 · Up to 10 phones</div>
                      <div className="text-[10px] text-emerald-400 mt-1 font-semibold">Extended Range (~100 meters)</div>
                    </div>

                    <button
                      onClick={onStartWifiChannel}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition"
                    >
                      <Wifi className="w-4 h-4" />
                      Join / Start Group Channel 1
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col justify-between">
                    {/* Active Wi-Fi Header */}
                    <div className="p-2 rounded-lg bg-emerald-950/50 border border-emerald-700/50 flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">Channel 1 (Wi-Fi Active)</div>
                          <div className="text-[9px] text-emerald-300">{onlinePeers.length + 1} phones connected · ~100m range</div>
                        </div>
                      </div>
                      <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">UDP 50005</span>
                    </div>

                    {/* Online Peers List */}
                    <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 text-[10px] flex flex-col gap-1 max-h-24 overflow-y-auto">
                      <div className="font-semibold text-slate-400">Connected Group Members:</div>
                      <div className="text-emerald-400 font-medium">✓ This Phone ({deviceName})</div>
                      {onlinePeers.map((p, i) => (
                        <div key={i} className="text-slate-300">✓ {p}</div>
                      ))}
                    </div>

                    {/* Waveforms */}
                    <div className="flex flex-col gap-1.5 my-1">
                      <AudioVisualizer
                        isActive={telemetry.isTransmitting && !telemetry.micMuted}
                        rmsDb={telemetry.outgoingDb}
                        color="#10B981"
                        label="Your Voice (Broadcasting)"
                        height={38}
                      />
                      <AudioVisualizer
                        isActive={telemetry.isReceiving}
                        rmsDb={telemetry.incomingDb}
                        color="#38BDF8"
                        label={activeSpeaker ? `${activeSpeaker} (Rx)` : 'Group Channel Audio'}
                        height={38}
                      />
                    </div>

                    {/* PTT Button */}
                    <div className="flex flex-col items-center my-1">
                      <button
                        onClick={onToggleMuteWifi}
                        className={`w-24 h-24 rounded-full border-4 flex flex-col items-center justify-center transition-all shadow-xl active:scale-95 ${
                          telemetry.micMuted
                            ? 'bg-rose-950/80 border-rose-500/50 text-rose-300'
                            : 'bg-gradient-to-b from-emerald-500 to-teal-600 border-emerald-300 text-white shadow-emerald-500/25'
                        }`}
                      >
                        {telemetry.micMuted ? <MicOff className="w-7 h-7 mb-0.5" /> : <Mic className="w-7 h-7 mb-0.5" />}
                        <span className="text-[10px] font-bold">{telemetry.micMuted ? 'MUTED' : 'MIC LIVE'}</span>
                        <span className="text-[8px] opacity-80">Group Broadcast</span>
                      </button>
                    </div>

                    <button
                      onClick={onStopWifiChannel}
                      className="w-full py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                    >
                      <PhoneOff className="w-3.5 h-3.5" />
                      Leave Channel 1
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Android 3-Button Navigation Bar */}
          <div className="h-6 bg-slate-950/90 flex items-center justify-center gap-12 text-slate-600 select-none">
            <div className="w-3 h-3 border border-slate-600 rounded-sm" />
            <div className="w-3 h-3 border border-slate-600 rounded-full" />
            <div className="w-0 h-0 border-t-4 border-t-transparent border-b-4 border-b-transparent border-r-6 border-r-slate-600" />
          </div>

        </div>
      </div>

      {/* Device Hardware Spec & Mic Simulation Toggle */}
      <div className="mt-3 w-[340px] px-2 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold text-slate-300">{deviceModel}</span>
          <span className="font-mono text-[10px] text-slate-500">{macAddress}</span>
        </div>

        <button
          onClick={onToggleMicSimulation}
          className={`w-full py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-2 border transition ${
            isSimulatingMicInput
              ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
              : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-400'
          }`}
        >
          <Mic className={`w-3.5 h-3.5 ${isSimulatingMicInput ? 'text-sky-400 animate-pulse' : 'text-slate-500'}`} />
          <span>{isSimulatingMicInput ? 'Speaking into Phone (Mic Active)' : 'Simulate Speaking into Mic'}</span>
        </button>
      </div>
    </div>
  );
};
