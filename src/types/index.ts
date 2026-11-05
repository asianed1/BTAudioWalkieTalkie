export type ConnectionState = 
  | 'disconnected'
  | 'listening'
  | 'connecting'
  | 'connected'
  | 'error';

export interface DeviceInfo {
  name: string;
  address: string;
  isPaired: boolean;
  rssi?: number;
}

export interface AudioTelemetry {
  isTransmitting: boolean;
  isReceiving: boolean;
  micMuted: boolean;
  outgoingDb: number;
  incomingDb: number;
  bytesSent: number;
  bytesReceived: number;
  packetsSent: number;
  packetsReceived: number;
  echoCancelerEnabled: boolean;
  noiseSuppressorEnabled: boolean;
  sampleRate: number;
  latencyMs: number;
}

export interface PacketLog {
  id: string;
  timestamp: string;
  sender: 'Phone A' | 'Phone B';
  type: 'RFCOMM_HANDSHAKE' | 'PCM_AUDIO_CHUNK' | 'SOCKET_EVENT' | 'AEC_FILTER' | 'AUDIO';
  detail: string;
  bytes?: number;
}
