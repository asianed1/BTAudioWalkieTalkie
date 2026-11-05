package com.example.btaudiowalkietalkie;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.ListView;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends Activity implements BluetoothController.Listener, AudioEngine.ErrorListener {

    private BluetoothController bluetoothController;
    private AudioEngine audioEngine;

    private TextView tvStatus;
    private Button btnHost;
    private Button btnScan;
    private Button btnMuteToggle;
    private Button btnDisconnect;
    private ListView listDevices;

    private final List<BluetoothDevice> deviceList = new ArrayList<>();
    private ArrayAdapter<String> adapter;
    private final List<String> deviceDisplayNames = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        tvStatus = findViewById(R.id.tvStatus);
        btnHost = findViewById(R.id.btnHost);
        btnScan = findViewById(R.id.btnScan);
        btnMuteToggle = findViewById(R.id.btnMuteToggle);
        btnDisconnect = findViewById(R.id.btnDisconnect);
        listDevices = findViewById(R.id.listDevices);

        adapter = new ArrayAdapter<>(this, android.R.layout.simple_list_item_1, deviceDisplayNames);
        listDevices.setAdapter(adapter);

        bluetoothController = new BluetoothController(this, this);

        btnHost.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                bluetoothController.hostConnection();
            }
        });

        btnScan.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                refreshDevices();
                bluetoothController.startDiscovery();
                Toast.makeText(MainActivity.this, "Scanning for Bluetooth peers...", Toast.LENGTH_SHORT).show();
            }
        });

        btnMuteToggle.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (audioEngine != null) {
                    boolean nowMuted = !audioEngine.isMuted();
                    audioEngine.setMuted(nowMuted);
                    if (nowMuted) {
                        btnMuteToggle.setText("MIC MUTED (TAP TO UNMUTE)");
                        btnMuteToggle.setBackgroundColor(Color.parseColor("#EF4444"));
                    } else {
                        btnMuteToggle.setText("MIC LIVE (FULL DUPLEX)");
                        btnMuteToggle.setBackgroundColor(Color.parseColor("#10B981"));
                    }
                }
            }
        });

        btnDisconnect.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (audioEngine != null) {
                    audioEngine.stop();
                    audioEngine = null;
                }
                bluetoothController.disconnect();
            }
        });

        listDevices.setOnItemClickListener(new AdapterView.OnItemClickListener() {
            @Override
            public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
                if (position < deviceList.size()) {
                    BluetoothDevice target = deviceList.get(position);
                    bluetoothController.connectToDevice(target);
                }
            }
        });

        checkPermissions();
        refreshDevices();
    }

    private void checkPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            List<String> perms = new ArrayList<>();
            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                perms.add(Manifest.permission.RECORD_AUDIO);
            }
            if (Build.VERSION.SDK_INT >= 31) { // Android 12+ (S)
                if (checkSelfPermission("android.permission.BLUETOOTH_CONNECT") != PackageManager.PERMISSION_GRANTED) {
                    perms.add("android.permission.BLUETOOTH_CONNECT");
                }
                if (checkSelfPermission("android.permission.BLUETOOTH_SCAN") != PackageManager.PERMISSION_GRANTED) {
                    perms.add("android.permission.BLUETOOTH_SCAN");
                }
            } else {
                if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                    perms.add(Manifest.permission.ACCESS_FINE_LOCATION);
                }
            }

            if (!perms.isEmpty()) {
                requestPermissions(perms.toArray(new String[0]), 101);
            }
        }
    }

    private void refreshDevices() {
        deviceList.clear();
        deviceDisplayNames.clear();

        List<BluetoothDevice> paired = bluetoothController.getPairedDevices();
        for (BluetoothDevice d : paired) {
            deviceList.add(d);
            String name = d.getAddress();
            try {
                name = d.getName() != null ? d.getName() : d.getAddress();
            } catch (Exception ignored) {}
            deviceDisplayNames.add("Paired: " + name + " (" + d.getAddress() + ")");
        }
        adapter.notifyDataSetChanged();
    }

    @Override
    public void onListening() {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                tvStatus.setText("Status: Host Listening for Peer (SPP UUID)...");
                tvStatus.setTextColor(Color.parseColor("#38BDF8"));
            }
        });
    }

    @Override
    public void onConnecting(final String deviceName) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                tvStatus.setText("Status: Connecting to " + deviceName + "...");
                tvStatus.setTextColor(Color.parseColor("#FBBF24"));
            }
        });
    }

    @Override
    public void onConnected(final String deviceName, final BluetoothSocket socket) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                tvStatus.setText("Status: Connected to " + deviceName + " (Full-Duplex Active)");
                tvStatus.setTextColor(Color.parseColor("#10B981"));

                if (audioEngine != null) {
                    audioEngine.stop();
                }
                audioEngine = new AudioEngine(socket, MainActivity.this);
                audioEngine.start();

                btnMuteToggle.setText("MIC LIVE (FULL DUPLEX)");
                btnMuteToggle.setBackgroundColor(Color.parseColor("#10B981"));
            }
        });
    }

    @Override
    public void onDisconnected() {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                tvStatus.setText("Status: Disconnected");
                tvStatus.setTextColor(Color.parseColor("#94A3B8"));
            }
        });
    }

    @Override
    public void onError(final String message) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                tvStatus.setText("Error: " + message);
                tvStatus.setTextColor(Color.parseColor("#EF4444"));
                Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override
    public void onDeviceDiscovered(final BluetoothDevice device) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                for (BluetoothDevice existing : deviceList) {
                    if (existing.getAddress().equals(device.getAddress())) return;
                }
                deviceList.add(device);
                String name = device.getAddress();
                try {
                    name = device.getName() != null ? device.getName() : device.getAddress();
                } catch (Exception ignored) {}
                deviceDisplayNames.add("Discovered: " + name + " (" + device.getAddress() + ")");
                adapter.notifyDataSetChanged();
            }
        });
    }

    @Override
    public void onConnectionDropped(final String reason) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Toast.makeText(MainActivity.this, reason, Toast.LENGTH_SHORT).show();
                bluetoothController.disconnect();
            }
        });
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (audioEngine != null) {
            audioEngine.stop();
        }
        bluetoothController.release();
    }
}
