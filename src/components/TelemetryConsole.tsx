import React, { useState } from 'react';
import { 
  Activity, 
  Terminal, 
  WifiOff, 
  RefreshCw, 
  Cpu, 
  Zap, 
  Layers, 
  CheckCircle2, 
  Sliders
} from 'lucide-react';
import { AudioTelemetry, PacketLog } from '../types';

interface TelemetryConsoleProps {
  telemetryA: AudioTelemetry;
  telemetryB: AudioTelemetry;
  isConnected: boolean;
  logs: PacketLog[];
  onSimulateInterference: () => void;
  onClearLogs: () => void;
}

export const TelemetryConsole: React.FC<TelemetryConsoleProps> = ({
  telemetryA,
  telemetryB,
  isConnected,
  logs,
  onSimulateInterference,
  onClearLogs
}) => {
  const [filter, setFilter] = useState<'ALL' | 'AUDIO' | 'RFCOMM'>('ALL');

  const filteredLogs = logs.filter(log => {
    if (filter === 'AUDIO') return log.type === 'PCM_AUDIO_CHUNK' || log.type === 'AEC_FILTER';
    if (filter === 'RFCOMM') return log.type === 'RFCOMM_HANDSHAKE' || log.type === 'SOCKET_EVENT';
    return true;
  });

  const totalBytes = telemetryA.bytesSent + telemetryB.bytesSent;

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-4 text-slate-200">
      
      {/* Header and Live Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              RFCOMM Socket &amp; Audio Telemetry
              {isConnected && (
                <span className="flex items-center gap-1 text-[11px] font-normal text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Full-Duplex Stream Active
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              Real-time monitoring of 16kHz 16-bit PCM streaming over Bluetooth Serial Port Profile (SPP)
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onSimulateInterference}
            disabled={!isConnected}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <WifiOff className="w-3.5 h-3.5" />
            Inject RF Jitter / Packet Drop
          </button>
          <button
            onClick={onClearLogs}
            className="px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800 transition"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col">
          <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-sky-400" />
            PCM Throughput
          </span>
          <span className="text-lg font-bold text-white mt-1 font-mono">
            {isConnected ? '32.0 KB/s' : '0.0 KB/s'}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">256 kbps (16kHz x 16-bit)</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col">
          <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-teal-400" />
            Chunk Size
          </span>
          <span className="text-lg font-bold text-white mt-1 font-mono">
            640 bytes
          </span>
          <span className="text-[10px] text-slate-500 font-mono">20ms frame (320 samples)</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col">
          <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            Socket Latency
          </span>
          <span className="text-lg font-bold text-white mt-1 font-mono">
            {isConnected ? `${telemetryA.latencyMs} ms` : '--'}
          </span>
          <span className="text-[10px] text-slate-500">RFCOMM buffering delay</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col">
          <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            AEC Attenuation
          </span>
          <span className="text-lg font-bold text-emerald-400 mt-1 font-mono">
            {isConnected ? '-24.5 dB' : '--'}
          </span>
          <span className="text-[10px] text-slate-500">Echo loopback suppressed</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col">
          <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-purple-400" />
            Packets Tx/Rx
          </span>
          <span className="text-lg font-bold text-white mt-1 font-mono">
            {telemetryA.packetsSent + telemetryB.packetsSent}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">Total PCM frames</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col">
          <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-rose-400" />
            Total Transferred
          </span>
          <span className="text-lg font-bold text-white mt-1 font-mono">
            {(totalBytes / 1024).toFixed(1)} KB
          </span>
          <span className="text-[10px] text-slate-500 font-mono">Raw bidirectional PCM</span>
        </div>
      </div>

      {/* Real-time Socket Event Log Console */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-300">Bluetooth Socket &amp; Audio Engine Logs</span>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {(['ALL', 'RFCOMM', 'AUDIO'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition ${
                  filter === tab ? 'bg-slate-800 text-sky-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full h-44 rounded-xl bg-slate-950 border border-slate-800/90 p-3 font-mono text-[11px] overflow-y-auto space-y-1 scrollbar-thin">
          {filteredLogs.length === 0 ? (
            <div className="text-slate-600 italic">No events logged yet. Host or connect to begin.</div>
          ) : (
            filteredLogs.map(log => {
              const typeColor = 
                log.type === 'RFCOMM_HANDSHAKE' ? 'text-sky-400' :
                log.type === 'PCM_AUDIO_CHUNK' ? 'text-emerald-400' :
                log.type === 'AEC_FILTER' ? 'text-indigo-400' :
                log.type === 'AUDIO' ? 'text-teal-400' :
                'text-amber-400';

              return (
                <div key={log.id} className="flex items-start gap-2 hover:bg-slate-900/60 py-0.5 px-1 rounded transition">
                  <span className="text-slate-600 shrink-0 select-none">{log.timestamp}</span>
                  <span className="text-slate-400 font-medium shrink-0">[{log.sender}]</span>
                  <span className={`${typeColor} font-semibold shrink-0`}>[{log.type}]</span>
                  <span className="text-slate-300 break-all">{log.detail}</span>
                  {log.bytes && (
                    <span className="text-slate-500 shrink-0 ml-auto">{log.bytes} B</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
};
