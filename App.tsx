
import React, { useState, useEffect, useCallback, useRef } from 'react';
import BreakerPanel from './components/BreakerPanel';
import HistoryModal from './components/HistoryModal';
import type { Breaker, HistoryLog } from './types';

// --- Data Protocol (Text-based) ---
// INCOMING: A single string line ending in '\n' from the device.
// Format: "statusMask|systemCurrent|totalLoadCurrent|load1Current|load2Current"
// Example: "3|1.25|0.80|0.80|0.00"

// OUTGOING: Command strings to the device, ending in '\n'.
// Toggle State: "T,breakerIndex,newState" (e.g., "T,1,1")
// Set Max Current: "M,breakerIndex,maxCurrent" (e.g., "M,1,4.5")
// Set Min Current: "m,breakerIndex,minCurrent" (e.g., "m,1,0.2")

const INITIAL_BREAKERS: Breaker[] = [
  { id: 'overall', name: 'Overall Breaker', isOn: false, current1Label: 'System Current', current2Label: 'Total Load', current1: 0, current2: 0, isOverall: true, lastTripReason: 'Manual' },
  { id: 'load1', name: 'Load 1', isOn: false, current1Label: 'Load Current', current2Label: 'Max Current', current1: 0, current2: 0, isOverall: false, maxCurrent: 5.0, minCurrent: 0.1, lastTripReason: 'Manual' },
  { id: 'load2', name: 'Load 2', isOn: false, current1Label: 'Load Current', current2Label: 'Max Current', current1: 0, current2: 0, isOverall: false, maxCurrent: 5.0, minCurrent: 0.1, lastTripReason: 'Manual' },
];

