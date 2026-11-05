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
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends Activity implements BluetoothController.Listener, AudioEngine.ErrorListener, WifiAudioController.Listener {

    private BluetoothController bluetoothController;
    private AudioEngine audioEngine;
    private WifiAudioController wifiAudioController;

    private RadioGroup rgMode;
    private RadioButton rbBluetooth;
    private RadioButton rbWifi;
    private TextView tvStatus;
    private TextView tvMetrics;
    private LinearLayout layoutBtButtons;
    private LinearLayout layoutWifiButtons;
    private Button btnHost;
    private Button btnScan;
    private Button btnJoinWifi;
    private Button btnMuteToggle;
    private Button btnDisconnect;
    private ListView listDevices;

    private boolean isWifiMode = false;
    private boolean isWifiChannelActive = false;

    private final List<BluetoothDevice> deviceList = new ArrayList<>();
    private ArrayAdapter<String> adapter;
    private final List<String> displayItems = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        rgMode = findViewById(R.id.rgMode);
        rbBluetooth = findViewById(R.id.rbBluetooth);
        rbWifi = findViewById(R.id.rbWifi);
        tvStatus = findViewById(R.id.tvStatus);
        tvMetrics = findViewById(R.id.tvMetrics);
        layoutBtButtons = findViewById(R.id.layoutBtButtons);
        layoutWifiButtons = findViewById(R.id.layoutWifiButtons);
        btnHost = findViewById(R.id.btnHost);
        btnScan = findViewById(R.id.btnScan);
        btnJoinWifi = findViewById(R.id.btnJoinWifi);
        btnMuteToggle = findViewById(R.id.btnMuteToggle);
        btnDisconnect = findViewById(R.id.btnDisconnect);
        listDevices = findViewById(R.id.listDevices);

        adapter = new ArrayAdapter<>(this, android.R.layout.simple_list_item_1, displayItems);
        listDevices.setAdapter(adapter);

        String model = Build.MODEL != null ? Build.MODEL : "Android Phone";
        bluetoothController = new BluetoothController(this, this);
        wifiAudioController = new WifiAudioController(this, model, this);

        rgMode.setOnCheckedChangeListener(new RadioGroup.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(RadioGroup group, int checkedId) {
                if (checkedId == R.id.rbWifi) {
                    switchToWifiMode();
                } else {
                    switchToBluetoothMode();
                }
            }
        });

        btnHost.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                bluetoothController.hostConnection();
            }
        });

        btnScan.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                refreshBtDevices();
                bluetoothController.startDiscovery();
                Toast.makeText(MainActivity.this, "Scanning for Bluetooth peers...", Toast.LENGTH_SHORT).show();
            }
        });

        btnJoinWifi.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (!isWifiChannelActive) {
                    wifiAudioController.start(1);
                    btnJoinWifi.setText("Leave Channel 1");
                    btnJoinWifi.setBackgroundColor(Color.parseColor("#EF4444"));
                } else {
                    wifiAudioController.stop();
                    btnJoinWifi.setText("Join / Start Group Channel 1");
                    btnJoinWifi.setBackgroundColor(Color.parseColor("#10B981"));
                }
            }
        });

        btnMuteToggle.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                boolean nowMuted;
                if (!isWifiMode) {
                    if (audioEngine == null) return;
                    nowMuted = !audioEngine.isMuted();
                    audioEngine.setMuted(nowMuted);
                } else {
                    nowMuted = !wifiAudioController.isMuted();
                    wifiAudioController.setMuted(nowMuted);
                }

                if (nowMuted) {
                    btnMuteToggle.setText("MIC MUTED (TAP TO UNMUTE)");
                    btnMuteToggle.setBackgroundColor(Color.parseColor("#EF4444"));
                } else {
                    btnMuteToggle.setText("MIC LIVE (FULL DUPLEX)");
                    btnMuteToggle.setBackgroundColor(Color.parseColor("#10B981"));
                }
            }
        });

        btnDisconnect.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (!isWifiMode) {
                    if (audioEngine != null) {
                        audioEngine.stop();
                        audioEngine = null;
                    }
                    bluetoothController.disconnect();
                } else {
                    wifiAudioController.stop();
                }
            }
        });

        listDevices.setOnItemClickListener(new AdapterView.OnItemClickListener() {
            @Override
            public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
                if (!isWifiMode && position < deviceList.size()) {
                    BluetoothDevice target = deviceList.get(position);
                    bluetoothController.connectToDevice(target);
                }
            }
        });

        checkPermissions();
        refreshBtDevices();
    }

    private void switchToBluetoothMode() {
        if (isWifiChannelActive) {
            wifiAudioController.stop();
        }
        isWifiMode = false;
        layoutBtButtons.setVisibility(View.VISIBLE);
        layoutWifiButtons.setVisibility(View.GONE);
        tvStatus.setText("Status: Bluetooth Mode (1-to-1, Low Power)");
        tvStatus.setTextColor(Color.parseColor("#38BDF8"));
        tvMetrics.setText("AEC: Active | 16kHz 16-bit Mono (256 kbps) | Range: ~25m");
        refreshBtDevices();
    }

    private void switchToWifiMode() {
        if (audioEngine != null) {
            audioEngine.stop();
            audioEngine = null;
        }
        bluetoothController.disconnect();

        isWifiMode = true;
        layoutBtButtons.setVisibility(View.GONE);
        layoutWifiButtons.setVisibility(View.VISIBLE);
        tvStatus.setText("Status: Wi-Fi Hotspot Mode (Group Intercom, 100m)");
        tvStatus.setTextColor(Color.parseColor("#34D399"));
        tvMetrics.setText("UDP Multicast (Port 50005) | Capacity: 2-10 phones | Range: ~100m");

        displayItems.clear();
        displayItems.add("Turn on Hotspot on one phone, other phones connect to it.");
        displayItems.add("Then tap 'Join / Start Group Channel 1' above!");
        adapter.notifyDataSetChanged();
    }

    private void checkPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            List<String> perms = new ArrayList<>();
            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                perms.add(Manifest.permission.RECORD_AUDIO);
            }
            if (Build.VERSION.SDK_INT >= 31) {
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

    private void refreshBtDevices() {
        deviceList.clear();
        displayItems.clear();

        List<BluetoothDevice> paired = bluetoothController.getPairedDevices();
        for (BluetoothDevice d : paired) {
            deviceList.add(d);
            String name = d.getAddress();
            try {
                name = d.getName() != null ? d.getName() : d.getAddress();
            } catch (Exception ignored) {}
            displayItems.add("Paired: " + name + " (" + d.getAddress() + ")");
        }
        adapter.notifyDataSetChanged();
    }

    // Bluetooth Callbacks
    @Override
    public void onListening() {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                tvStatus.setText("Status: BT Host Listening for Peer (SPP UUID)...");
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
                tvStatus.setText("Status: Connected to " + deviceName + " (Full-Duplex)");
                tvStatus.setTextColor(Color.parseColor("#10B981"));

                if (audioEngine != null) audioEngine.stop();
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
                if (!isWifiMode) {
                    tvStatus.setText("Status: Bluetooth Disconnected");
                    tvStatus.setTextColor(Color.parseColor("#94A3B8"));
                }
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
                if (isWifiMode) return;
                for (BluetoothDevice existing : deviceList) {
                    if (existing.getAddress().equals(device.getAddress())) return;
                }
                deviceList.add(device);
                String name = device.getAddress();
                try {
                    name = device.getName() != null ? device.getName() : device.getAddress();
                } catch (Exception ignored) {}
                displayItems.add("Discovered: " + name + " (" + device.getAddress() + ")");
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

    // Wi-Fi Callbacks
    @Override
    public void onChannelStarted(final int channel) {
        isWifiChannelActive = true;
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                tvStatus.setText("Status: Active on Channel " + channel + " (Group Talk)");
                tvStatus.setTextColor(Color.parseColor("#10B981"));
                btnJoinWifi.setText("Leave Group Channel 1");
                btnJoinWifi.setBackgroundColor(Color.parseColor("#EF4444"));
            }
        });
    }

    @Override
    public void onPeerListUpdated(final List<String> peers) {
        if (!isWifiMode) return;
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                displayItems.clear();
                displayItems.add("• This Device (You)");
                for (String p : peers) {
                    displayItems.add("• " + p + " (Online)");
                }
                adapter.notifyDataSetChanged();
            }
        });
    }

    @Override
    public void onSpeakerChanged(final String speakerName) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                tvStatus.setText("Status: " + speakerName + " is Speaking...");
                tvStatus.setTextColor(Color.parseColor("#34D399"));
            }
        });
    }

    @Override
    public void onChannelStopped() {
        isWifiChannelActive = false;
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                btnJoinWifi.setText("Join / Start Group Channel 1");
                btnJoinWifi.setBackgroundColor(Color.parseColor("#10B981"));
                tvStatus.setText("Status: Channel Inactive (Tap Join to Start)");
                tvStatus.setTextColor(Color.parseColor("#94A3B8"));
            }
        });
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (audioEngine != null) audioEngine.stop();
        bluetoothController.release();
        wifiAudioController.stop();
    }
}
