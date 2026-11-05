export type RadioMode = 'BLUETOOTH' | 'WIFI_HOTSPOT';

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
  // Wi-Fi specific
  onlinePeersCount?: number;
  channelNumber?: number;
}

export interface PacketLog {
  id: string;
  timestamp: string;
  sender: 'Phone A' | 'Phone B' | 'Phone C (Group)';
  type: 'RFCOMM_HANDSHAKE' | 'PCM_AUDIO_CHUNK' | 'SOCKET_EVENT' | 'AEC_FILTER' | 'AUDIO' | 'WIFI_MULTICAST' | 'WIFI_HEARTBEAT';
  detail: string;
  bytes?: number;
}