const App: React.FC = () => {
  const [breakers, setBreakers] = useState<Breaker[]>(INITIAL_BREAKERS);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isHistoryVisible, setIsHistoryVisible] = useState<boolean>(false);
  const [historyLogs, setHistoryLogs] = useState<HistoryLog[]>([]);
  const [isDebugMode, setIsDebugMode] = useState<boolean>(false);
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
  
  const portRef = useRef<SerialPort | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const keepReadingRef = useRef<boolean>(false);
  const lineBufferRef = useRef<string>('');
  const textDecoder = useRef(new TextDecoder('utf-8'));
  const textEncoder = useRef(new TextEncoder());

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

  useEffect(() => {
    if (isDebugMode) {
      const intervalId = window.setInterval(() => {
        setBreakers(prev => {
          const newLogEntries: HistoryLog[] = [];
          const timestamp = new Date().toISOString();

          const newLoad1Current = Math.random() * 6.0; // Increased range to test trips
          const newLoad2Current = Math.random() * 6.0;
          const totalLoad = newLoad1Current + newLoad2Current;
          const systemCurrent = totalLoad + (Math.random() * 0.5);

          let intermediateBreakers = prev.map(b => {
            if (b.id === 'overall') {
              return { ...b, current1: systemCurrent, current2: totalLoad };
            }
            if (b.id === 'load1') {
              return { ...b, current1: newLoad1Current };
            }
            if (b.id === 'load2') {
              return { ...b, current1: newLoad2Current };
            }
            return b;
          });

          const finalBreakers = intermediateBreakers.map(b => {
            if (b.isOverall || !b.isOn) return b;

            let tripReason: string | null = null;
            if (b.maxCurrent && b.current1 >= b.maxCurrent) {
              tripReason = 'Overload';
            } else if (b.minCurrent && b.current1 > 0 && b.current1 < b.minCurrent) {
              tripReason = 'Short Circuit';
            }

            if (tripReason) {
              newLogEntries.push({ breakerName: b.name, timestamp, type: 'deactivated', reason: tripReason });
              return { ...b, isOn: false, lastTripReason: tripReason };
            }
            return b;
          });
          
          if (newLogEntries.length > 0) {
            addHistoryLogs(newLogEntries);
          }
          return finalBreakers;
        });
      }, 1200);

      return () => clearInterval(intervalId);
    } else {
        if (!isConnected) {
            setBreakers(INITIAL_BREAKERS);
        }
    }
  }, [isDebugMode, isConnected, addHistoryLogs]);

  const onDisconnected = useCallback(() => {
    setIsConnected(false);
    writerRef.current = null;
    readerRef.current = null;
    portRef.current = null;
    lineBufferRef.current = '';
    setBreakers(INITIAL_BREAKERS);
    console.log('Device disconnected.');
  }, []);
  
  const writeCommand = async (command: string) => {
    if (!writerRef.current) {
      // Don't show an error here, as it can be called during normal trip logic
      // and we don't want to spam the user if they're not connected.
      return false;
    }
    try {
      const encoded = textEncoder.current.encode(command);
      await writerRef.current.write(encoded);
      return true;
    } catch (e) {
      console.error(`Failed to send command "${command}":`, e);
      setError(`Failed to send command: ${(e as Error).message}`);
      handleDisconnect();
      return false;
    }
  };

  const parseAndProcessLine = (line: string) => {
    try {
      const parts = line.split('|');
      if (parts.length < 5) {
        console.warn("Received incomplete data line:", line);
        return;
      }

      const statusMask = parseInt(parts[0], 10);
      const systemCurrent = parseFloat(parts[1]);
      const totalLoad = parseFloat(parts[2]);
      const load1Current = parseFloat(parts[3]);
      const load2Current = parseFloat(parts[4]);

      setBreakers(prevBreakers => {
        const newLogEntries: HistoryLog[] = [];
        
        const breakersWithNewCurrents = prevBreakers.map((b, i) => {
            let current1 = b.current1, current2 = b.current2;
            if (i === 0) { current1 = systemCurrent; current2 = totalLoad; }
            else if (i === 1) { current1 = load1Current; }
            else if (i === 2) { current1 = load2Current; }
            return { ...b, current1, current2 };
        });

        const newBreakers = breakersWithNewCurrents.map((b, i) => {
            const oldIsOn = prevBreakers[i].isOn;
            let isOn = (statusMask & (1 << i)) > 0;
            let lastTripReason = b.lastTripReason;
            let reasonForChange: string | null = null;

            if (oldIsOn) {
                if (b.maxCurrent && b.current1 >= b.maxCurrent) {
                    reasonForChange = 'Overload';
                } else if (b.minCurrent && b.current1 > 0 && b.current1 < b.minCurrent) {
                    reasonForChange = 'Short Circuit';
                }

                if (reasonForChange) {
                    isOn = false; // Force turn off, overriding status from device
                    const breakerIndex = INITIAL_BREAKERS.findIndex(ib => ib.id === b.id);
                    if (breakerIndex > 0) {
                        writeCommand(`T,${breakerIndex},0\n`);
                    }
                }
            }

            if (oldIsOn !== isOn) {
                const timestamp = new Date().toISOString();
                if (isOn) {
                    newLogEntries.push({ breakerName: b.name, timestamp, type: 'activated', reason: 'Manual' });
                } else {
                    if (!reasonForChange) {
                        const previousState = prevBreakers[i];
                        if (prevBreakers[0].isOn && !(statusMask & 1)) {
                            reasonForChange = 'System Off';
                        } else if (!previousState.isOverall && previousState.maxCurrent && previousState.current1 >= previousState.maxCurrent) {
                            reasonForChange = 'Overload';
                        } else if (!previousState.isOverall && previousState.minCurrent && previousState.current1 > 0 && previousState.current1 < previousState.minCurrent) {
                            reasonForChange = 'Short Circuit';
                        } else {
                            reasonForChange = 'Manual';
                        }
                    }
                    lastTripReason = reasonForChange;
                    newLogEntries.push({ breakerName: b.name, timestamp, type: 'deactivated', reason: reasonForChange });
                }
            }
            return { ...b, isOn, lastTripReason };
        });
        
        addHistoryLogs(newLogEntries);
        return newBreakers;
      });
    } catch (e) {
      console.error("Failed to parse status update line:", line, e);
      setError("Received malformed data from device.");
    }
  };
  
  const processData = (chunk: string) => {
    lineBufferRef.current += chunk;
    let newlineIndex;
    while ((newlineIndex = lineBufferRef.current.indexOf('\n')) !== -1) {
        const line = lineBufferRef.current.slice(0, newlineIndex).trim();
        lineBufferRef.current = lineBufferRef.current.slice(newlineIndex + 1);
        if (line) {
            parseAndProcessLine(line);
        }
    }
  };

  const readLoop = async () => {
    if (!portRef.current?.readable) return;

    readerRef.current = portRef.current.readable.getReader();

    while (keepReadingRef.current) {
        try {
            const { value, done } = await readerRef.current.read();
            if (done) break;
            const textChunk = textDecoder.current.decode(value, { stream: true });
            processData(textChunk);
        } catch (error) {
            if (keepReadingRef.current) {
                console.error("Fatal read error, connection likely lost.", error);
            }
            break;
        }
    }

    if (readerRef.current) {
        try { 
            readerRef.current.releaseLock();
        } catch(e) { /* Lock might already have been released. */ }
        readerRef.current = null;
    }
  };

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
      
      await new Promise(resolve => setTimeout(resolve, 250));
      
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
        portRef.current.removeEventListener('disconnect', onDisconnected);
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
          return prevBreakers;
        }
  
        const newLogEntries: HistoryLog[] = [];
        const timestamp = new Date().toISOString();
  
        newLogEntries.push({
          breakerName: prevBreakers[toggledIndex].name,
          timestamp,
          type: newIsOn ? 'activated' : 'deactivated',
          reason: 'Manual',
        });
        
        let newBreakers = prevBreakers.map((breaker, index) => {
          if (index === toggledIndex) {
            return { ...breaker, isOn: newIsOn, lastTripReason: 'Manual' };
          }
          return breaker;
        });
  
        if (toggledIndex === 0 && !newIsOn) {
          newBreakers = newBreakers.map((breaker, index) => {
            if (index > 0 && breaker.isOn) {
              newLogEntries.push({
                breakerName: breaker.name,
                timestamp,
                type: 'deactivated',
                reason: 'System Off'
              });
              return { ...breaker, isOn: false, lastTripReason: 'System Off' };
            }
            return breaker;
          });
        }
  
        addHistoryLogs(newLogEntries);
        return newBreakers;
      });
      return;
    }
    
    const breakerIndex = breakers.findIndex(b => b.id === id);
    if (breakerIndex === -1) return;
    const command = `T,${breakerIndex},${newIsOn ? 1 : 0}\n`;
    await writeCommand(command);
  }, [isDebugMode, breakers, addHistoryLogs]);

  const handleSetMaxCurrent = useCallback(async (id: string, newMaxCurrent: number) => {
    const breakerIndex = INITIAL_BREAKERS.findIndex(b => b.id === id);
    if (breakerIndex === -1 || breakerIndex === 0) return;

    setBreakers(prev => prev.map(b => b.id === id ? { ...b, maxCurrent: newMaxCurrent } : b));
    
    if (isDebugMode) return;
    const command = `M,${breakerIndex},${newMaxCurrent.toFixed(3)}\n`;
    await writeCommand(command);
  }, [isDebugMode]);
  
  const handleSetMinCurrent = useCallback(async (id: string, newMinCurrent: number) => {
    const breakerIndex = INITIAL_BREAKERS.findIndex(b => b.id === id);
    if (breakerIndex === -1 || breakerIndex === 0) return;

    setBreakers(prev => prev.map(b => b.id === id ? { ...b, minCurrent: newMinCurrent } : b));

    if (isDebugMode) return;
    const command = `m,${breakerIndex},${newMinCurrent.toFixed(3)}\n`;
    await writeCommand(command);
  }, [isDebugMode]);
  
  const clearHistory = () => {
    setHistoryLogs([]);
    try {
      localStorage.removeItem('nekuNamiHistory');
    } catch (e) {
      console.error("Failed to clear history from localStorage", e);
    }
  };
  
  const handleAdminModeToggle = () => {
    if (!isAdminMode) {
      const password = prompt("Admin Mode requires a password:");
      if (password === "nekunami_dev") {
        setIsAdminMode(true);
      } else if (password !== null) {
        alert("Incorrect password. Access denied.");
      }
    } else {
      setIsAdminMode(false);
    }
  };

  const masterBreaker = breakers[0];

  return (
    <div className="bg-[#1a1a1a] min-h-screen text-gray-100 p-4 sm:p-6 lg:p-8">
      <HistoryModal
        isOpen={isHistoryVisible}
        onClose={() => setIsHistoryVisible(false)}
        logs={historyLogs}
        onClearHistory={clearHistory}
      />
      <header className="flex flex-col sm:flex-row justify-between items-center mb-8">
        <h1 className="font-orbitron text-4xl text-green-400 drop-shadow-[0_0_10px_#00ff7f] tracking-widest mb-4 sm:mb-0">
          Neku-Nami Control
        </h1>
        <div className="flex items-center space-x-4">
           <button 
            onClick={() => setIsHistoryVisible(true)}
            className="font-orbitron text-sm text-white font-bold py-2 px-4 rounded-lg bg-gray-700/50 border border-green-400/30 hover:bg-gray-600/70 transition-colors"
            aria-label="View activation history"
          >
            HISTORY
          </button>
          <button
            onClick={isConnected ? handleDisconnect : handleConnect}
            disabled={isConnecting}
            className={`font-orbitron text-sm text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 ${
              isConnected
                ? 'bg-red-500 shadow-[0_0_10px_rgba(255,65,65,0.4)] hover:bg-red-400'
                : 'bg-green-500 shadow-[0_0_10px_rgba(0,255,127,0.4)] hover:bg-green-400'
            } disabled:bg-gray-600/50 disabled:shadow-none disabled:cursor-wait`}
            aria-live="polite"
          >
            {isConnecting ? 'CONNECTING...' : isConnected ? 'DISCONNECT' : 'CONNECT'}
          </button>
        </div>
      </header>
      
      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-300 p-4 rounded-lg mb-6 text-center" role="alert">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <BreakerPanel
          breaker={masterBreaker}
          onToggle={handleToggle}
          isMasterOn={true}
          onSetMaxCurrent={handleSetMaxCurrent}
          onSetMinCurrent={handleSetMinCurrent}
          isAdminMode={isAdminMode}
        />
        {breakers.slice(1).map(breaker => (
          <BreakerPanel
            key={breaker.id}
            breaker={breaker}
            onToggle={handleToggle}
            isMasterOn={masterBreaker.isOn}
            onSetMaxCurrent={handleSetMaxCurrent}
            onSetMinCurrent={handleSetMinCurrent}
            isAdminMode={isAdminMode}
          />
        ))}
      </div>
      
      <footer className="mt-8 text-center text-gray-500 text-xs">
          <div className="flex justify-center items-center space-x-4 mb-2">
              <div className="flex items-center space-x-2">
                  <label htmlFor="admin-mode-toggle">Admin Mode</label>
                  <input
                      id="admin-mode-toggle"
                      type="checkbox"
                      checked={isAdminMode}
                      onChange={handleAdminModeToggle}
                      className="form-checkbox h-4 w-4 text-green-500 bg-gray-800 border-gray-600 rounded focus:ring-green-500"
                  />
              </div>
              <div className="flex items-center space-x-2">
                  <label htmlFor="debug-mode-toggle">Debug Mode</label>
                  <input
                      id="debug-mode-toggle"
                      type="checkbox"
                      checked={isDebugMode}
                      onChange={() => setIsDebugMode(!isDebugMode)}
                      className="form-checkbox h-4 w-4 text-green-500 bg-gray-800 border-gray-600 rounded focus:ring-green-500"
                  />
              </div>
          </div>
          <p>Neku-Nami IoT Breaker Interface v1.1.0 | Status: {isConnected ? <span className="text-green-400">Connected</span> : <span className="text-red-500">Disconnected</span>}</p>
      </footer>
    </div>
  );
};

export default App;
