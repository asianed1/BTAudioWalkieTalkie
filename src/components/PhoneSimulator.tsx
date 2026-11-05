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
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { AudioVisualizer } from './AudioVisualizer';
import { ConnectionState, DeviceInfo, AudioTelemetry } from '../types';

interface PhoneSimulatorProps {
  deviceName: string;
  deviceModel: string;
  macAddress: string;
  themeColor: 'blue' | 'indigo';
  connectionState: ConnectionState;
  remotePeerName: string;
  pairedDevices: DeviceInfo[];
  discoveredDevices: DeviceInfo[];
  isScanning: boolean;
  hasPermissions: boolean;
  telemetry: AudioTelemetry;
  isSimulatingMicInput: boolean;
  onRequestPermissions: () => void;
  onHost: () => void;
  onScan: () => void;
  onConnect: (device: DeviceInfo) => void;
  onDisconnect: () => void;
  onToggleMute: () => void;
  onToggleMicSimulation: () => void;
}

export const PhoneSimulator: React.FC<PhoneSimulatorProps> = ({
  deviceName,
  deviceModel,
  macAddress,
  themeColor,
  connectionState,
  remotePeerName,
  pairedDevices,
  discoveredDevices,
  isScanning,
  hasPermissions,
  telemetry,
  isSimulatingMicInput,
  onRequestPermissions,
  onHost,
  onScan,
  onConnect,
  onDisconnect,
  onToggleMute,
  onToggleMicSimulation
}) => {
  const isPrimary = themeColor === 'blue';
  const primaryBg = isPrimary ? 'bg-sky-500' : 'bg-teal-500';
  const primaryHover = isPrimary ? 'hover:bg-sky-600' : 'hover:bg-teal-600';
  const primaryText = isPrimary ? 'text-sky-400' : 'text-teal-400';

  return (
    <div className="flex flex-col items-center">
      {/* Smartphone Outer Chassis */}
      <div className="relative w-[340px] h-[690px] rounded-[46px] p-3 bg-gradient-to-b from-slate-800 to-slate-950 shadow-2xl border-4 border-slate-700/80 ring-1 ring-white/10 flex flex-col justify-between">
        
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
              <Bluetooth className={`w-3 h-3 ${connectionState === 'connected' ? 'text-sky-400' : 'text-slate-400'}`} />
              <Wifi className="w-3 h-3" />
              <Battery className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Android Material 3 TopAppBar */}
          <div className="px-4 py-2.5 bg-slate-800/80 backdrop-blur border-b border-slate-700/50 flex items-center justify-between z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-semibold leading-tight text-white tracking-wide">
                  BTAudioWalkieTalkie
                </h2>
                <p className="text-[10px] text-slate-400 font-mono leading-none">
                  RFCOMM 16kHz PCM
                </p>
              </div>
            </div>

            {connectionState === 'connected' && (
              <button
                onClick={onDisconnect}
                title="Disconnect Bluetooth link"
                className="p-1.5 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition"
              >
                <PhoneOff className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Main App Content Area */}
          <div className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-3">
            
            {/* Permission Banner if not granted */}
            {!hasPermissions && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-amber-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="text-[11px]">Microphone & Bluetooth required</span>
                </div>
                <button
                  onClick={onRequestPermissions}
                  className="px-2.5 py-1 rounded-md bg-amber-500 text-slate-950 font-semibold text-[11px] hover:bg-amber-400 transition"
                >
                  Grant
                </button>
              </div>
            )}

            {/* Connection Status Card */}
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  connectionState === 'connected' ? 'bg-emerald-400 animate-pulse' :
                  connectionState === 'connecting' ? 'bg-amber-400 animate-ping' :
                  connectionState === 'listening' ? 'bg-sky-400 animate-pulse' :
                  'bg-slate-500'
                }`} />
                <span className="text-xs font-medium text-slate-200">
                  {connectionState === 'connected' ? 'Connected: Full-Duplex' :
                   connectionState === 'connecting' ? `Connecting...` :
                   connectionState === 'listening' ? 'Host: Listening (SPP)' :
                   'Bluetooth Disconnected'}
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                {connectionState === 'connected' ? '256 kbps' : 'Ready'}
              </span>
            </div>

            {/* View State: CONNECTED */}
            {connectionState === 'connected' && (
              <div className="flex-1 flex flex-col justify-between py-1">
                
                {/* Active Link Details */}
                <div className="flex flex-col gap-2">
                  <div className="p-2.5 rounded-xl bg-sky-950/40 border border-sky-800/40 flex items-center gap-2.5">
                    <BluetoothConnected className="w-5 h-5 text-sky-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white truncate">
                        Linked with {remotePeerName}
                      </div>
                      <div className="text-[10px] text-sky-300/80">
                        Simultaneous 2-way voice streaming
                      </div>
                    </div>
                  </div>

                  {/* Hardware DSP & AEC Info */}
                  <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 text-[10px] flex flex-col gap-1">
                    <div className="flex justify-between items-center text-slate-400">
                      <span>Acoustic Echo Canceler (AEC)</span>
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Hardware Active
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400">
                      <span>Stream / Voice Mode</span>
                      <span className="font-mono text-slate-300">VOICE_CALL (16kHz)</span>
                    </div>
                  </div>
                </div>

                {/* Waveforms */}
                <div className="flex flex-col gap-2.5 my-2">
                  <AudioVisualizer
                    isActive={telemetry.isTransmitting && !telemetry.micMuted}
                    rmsDb={telemetry.outgoingDb}
                    color="#38BDF8"
                    label="Mic Audio (Outgoing Tx)"
                    height={46}
                  />

                  <AudioVisualizer
                    isActive={telemetry.isReceiving}
                    rmsDb={telemetry.incomingDb}
                    color="#34D399"
                    label="Peer Audio (Incoming Rx)"
                    height={46}
                  />
                </div>

                {/* Giant Push-to-Talk / Mute Toggle Button */}
                <div className="flex flex-col items-center my-auto">
                  <div className="relative group">
                    {/* Pulsing Aura if Live */}
                    {!telemetry.micMuted && (
                      <div className="absolute -inset-2 rounded-full bg-sky-500/20 blur-md animate-pulse" />
                    )}
                    
                    <button
                      onClick={onToggleMute}
                      className={`relative w-28 h-28 rounded-full border-4 flex flex-col items-center justify-center transition-all shadow-xl active:scale-95 ${
                        telemetry.micMuted
                          ? 'bg-rose-950/80 border-rose-500/50 text-rose-300 hover:bg-rose-900/80'
                          : 'bg-gradient-to-b from-sky-500 to-sky-700 border-sky-300 text-white shadow-sky-500/25 hover:from-sky-400 hover:to-sky-600'
                      }`}
                    >
                      {telemetry.micMuted ? (
                        <MicOff className="w-8 h-8 mb-1" />
                      ) : (
                        <Mic className="w-8 h-8 mb-1" />
                      )}
                      <span className="text-[11px] font-bold tracking-wider">
                        {telemetry.micMuted ? 'MUTED' : 'LIVE'}
                      </span>
                      <span className="text-[9px] opacity-80">
                        {telemetry.micMuted ? 'Tap to Speak' : 'Full-Duplex'}
                      </span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 text-center">
                    Full-duplex allows both to talk simultaneously
                  </p>
                </div>

                {/* End Call Button */}
                <button
                  onClick={onDisconnect}
                  className="w-full py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <PhoneOff className="w-3.5 h-3.5" />
                  Disconnect Voice Link
                </button>
              </div>
            )}

            {/* View State: LISTENING (HOST) */}
            {connectionState === 'listening' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                <div className="relative w-24 h-24 rounded-full bg-sky-500/10 border border-sky-500/30 flex items-center justify-center mb-4">
                  <div className="absolute inset-0 rounded-full border border-sky-400/40 animate-ping opacity-50" />
                  <Radio className="w-10 h-10 text-sky-400" />
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">
                  Hosting RFCOMM Server
                </h3>
                <p className="text-[11px] text-slate-400 mb-3">
                  UUID: 00001101-0000-1000-8000-00805F9B34FB
                </p>
                <p className="text-[11px] text-sky-300/80 bg-sky-950/40 p-2.5 rounded-lg border border-sky-900/60 mb-6">
                  Ready! On the second phone, tap &quot;Scan &amp; Discover&quot; or select this device to connect.
                </p>
                <button
                  onClick={onDisconnect}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
                >
                  Cancel Hosting
                </button>
              </div>
            )}

            {/* View State: CONNECTING */}
            {connectionState === 'connecting' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                <div className="w-12 h-12 rounded-full border-2 border-sky-500 border-t-transparent animate-spin mb-4" />
                <h3 className="text-sm font-semibold text-white mb-1">
                  Connecting to Peer...
                </h3>
                <p className="text-[11px] text-slate-400 mb-4 font-mono">
                  Opening RFCOMM socket stream
                </p>
                <button
                  onClick={onDisconnect}
                  className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* View State: DISCONNECTED (Setup & Device Picker) */}
            {connectionState === 'disconnected' && (
              <div className="flex-1 flex flex-col gap-3">
                
                {/* Host & Scan Action Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={onHost}
                    className={`py-2.5 px-3 rounded-xl ${primaryBg} ${primaryHover} text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-md transition`}
                  >
                    <Bluetooth className="w-3.5 h-3.5" />
                    Host Connection
                  </button>

                  <button
                    onClick={onScan}
                    disabled={isScanning}
                    className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    {isScanning ? (
                      <>
                        <div className="w-3 h-3 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
                        Scanning...
                      </>
                    ) : (
                      <>
                        <BluetoothSearching className="w-3.5 h-3.5 text-sky-400" />
                        Scan &amp; Discover
                      </>
                    )}
                  </button>
                </div>

                {/* Paired Devices List */}
                <div className="flex-1 flex flex-col gap-1.5 overflow-hidden">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
                    <span className="font-semibold text-slate-300">Paired Bluetooth Devices</span>
                    <span>{pairedDevices.length} available</span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
                    {pairedDevices.length === 0 ? (
                      <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-[11px] text-slate-500 text-center">
                        No paired devices found.
                      </div>
                    ) : (
                      pairedDevices.map((device) => (
                        <div
                          key={device.address}
                          className="p-2.5 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 flex items-center justify-between transition group"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Bluetooth className="w-4 h-4 text-sky-400 shrink-0" />
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-white truncate">
                                {device.name}
                              </div>
                              <div className="text-[10px] font-mono text-slate-400 truncate">
                                {device.address}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => onConnect(device)}
                            className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500 text-sky-300 hover:text-white border border-sky-500/30 text-[11px] font-semibold transition"
                          >
                            Connect
                          </button>
                        </div>
                      ))
                    )}

                    {/* Discovered Devices (Live Scanner) */}
                    <div className="pt-2">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5 mb-1.5">
                        <span className="font-semibold text-slate-300">Nearby Discovered</span>
                        {isScanning && (
                          <span className="text-sky-400 text-[10px] animate-pulse">Radar active</span>
                        )}
                      </div>

                      {discoveredDevices.length === 0 ? (
                        <div className="p-2.5 rounded-xl bg-slate-950/30 border border-dashed border-slate-800 text-[11px] text-slate-500 text-center">
                          {isScanning ? 'Listening on 2.4GHz for Bluetooth beacons...' : 'Tap "Scan & Discover" to search'}
                        </div>
                      ) : (
                        discoveredDevices.map((device) => (
                          <div
                            key={device.address}
                            className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between mb-1.5"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <BluetoothSearching className="w-4 h-4 text-emerald-400 shrink-0" />
                              <div className="min-w-0">
                                <div className="text-xs font-medium text-white truncate">
                                  {device.name}
                                </div>
                                <div className="text-[10px] font-mono text-slate-400 truncate">
                                  {device.address} • {device.rssi} dBm
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => onConnect(device)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white border border-emerald-500/30 text-[11px] font-semibold transition"
                            >
                              Connect
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
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

        {/* Live Mic Simulation Switch */}
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
