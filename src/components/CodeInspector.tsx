import React, { useState } from 'react';
import { 
  FileCode2, 
  Copy, 
  Check, 
  Download, 
  ShieldCheck, 
  Radio, 
  Volume2, 
  Layers, 
  Sparkles 
} from 'lucide-react';
import { ANDROID_PROJECT_FILES, downloadProjectZip, ProjectFile } from '../services/androidProjectFiles';

export const CodeInspector: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<ProjectFile>(ANDROID_PROJECT_FILES[0]);
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadProjectZip();
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      
      {/* Download Banner & Architecture Callouts */}
      <div className="bg-gradient-to-r from-sky-950/60 via-slate-900 to-teal-950/60 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <FileCode2 className="w-5 h-5 text-sky-400" />
            Standalone Android Studio Project (Kotlin)
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Clean, modular architecture using Android 12+ Bluetooth APIs, full-duplex AudioRecord/AudioTrack streaming, hardware AcousticEchoCanceler (AEC), and Material 3 Jetpack Compose.
          </p>
        </div>

        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-400 hover:to-teal-400 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-sky-500/20 transition shrink-0"
        >
          {isDownloading ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              Packaging .ZIP...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Download Android Studio Project (.ZIP)
            </>
          )}
        </button>
      </div>

      {/* Deep-Dive Architectural Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sky-400">
            <Radio className="w-4 h-4 shrink-0" />
            <h4 className="text-xs font-semibold text-slate-200">RFCOMM SPP vs BLE GATT</h4>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Bluetooth Low Energy (BLE) maxes out around 50–100 kbps with strict MTU limits. Classic Bluetooth RFCOMM provides a raw serial byte stream capable of continuous 300–800 kbps, easily carrying uncompressed 16kHz 16-bit PCM (256 kbps) with &lt;35ms latency.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-emerald-400">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <h4 className="text-xs font-semibold text-slate-200">Hardware Acoustic Echo Canceler</h4>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Full-duplex voice loop creates severe acoustic feedback if the speaker bleeds back into the mic. By using <code className="text-emerald-300 font-mono">AudioSource.VOICE_COMMUNICATION</code> paired with <code className="text-emerald-300 font-mono">AcousticEchoCanceler</code> attached to the record session ID, Android DSP subtracts the speaker signal in hardware.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-teal-400">
            <Layers className="w-4 h-4 shrink-0" />
            <h4 className="text-xs font-semibold text-slate-200">Concurrent Dual Threads</h4>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Two separate high-priority threads run simultaneously: Sender reads 640-byte PCM chunks from <code className="text-teal-300 font-mono">AudioRecord</code> and flushes to <code className="text-teal-300 font-mono">BluetoothSocket.outputStream</code>, while Receiver blocks on <code className="text-teal-300 font-mono">inputStream.read()</code> and feeds <code className="text-teal-300 font-mono">AudioTrack</code>.
          </p>
        </div>
      </div>

      {/* Code File Explorer & Viewer */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
        
        {/* File Tabs */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 px-4 py-2 overflow-x-auto gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {ANDROID_PROJECT_FILES.map((file) => {
              const isSelected = selectedFile.path === file.path;
              return (
                <button
                  key={file.path}
                  onClick={() => setSelectedFile(file)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium font-mono whitespace-nowrap transition flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-slate-800 text-sky-400 border border-slate-700 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <FileCode2 className={`w-3.5 h-3.5 ${isSelected ? 'text-sky-400' : 'text-slate-500'}`} />
                  {file.name}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition shrink-0 ml-2"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>

        {/* Code Content Container */}
        <div className="p-4 bg-slate-950 font-mono text-xs overflow-x-auto text-slate-300 leading-relaxed max-h-[560px] scrollbar-thin">
          <div className="text-[11px] text-slate-500 mb-3 pb-2 border-b border-slate-900 flex items-center justify-between">
            <span>Path: <code className="text-sky-400">{selectedFile.path}</code></span>
            <span>{selectedFile.language.toUpperCase()}</span>
          </div>
          <pre className="whitespace-pre">
            {selectedFile.content}
          </pre>
        </div>

      </div>

    </div>
  );
};
