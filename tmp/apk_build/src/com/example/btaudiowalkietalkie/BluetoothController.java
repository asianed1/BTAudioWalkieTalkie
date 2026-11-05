package com.example.btaudiowalkietalkie;

import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothServerSocket;
import android.bluetooth.BluetoothSocket;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.util.Log;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public class BluetoothController {
    private static final String TAG = "BluetoothController";
    private static final String APP_NAME = "BTAudioWalkieTalkie";
    public static final UUID WALKIE_TALKIE_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    public interface Listener {
        void onListening();
        void onConnecting(String deviceName);
        void onConnected(String deviceName, BluetoothSocket socket);
        void onDisconnected();
        void onError(String message);
        void onDeviceDiscovered(BluetoothDevice device);
    }

    private final Context context;
    private final Listener listener;
    private final BluetoothAdapter bluetoothAdapter;

    private BluetoothServerSocket serverSocket;
    private BluetoothSocket activeSocket;
    private Thread connectionThread;

    private final BroadcastReceiver discoveryReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context ctx, Intent intent) {
            String action = intent.getAction();
            if (BluetoothDevice.ACTION_FOUND.equals(action)) {
                BluetoothDevice device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                if (device != null && listener != null) {
                    listener.onDeviceDiscovered(device);
                }
            }
        }
    };

    public BluetoothController(Context context, Listener listener) {
        this.context = context;
        this.listener = listener;
        this.bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();

        IntentFilter filter = new IntentFilter(BluetoothDevice.ACTION_FOUND);
        context.registerReceiver(discoveryReceiver, filter);
    }

    public boolean isBluetoothSupported() {
        return bluetoothAdapter != null;
    }

    public boolean isBluetoothEnabled() {
        return bluetoothAdapter != null && bluetoothAdapter.isEnabled();
    }

    @SuppressLint("MissingPermission")
    public List<BluetoothDevice> getPairedDevices() {
        List<BluetoothDevice> list = new ArrayList<>();
        if (bluetoothAdapter != null) {
            try {
                Set<BluetoothDevice> bonded = bluetoothAdapter.getBondedDevices();
                if (bonded != null) {
                    list.addAll(bonded);
                }
            } catch (SecurityException e) {
                Log.e(TAG, "Missing permission for paired devices", e);
            }
        }
        return list;
    }

    @SuppressLint("MissingPermission")
    public void startDiscovery() {
        if (bluetoothAdapter != null) {
            try {
                if (bluetoothAdapter.isDiscovering()) {
                    bluetoothAdapter.cancelDiscovery();
                }
                bluetoothAdapter.startDiscovery();
            } catch (SecurityException e) {
                Log.e(TAG, "Missing scan permission", e);
            }
        }
    }

    @SuppressLint("MissingPermission")
    public void stopDiscovery() {
        if (bluetoothAdapter != null) {
            try {
                if (bluetoothAdapter.isDiscovering()) {
                    bluetoothAdapter.cancelDiscovery();
                }
            } catch (SecurityException e) {
                Log.e(TAG, "SecurityException stopping discovery", e);
            }
        }
    }

    @SuppressLint("MissingPermission")
    public void hostConnection() {
        disconnect();
        if (listener != null) listener.onListening();

        connectionThread = new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    serverSocket = bluetoothAdapter.listenUsingRfcommWithServiceRecord(APP_NAME, WALKIE_TALKIE_UUID);
                    BluetoothSocket socket = serverSocket.accept();
                    
                    // Close server socket immediately on accept (1-to-1 point-to-point boundary)
                    serverSocket.close();
                    serverSocket = null;

                    if (socket != null) {
                        activeSocket = socket;
                        String name = "Peer Phone";
                        try {
                            name = socket.getRemoteDevice().getName();
                            if (name == null) name = socket.getRemoteDevice().getAddress();
                        } catch (Exception ignored) {}

                        final String finalName = name;
                        final BluetoothSocket finalSocket = socket;
                        if (listener != null) {
                            listener.onConnected(finalName, finalSocket);
                        }
                    }
                } catch (IOException e) {
                    if (serverSocket != null) {
                        if (listener != null) listener.onError("Hosting cancelled: " + e.getMessage());
                    }
                }
            }
        });
        connectionThread.start();
    }

    @SuppressLint("MissingPermission")
    public void connectToDevice(final BluetoothDevice device) {
        disconnect();
        stopDiscovery();

        String devName = device.getAddress();
        try {
            devName = device.getName();
            if (devName == null) devName = device.getAddress();
        } catch (Exception ignored) {}

        if (listener != null) listener.onConnecting(devName);

        final String finalName = devName;
        connectionThread = new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    BluetoothSocket socket = device.createRfcommSocketToServiceRecord(WALKIE_TALKIE_UUID);
                    socket.connect();
                    activeSocket = socket;

                    if (listener != null) {
                        listener.onConnected(finalName, socket);
                    }
                } catch (IOException e) {
                    if (listener != null) {
                        listener.onError("Connection failed: " + e.getMessage());
                    }
                }
            }
        });
        connectionThread.start();
    }

    public void disconnect() {
        if (connectionThread != null) {
            connectionThread.interrupt();
            connectionThread = null;
        }
        if (serverSocket != null) {
            try { serverSocket.close(); } catch (IOException ignored) {}
            serverSocket = null;
        }
        if (activeSocket != null) {
            try { activeSocket.close(); } catch (IOException ignored) {}
            activeSocket = null;
        }
        if (listener != null) {
            listener.onDisconnected();
        }
    }

    public void release() {
        disconnect();
        try {
            context.unregisterReceiver(discoveryReceiver);
        } catch (Exception ignored) {}
    }
}
