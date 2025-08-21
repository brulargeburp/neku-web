
import React, { useState, useEffect, useCallback, useRef } from 'react';
import BreakerPanel from './components/BreakerPanel';
import HistoryModal from './components/HistoryModal';
import type { Breaker, HistoryLog } from './types';

// --- Data Protocol ---
// INCOMING: 21-byte packet from device
// Byte 0:    Status Mask (Bit 0: Overall, Bit 1: Load 1, etc.)
// Bytes 1-4:   System Voltage (Float32)
// Bytes 5-8:   Total Load (Float32)
// Bytes 9-12:  Load 1 Voltage (Float32)
// Bytes 13-16: Load 2 Voltage (Float32)
// Bytes 17-20: Load 3 Voltage (Float32)
const EXPECTED_PACKET_LENGTH = 21;

// OUTGOING: Command packets to device
// CMD_TOGGLE_STATE (3 bytes): [0x01, breakerIndex, newState (0 or 1)]
// CMD_SET_MAX_VOLTAGE (6 bytes): [0x02, breakerIndex, maxVoltage (Float32)]
const CMD_TOGGLE_STATE = 0x01;
const CMD_SET_MAX_VOLTAGE = 0x02;


const INITIAL_BREAKERS: Breaker[] = [
  { id: 'overall', name: 'Overall Breaker', isOn: false, voltage1Label: 'System Voltage', voltage2Label: 'Total Load', voltage1: 0, voltage2: 0, isOverall: true },
  { id: 'load1', name: 'Load 1', isOn: false, voltage1Label: 'Load Voltage', voltage2Label: 'Max Voltage', voltage1: 0, voltage2: 0, isOverall: false, maxVoltage: 5.0 },
  { id: 'load2', name: 'Load 2', isOn: false, voltage1Label: 'Load Voltage', voltage2Label: 'Max Voltage', voltage1: 0, voltage2: 0, isOverall: false, maxVoltage: 5.0 },
  { id: 'load3', name: 'Load 3', isOn: false, voltage1Label: 'Load Voltage', voltage2Label: 'Max Voltage', voltage1: 0, voltage2: 0, isOverall: false, maxVoltage: 5.0 },
];

