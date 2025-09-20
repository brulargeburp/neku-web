import React, { useState, useEffect, useCallback, useRef } from 'react';
import BreakerPanel from './components/BreakerPanel';
import HistoryModal from './components/HistoryModal';
import SettingsModal from './components/SettingsModal';
import AboutModal from './components/AboutModal';
import LoginPage from './components/LoginPage';
import type { Breaker, HistoryLog } from './types';

// --- Data Protocol (Text-based) ---
// INCOMING: A single string line ending in '\n' from the device.
// Format: "statusMask|systemCurrent|totalLoadCurrent|load1Current|load2Current"
// Example: "3|1.25|0.80|0.80|0.00"

// OUTGOING: Command strings to the device, ending in '\n'.
// Toggle State: "T,breakerIndex,newState" (e.g., "T,1,1")
// Set Max Current: "M,breakerIndex,maxCurrent" (e.g., "M,1,4.5")
// Set Min Current: "m,breakerIndex,minCurrent" (e.g., "m,1,0.2")
// Set Grace Period: "G,breakerIndex,gracePeriodMs" (e.g., "G,1,250")

const INITIAL_BREAKERS: Breaker[] = [
  { id: 'overall', name: 'Overall Breaker', isOn: false, current1Label: 'System Current', current2Label: 'Total Load', current1: 0, current2: 0, isOverall: true, lastTripReason: 'Manual' },
  { id: 'load1', name: 'Load 1', isOn: false, current1Label: 'Load Current', current2Label: 'Max Current', current1: 0, current2: 0, isOverall: false, maxCurrent: 3.0, minCurrent: 0.0, gracePeriodMs: 500, lastTripReason: 'Manual' },
  // { id: 'load2', name: 'Load 2', isOn: false, current1Label: 'Load Current', current2Label: 'Max Current', current1: 0, current2: 0, isOverall: false, maxCurrent: 3.0, minCurrent: 0.0, gracePeriodMs: 500, lastTripReason: 'Manual' },
];

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [breakers, setBreakers] = useState<Breaker[]>(INITIAL_BREAKERS);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isHistoryVisible, setIsHistoryVisible] = useState<boolean>(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState<boolean>(false);
  const [isAboutVisible, setIsAboutVisible] = useState<boolean>(false);
  const [historyLogs, setHistoryLogs] = useState<HistoryLog[]>([]);
  const [isDebugMode, setIsDebugMode] = useState<boolean>(false);
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
  const [audioSrc, setAudioSrc] = useState<string>('assets/beep.wav');
  const [isPreviewPlaying, setIsPreviewPlaying] = useState<boolean>(false);
  const [load1Offset, setLoad1Offset] = useState<number>(0);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  
  const portRef = useRef<SerialPort | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const keepReadingRef = useRef<boolean>(false);
  const lineBufferRef = useRef<string>('');
  const textDecoder = useRef(new TextDecoder('utf-8'));
  const textEncoder = useRef(new TextEncoder());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const prevBreakersRef = useRef<Breaker[] | undefined>(undefined);

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
    
    try {
      const customSfx = localStorage.getItem('nekuNamiCustomSfx');
      if (customSfx) {
        setAudioSrc(customSfx);
      }
      const savedOffset = localStorage.getItem('nekuNamiLoad1Offset');
      if (savedOffset) {
        setLoad1Offset(parseFloat(savedOffset) || 0);
      }
    } catch (e) {
      console.error("Failed to load settings from localStorage", e);
    }
  }, []);
  
  useEffect(() => {
    const audioEl = audioRef.current;
    if (audioEl) {
        const onEnded = () => setIsPreviewPlaying(false);
        const onPause = () => setIsPreviewPlaying(false);

        audioEl.addEventListener('ended', onEnded);
        audioEl.addEventListener('pause', onPause);

        return () => {
            audioEl.removeEventListener('ended', onEnded);
            audioEl.removeEventListener('pause', onPause);
        };
    }
  }, [audioSrc]);

  useEffect(() => {
    const prevBreakers = prevBreakersRef.current;
    if (prevBreakers) {
      breakers.forEach((breaker, index) => {
        const prevBreaker = prevBreakers[index];
        if (prevBreaker && prevBreaker.lastTripReason !== breaker.lastTripReason && 
            (breaker.lastTripReason === 'Overload' || breaker.lastTripReason === 'Short Circuit')) {
          
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(e => console.error("Error playing alert sound:", e));
          }

          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`${breaker.name} Turned Off`, {
              body: `Reason: ${breaker.lastTripReason}`,
              icon: '/favicon.png' 
            });
          }
        }
      });
    }
    prevBreakersRef.current = breakers;
  }, [breakers]);

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

          const newLoad1Current = Math.random() * 4.0;
          const totalLoad = newLoad1Current;
          const systemCurrent = totalLoad + (Math.random() * 0.5);

          let intermediateBreakers = prev.map(b => {
            if (b.id === 'overall') {
              return { ...b, current1: systemCurrent, current2: totalLoad };
            }
            if (b.id === 'load1') {
              return { ...b, current1: newLoad1Current };
            }
            return b;
          });

          const finalBreakers = intermediateBreakers.map(b => {
            if (b.isOverall || !b.isOn) return b;

            let tripReason: string | null = null;
            if (b.maxCurrent && b.current1 >= b.maxCurrent) {
              tripReason = 'Overload';
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
            const isOn = (statusMask & (1 << i)) > 0;
            let lastTripReason = b.lastTripReason;
  
            if (oldIsOn !== isOn) {
                const timestamp = new Date().toISOString();
                let reasonForChange: string;
  
                if (isOn) {
                    reasonForChange = 'Manual';
                    newLogEntries.push({ breakerName: b.name, timestamp, type: 'activated', reason: reasonForChange });
                } else {
                    if (!b.isOverall && b.maxCurrent && b.current1 >= b.maxCurrent) {
                        reasonForChange = 'Overload';
                    } else if (!b.isOverall && b.minCurrent !== undefined && b.current1 > 0 && b.current1 < b.minCurrent) {
                        reasonForChange = 'Short Circuit';
                    } else if (prevBreakers[0].isOn && !(statusMask & 1)) {
                        reasonForChange = 'System Off';
                    } else {
                        reasonForChange = 'Manual';
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

    let valueToSend = newMaxCurrent;
    if (id === 'load1') {
      valueToSend -= load1Offset;
    }
    
    const command = `M,${breakerIndex},${valueToSend.toFixed(3)}\n`;
    await writeCommand(command);
  }, [isDebugMode, load1Offset]);
  
  const handleSetMinCurrent = useCallback(async (id: string, newMinCurrent: number) => {
    const breakerIndex = INITIAL_BREAKERS.findIndex(b => b.id === id);
    if (breakerIndex === -1 || breakerIndex === 0) return;

    setBreakers(prev => prev.map(b => b.id === id ? { ...b, minCurrent: newMinCurrent } : b));

    if (isDebugMode) return;

    let valueToSend = newMinCurrent;
    if (id === 'load1') {
      valueToSend -= load1Offset;
    }

    const command = `m,${breakerIndex},${valueToSend.toFixed(3)}\n`;
    await writeCommand(command);
  }, [isDebugMode, load1Offset]);

  const handleSetGracePeriod = useCallback(async (id: string, newGracePeriod: number) => {
    const breakerIndex = INITIAL_BREAKERS.findIndex(b => b.id === id);
    if (breakerIndex === -1 || breakerIndex === 0) return;

    setBreakers(prev => prev.map(b => b.id === id ? { ...b, gracePeriodMs: newGracePeriod } : b));

    if (isDebugMode) return;
    const command = `G,${breakerIndex},${newGracePeriod}\n`;
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

  const handleSfxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setAudioSrc(result);
        try {
          localStorage.setItem('nekuNamiCustomSfx', result);
        } catch (err) {
          console.error("Failed to save custom SFX to localStorage", err);
          setError("Could not save the new sound file. It might be too large.");
        }
      };
      reader.onerror = () => {
        console.error("Failed to read the selected file.");
        setError("An error occurred while trying to read the sound file.");
      };
      reader.readAsDataURL(file);
    } else if (file) {
      setError("Invalid file type. Please select an audio file.");
    }
  };

  const triggerSfxFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handlePreviewSfx = () => {
    const audioEl = audioRef.current;
    if (audioEl) {
      if (isPreviewPlaying) {
        audioEl.pause();
        audioEl.currentTime = 0; // Stop and rewind
      } else {
        audioEl.currentTime = 0; // Rewind before playing
        const playPromise = audioEl.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            setIsPreviewPlaying(true);
          }).catch(error => {
            console.error("Error previewing sound:", error);
            setIsPreviewPlaying(false);
          });
        }
      }
    }
  };

  const handleSetLoad1Offset = (value: number) => {
    setLoad1Offset(value);
    try {
      localStorage.setItem('nekuNamiLoad1Offset', value.toString());
    } catch (e) {
      console.error("Failed to save load 1 offset to localStorage", e);
    }
  };

  const handleEnableNotifications = useCallback(async () => {
    if (!('Notification' in window)) {
      setError("This browser does not support desktop notification.");
      return;
    }
    
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    
    if (permission === 'granted') {
      new Notification('Neku-Nami Notifications Enabled!', {
        body: 'You will now receive alerts for breaker trips.',
        icon: '/favicon.png'
      });
    }
  }, []);

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  const masterBreaker = breakers[0];

  return (
    <div className="bg-[#121212] min-h-screen text-gray-100 p-4 sm:p-6 lg:p-8">
      <audio ref={audioRef} src={audioSrc} preload="auto" aria-hidden="true" />
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleSfxChange}
        accept="audio/*"
        style={{ display: 'none' }}
        aria-hidden="true"
      />
      
      <SettingsModal
        isOpen={isSettingsVisible}
        onClose={() => setIsSettingsVisible(false)}
        onShowHistory={() => {
          setIsSettingsVisible(false);
          setIsHistoryVisible(true);
        }}
        onShowAbout={() => {
          setIsSettingsVisible(false);
          setIsAboutVisible(true);
        }}
        onChangeSfx={triggerSfxFilePicker}
        onPreviewSfx={handlePreviewSfx}
        audioSrc={audioSrc}
        isPreviewing={isPreviewPlaying}
        load1Offset={load1Offset}
        onSetLoad1Offset={handleSetLoad1Offset}
        notificationPermission={notificationPermission}
        onEnableNotifications={handleEnableNotifications}
      />
      <AboutModal
        isOpen={isAboutVisible}
        onClose={() => setIsAboutVisible(false)}
      />
      <HistoryModal
        isOpen={isHistoryVisible}
        onClose={() => setIsHistoryVisible(false)}
        logs={historyLogs}
        onClearHistory={clearHistory}
      />
      <header className="flex flex-col sm:flex-row justify-between items-center mb-8">
        <h1 className="font-orbitron text-4xl text-[#00ff7f] drop-shadow-[0_0_10px_rgba(0,255,127,0.5)] tracking-widest mb-4 sm:mb-0">
          Neku-Nami Control
        </h1>
        <div className="flex items-center space-x-2 sm:space-x-4">
          <button
            onClick={isConnected ? handleDisconnect : handleConnect}
            disabled={isConnecting}
            className={`font-orbitron text-sm text-white font-bold py-2 px-6 rounded-lg transition-all duration-300 ${
              isConnected
                ? 'bg-red-600 shadow-[0_0_10px_rgba(255,65,65,0.4)] hover:bg-red-500'
                : 'bg-green-600 shadow-[0_0_10px_rgba(0,255,127,0.4)] hover:bg-green-500'
            } disabled:bg-gray-600/50 disabled:shadow-none disabled:cursor-wait`}
            aria-live="polite"
          >
            {isConnecting ? 'CONNECTING...' : isConnected ? 'DISCONNECT' : 'CONNECT'}
          </button>
           <button 
            onClick={() => setIsSettingsVisible(true)}
            className="p-2.5 rounded-lg bg-[#282828] border border-gray-600/80 hover:border-green-400/50 hover:bg-gray-800/50 transition-colors"
            aria-label="Open settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </header>
      
      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-300 p-4 rounded-lg mb-6 flex justify-between items-center" role="alert">
          <p>{error}</p>
          <button 
            onClick={() => setError(null)} 
            className="ml-4 p-1 rounded-full hover:bg-red-800/50 transition-colors"
            aria-label="Dismiss error"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BreakerPanel
          breaker={masterBreaker}
          onToggle={handleToggle}
          onSetMaxCurrent={handleSetMaxCurrent}
          onSetMinCurrent={handleSetMinCurrent}
          onSetGracePeriod={handleSetGracePeriod}
          isAdminMode={isAdminMode}
        />
        {breakers.slice(1).map(breaker => {
            const displayBreaker = { ...breaker };
            if (breaker.id === 'load1') {
              displayBreaker.current1 += load1Offset;
            }
            return (
              <BreakerPanel
                key={breaker.id}
                breaker={displayBreaker}
                onToggle={handleToggle}
                onSetMaxCurrent={handleSetMaxCurrent}
                onSetMinCurrent={handleSetMinCurrent}
                onSetGracePeriod={handleSetGracePeriod}
                isAdminMode={isAdminMode}
              />
            );
        })}
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
          <p>Neku-Nami IoT Breaker Interface v1.5 | Status: {isConnected ? <span className="text-[#00ff7f]">Connected</span> : <span className="text-[#ff4141]">Disconnected</span>}</p>
      </footer>
    </div>
  );
};

export default App;