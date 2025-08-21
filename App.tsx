
import React, { useState, useEffect, useCallback } from 'react';
import BreakerPanel from './components/BreakerPanel';
import type { Breaker } from './types';

// NOTE: These UUIDs and the data protocol must match your IoT device's firmware.
// This is a common example configuration for a simple BLE device.
const SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const CONTROL_CHARACTERISTIC_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb'; // Write commands here
const STATUS_CHARACTERISTIC_UUID = '0000ffe2-0000-1000-8000-00805f9b34fb'; // Subscribe to notifications for updates

const INITIAL_BREAKERS: Breaker[] = [
  { id: 'overall', name: 'Overall Breaker', isOn: false, voltage1Label: 'System Voltage', voltage2Label: 'Total Load', voltage1: 0, voltage2: 0, isOverall: true },
  { id: 'load1', name: 'Load 1', isOn: false, voltage1Label: 'Input Voltage', voltage2Label: 'Load Voltage', voltage1: 0, voltage2: 0, isOverall: false },
  { id: 'load2', name: 'Load 2', isOn: false, voltage1Label: 'Input Voltage', voltage2Label: 'Load Voltage', voltage1: 0, voltage2: 0, isOverall: false },
  { id: 'load3', name: 'Load 3', isOn: false, voltage1Label: 'Input Voltage', voltage2Label: 'Load Voltage', voltage1: 0, voltage2: 0, isOverall: false },
];

const App: React.FC = () => {
  const [breakers, setBreakers] = useState<Breaker[]>(INITIAL_BREAKERS);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [device, setDevice] = useState<BluetoothDevice | null>(null);
  const [controlCharacteristic, setControlCharacteristic] = useState<BluetoothRemoteGATTCharacteristic | null>(null);

  const onDisconnected = useCallback(() => {
    setIsConnected(false);
    setDevice(null);
    setControlCharacteristic(null);
    setBreakers(INITIAL_BREAKERS);
    console.log('Device disconnected.');
  }, []);
  
  const handleStatusUpdate = (event: Event) => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (!value) return;

    try {
      // Data Protocol:
      // Byte 0: Status Mask (1 bit per breaker: 0=OFF, 1=ON)
      // - Bit 0: Overall, Bit 1: Load 1, Bit 2: Load 2, Bit 3: Load 3
      // Bytes 1-4:   Overall Breaker Voltage 1 (System Voltage) (Float32)
      // Bytes 5-8:   Overall Breaker Voltage 2 (Total Load) (Float32)
      // Bytes 9-12:  Load 1 Voltage 2 (Load Voltage) (Float32)
      // Bytes 13-16: Load 2 Voltage 2 (Load Voltage) (Float32)
      // Bytes 17-20: Load 3 Voltage 2 (Load Voltage) (Float32)
      // Total size: 21 bytes. Assumes Little Endian format.

      const statusMask = value.getUint8(0);
      const systemVoltage = value.getFloat32(1, true);

      setBreakers(prev => [
        { ...prev[0], isOn: (statusMask & 1) > 0, voltage1: systemVoltage, voltage2: value.getFloat32(5, true) },
        { ...prev[1], isOn: (statusMask & 2) > 0, voltage1: systemVoltage, voltage2: value.getFloat32(9, true) },
        { ...prev[2], isOn: (statusMask & 4) > 0, voltage1: systemVoltage, voltage2: value.getFloat32(13, true) },
        { ...prev[3], isOn: (statusMask & 8) > 0, voltage1: systemVoltage, voltage2: value.getFloat32(17, true) },
      ]);
    } catch (e) {
      console.error("Failed to parse status update:", e);
      setError("Received malformed data from device.");
    }
  };

  const handleConnect = async () => {
    if (!navigator.bluetooth) {
      setError("Web Bluetooth API is not available in this browser.");
      return;
    }
    setError(null);
    setIsConnecting(true);
    try {
      const bleDevice = await navigator.bluetooth.requestDevice({
        filters: [{ services: [SERVICE_UUID] }],
        optionalServices: [SERVICE_UUID]
      });
      setDevice(bleDevice);
      
      bleDevice.addEventListener('gattserverdisconnected', onDisconnected);

      const server = await bleDevice.gatt?.connect();
      const service = await server?.getPrimaryService(SERVICE_UUID);
      
      const controlChar = await service?.getCharacteristic(CONTROL_CHARACTERISTIC_UUID);
      setControlCharacteristic(controlChar || null);

      const statusChar = await service?.getCharacteristic(STATUS_CHARACTERISTIC_UUID);
      await statusChar?.startNotifications();
      statusChar?.addEventListener('characteristicvaluechanged', handleStatusUpdate);

      setIsConnected(true);
      console.log('Connected to device!');
    } catch (e) {
      console.error('Connection failed:', e);
      setError(`Failed to connect: ${e.message}`);
      onDisconnected();
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    device?.gatt?.disconnect();
  };

  const handleToggle = useCallback(async (id: string, newIsOn: boolean) => {
    if (!controlCharacteristic) {
        setError("Control characteristic not available.");
        return;
    }
    // Command Protocol: 2 bytes
    // Byte 0: Breaker index (0=Overall, 1=Load1, ...)
    // Byte 1: State (0=OFF, 1=ON)
    const breakerIndex = INITIAL_BREAKERS.findIndex(b => b.id === id);
    if (breakerIndex === -1) return;

    try {
        const command = new Uint8Array([breakerIndex, newIsOn ? 1 : 0]);
        await controlCharacteristic.writeValue(command);
    } catch (e) {
        console.error("Failed to send command:", e);
        setError(`Failed to send command: ${e.message}`);
    }
  }, [controlCharacteristic]);
  
  // Cleanup event listeners on component unmount
  useEffect(() => {
    return () => {
        device?.removeEventListener('gattserverdisconnected', onDisconnected);
    };
  }, [device, onDisconnected]);


  return (
    <main className="text-gray-100 min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 md:p-10">
      <div className="max-w-7xl w-full">
        <header className="text-center mb-8">
            <h1 className="font-orbitron text-3xl sm:text-4xl text-green-400 mb-4 tracking-wider uppercase">IoT Control Panel</h1>
            <div className="h-10">
              {!isConnected && !isConnecting && (
                  <button onClick={handleConnect} className="font-orbitron text-white font-bold py-3 px-6 rounded-lg bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.4)] hover:bg-blue-400 hover:shadow-[0_0_20px_rgba(59,130,246,0.6)] transition-all duration-300">
                    Connect to Device
                  </button>
              )}
              {isConnecting && <p className="text-yellow-400 text-lg animate-pulse">Connecting...</p>}
              {isConnected && (
                  <button onClick={handleDisconnect} className="font-orbitron text-white font-bold py-3 px-6 rounded-lg bg-red-500 shadow-[0_0_15px_rgba(255,65,65,0.4)] hover:bg-red-400 hover:shadow-[0_0_20px_rgba(255,65,65,0.6)] transition-all duration-300">
                    Disconnect
                  </button>
              )}
            </div>
            {error && <p className="text-red-500 mt-2 h-5">{error}</p>}
        </header>
        <div className={`transition-opacity duration-500 ${!isConnected ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
            {breakers.map(breaker => (
              <BreakerPanel
                key={breaker.id}
                breaker={breaker}
                onToggle={handleToggle}
                isMasterOn={breakers[0].isOn}
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
};

export default App;