const App: React.FC = () => {
  const [breakers, setBreakers] = useState<Breaker[]>(INITIAL_BREAKERS);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isHistoryVisible, setIsHistoryVisible] = useState<boolean>(false);
  const [historyLogs, setHistoryLogs] = useState<HistoryLog[]>([]);
  const [isDebugMode, setIsDebugMode] = useState<boolean>(false);
  
  const portRef = useRef<SerialPort | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const keepReadingRef = useRef<boolean>(false);

  useEffect(() => {
    try {
      const storedLogs = localStorage.getItem('nekuNamiHistory');
      if (storedLogs) {
        setHistoryLogs(JSON.parse(storedLogs));
      }
    } catch (e) {
      console.error("Failed to load history logs from localStorage", e);
    }
  }, []);

  const addHistoryLogs = useCallback((newLogEntries: HistoryLog[]) => {
      if (newLogEntries.length > 0) {
        setHistoryLogs(currentLogs => {
          const updatedLogs = [...newLogEntries.reverse(), ...currentLogs];
          try {
            localStorage.setItem('nekuNamiHistory', JSON.stringify(updatedLogs));
          } catch (e) {
            console.error("Failed to save history logs to localStorage", e);
          }
          return updatedLogs;
        });
      }
  }, []);

  const onDisconnected = useCallback(() => {
    setIsConnected(false);
    writerRef.current = null;
    readerRef.current = null;
    portRef.current = null;
    setBreakers(INITIAL_BREAKERS);
    console.log('Device disconnected.');
  }, []);

  const handleStatusUpdate = (data: Uint8Array) => {
    if (data.length < EXPECTED_PACKET_LENGTH) {
      console.warn("Received incomplete data packet.");
      return;
    }

    try {
      const value = new DataView(data.buffer);
      const statusMask = value.getUint8(0);
      const systemVoltage = value.getFloat32(1, true);

      setBreakers(prevBreakers => {
        const newBreakers: Breaker[] = prevBreakers.map((b, i) => {
            const isOn = (statusMask & (1 << i)) > 0;
            let voltage1 = b.voltage1;
            let voltage2 = b.voltage2;

            if (i === 0) { // Overall
                voltage1 = systemVoltage;
                voltage2 = value.getFloat32(5, true);
            } else if (i === 1) {
                voltage1 = value.getFloat32(9, true);
            } else if (i === 2) {
                voltage1 = value.getFloat32(13, true);
            } else if (i === 3) {
                voltage1 = value.getFloat32(17, true);
            }
            return { ...b, isOn, voltage1, voltage2 };
        });

        const newLogEntries: HistoryLog[] = [];
        newBreakers.forEach((newBreaker, index) => {
          const oldBreaker = prevBreakers[index];
          if (oldBreaker.isOn !== newBreaker.isOn) { // State has changed
            newLogEntries.push({
              breakerName: newBreaker.name,
              timestamp: new Date().toISOString(),
              type: newBreaker.isOn ? 'activated' : 'deactivated',
            });
          }
        });
        
        addHistoryLogs(newLogEntries);
        return newBreakers;
      });
    } catch (e) {
      console.error("Failed to parse status update:", e);
      setError("Received malformed data from device.");
    }
  };
  
  const readLoop = async () => {
    while (portRef.current?.readable && keepReadingRef.current) {
        readerRef.current = portRef.current.readable.getReader();
        try {
            while (true) {
                const { value, done } = await readerRef.current.read();
                if (done) {
                    break;
                }
                handleStatusUpdate(value);
            }
        } catch (error) {
            console.error('Read loop error:', error);
            setError('Device communication error.');
        } finally {
            if (readerRef.current) {
              readerRef.current.releaseLock();
              readerRef.current = null;
            }
        }
    }
  }

  const handleConnect = async () => {
    if (!('serial' in navigator)) {
      setError("Web Serial API is not available in this browser.");
      return;
    }
    setError(null);
    setIsConnecting(true);

    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 });
      
      portRef.current = port;
      port.addEventListener('disconnect', onDisconnected);

      writerRef.current = port.writable!.getWriter();
      keepReadingRef.current = true;
      readLoop();
      
      setIsConnected(true);
      console.log('Connected to device via Serial Port!');

    } catch (e) {
      console.error('Connection failed:', e);
      setError(`Failed to connect: ${(e as Error).message}`);
      onDisconnected();
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    keepReadingRef.current = false;
    
    if (readerRef.current) {
        try { await readerRef.current.cancel(); } 
        catch (e) { console.warn("Error cancelling reader", e); }
    }
    if (writerRef.current) {
        try { await writerRef.current.close(); } 
        catch (e) { console.warn("Error closing writer", e); }
    }
    if (portRef.current) {
        try { await portRef.current.close(); } 
        catch(e) { console.warn("Error closing port", e); }
    }
    onDisconnected();
  };

  const handleToggle = useCallback(async (id: string, newIsOn: boolean) => {
    if (isDebugMode) {
      setBreakers(prevBreakers => {
        const toggledIndex = prevBreakers.findIndex(b => b.id === id);
        if (toggledIndex === -1 || prevBreakers[toggledIndex].isOn === newIsOn) {
          return prevBreakers; // No change
        }
  
        const newLogEntries: HistoryLog[] = [];
        const timestamp = new Date().toISOString();
  
        // Log the primary toggle event
        newLogEntries.push({
          breakerName: prevBreakers[toggledIndex].name,
          timestamp,
          type: newIsOn ? 'activated' : 'deactivated'
        });
        
        let newBreakers = prevBreakers.map((breaker, index) => {
          if (index === toggledIndex) {
            return { ...breaker, isOn: newIsOn };
          }
          return breaker;
        });
  
        // Handle cascading deactivation from main breaker
        if (toggledIndex === 0 && !newIsOn) {
          newBreakers = newBreakers.map((breaker, index) => {
            if (index > 0 && breaker.isOn) {
              newLogEntries.push({
                breakerName: breaker.name,
                timestamp,
                type: 'deactivated'
              });
              return { ...breaker, isOn: false };
            }
            return breaker;
          });
        }
  
        addHistoryLogs(newLogEntries);
        return newBreakers;
      });
      return;
    }
    
    // Serial Port Logic
    const breakerIndex = breakers.findIndex(b => b.id === id);
    if (breakerIndex === -1) return;

    if (!writerRef.current) {
        setError("Device is not connected.");
        return;
    }

    try {
        const command = new Uint8Array([CMD_TOGGLE_STATE, breakerIndex, newIsOn ? 1 : 0]);
        await writerRef.current.write(command);
    } catch (e) {
        console.error("Failed to send toggle command:", e);
        setError(`Failed to send command: ${(e as Error).message}`);
        handleDisconnect();
    }
  }, [isDebugMode, breakers, addHistoryLogs, handleDisconnect]);

  const handleSetMaxVoltage = useCallback(async (id: string, newMaxVoltage: number) => {
    const breakerIndex = INITIAL_BREAKERS.findIndex(b => b.id === id);
    if (breakerIndex === -1 || breakerIndex === 0) return;

    setBreakers(prev => prev.map(b => b.id === id ? { ...b, maxVoltage: newMaxVoltage } : b));
    
    if (isDebugMode) return;

    if (!writerRef.current) {
      setError("Device is not connected.");
      return;
    }

    try {
      const buffer = new ArrayBuffer(6);
      const view = new DataView(buffer);
      view.setUint8(0, CMD_SET_MAX_VOLTAGE);
      view.setUint8(1, breakerIndex);
      view.setFloat32(2, newMaxVoltage, true);
      
      await writerRef.current.write(new Uint8Array(buffer));
    } catch (e) {
      console.error("Failed to send max voltage command:", e);
      setError(`Failed to set max voltage: ${(e as Error).message}`);
      handleDisconnect();
    }
  }, [isDebugMode, handleDisconnect]);
  
  // Debug Mode Simulation Effect
  useEffect(() => {
    if (!isDebugMode) {
      setBreakers(INITIAL_BREAKERS);
      return;
    }

    const simulationInterval = setInterval(() => {
      setBreakers(prev => {
        const newBreakers = JSON.parse(JSON.stringify(prev));
        const newLogEntries: HistoryLog[] = [];
        let totalLoad = 0;

        newBreakers.forEach((b: Breaker, i: number) => {
          if (b.isOn) {
            if (i === 0) { // Overall Breaker
              b.voltage1 = 12.0 + (Math.random() - 0.5) * 0.2; // System Voltage
            } else { // Minor Loads
              // Simulate fluctuating voltage, go higher if maxVoltage is high
              const baseVoltage = (b.maxVoltage ?? 5.0) * 0.7;
              b.voltage1 = baseVoltage + (Math.random() - 0.2) * 2.0;
              b.voltage1 = Math.max(0, b.voltage1); // Ensure it's not negative
              totalLoad += b.voltage1;
            }
          } else {
            b.voltage1 = 0;
            if (i === 0) b.voltage2 = 0;
          }
        });
        
        if (newBreakers[0].isOn) {
            newBreakers[0].voltage2 = totalLoad;
        }

        // Simulate auto-trip
        newBreakers.forEach((b: Breaker, i: number) => {
          if (i > 0 && b.isOn && b.maxVoltage && b.voltage1 > b.maxVoltage) {
            newBreakers[i].isOn = false;
            newLogEntries.push({ 
              breakerName: b.name, 
              timestamp: new Date().toISOString(),
              type: 'deactivated'
            });
          }
        });
        
        addHistoryLogs(newLogEntries);
        return newBreakers;
      });
    }, 1200);

    return () => clearInterval(simulationInterval);
  }, [isDebugMode, addHistoryLogs]);

  useEffect(() => {
    return () => {
        if (portRef.current) {
            handleDisconnect();
        }
    };
  }, [handleDisconnect]);

  return (
    <>
      <main className="text-gray-100 min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 md:p-10">
        <div className="max-w-7xl w-full relative">
          <header className="text-center mb-8">
              <h1 className="font-orbitron text-3xl sm:text-4xl text-green-400 mb-4 tracking-wider uppercase">Neku-Nami Control Panel</h1>
              <div className="h-10">
                {!isDebugMode && (
                  <>
                    {!isConnected && !isConnecting && (
                        <button onClick={handleConnect} className="font-orbitron text-white font-bold py-3 px-6 rounded-lg bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.4)] hover:bg-blue-400 hover:shadow-[0_0_20px_rgba(59,130,246,0.6)] transition-all duration-300">
                          Connect via Serial Port
                        </button>
                    )}
                    {isConnecting && <p className="text-yellow-400 text-lg animate-pulse">Connecting...</p>}
                    {isConnected && (
                        <button onClick={handleDisconnect} className="font-orbitron text-white font-bold py-3 px-6 rounded-lg bg-red-500 shadow-[0_0_15px_rgba(255,65,65,0.4)] hover:bg-red-400 hover:shadow-[0_0_20px_rgba(255,65,65,0.6)] transition-all duration-300">
                          Disconnect
                        </button>
                    )}
                  </>
                )}
              </div>
              {error && !isDebugMode && <p className="text-red-500 mt-2 h-5">{error}</p>}
          </header>

          <div className="absolute top-0 right-0 flex items-center space-x-2">
              <div className="flex items-center space-x-2 text-green-400">
                <span className="text-xs font-bold uppercase">Debug</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={isDebugMode} onChange={() => setIsDebugMode(!isDebugMode)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
              </div>
              <button
                onClick={() => setIsHistoryVisible(true)}
                title="View Activation History"
                className="p-2 rounded-full text-green-400 hover:bg-green-400/20 transition-colors duration-300"
                aria-label="View history"
              >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
              </button>
          </div>

          <div className={`transition-opacity duration-500 ${!isConnected && !isDebugMode ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
              {breakers.map(breaker => (
                <BreakerPanel
                  key={breaker.id}
                  breaker={breaker}
                  onToggle={handleToggle}
                  isMasterOn={breakers[0].isOn}
                  onSetMaxVoltage={handleSetMaxVoltage}
                />
              ))}
            </div>
          </div>
        </div>
      </main>
      <HistoryModal
        isOpen={isHistoryVisible}
        onClose={() => setIsHistoryVisible(false)}
        logs={historyLogs}
      />
    </>
  );
};

export default App;