
import React, { useState, useEffect, useCallback } from 'react';
import BreakerPanel from './components/BreakerPanel';
import type { Breaker } from './types';

const INITIAL_BREAKERS: Breaker[] = [
  { id: 'overall', name: 'Overall Breaker', isOn: false, voltage1Label: 'System Voltage', voltage2Label: 'Total Load', voltage1: 0, voltage2: 0, isOverall: true },
  { id: 'load1', name: 'Load 1', isOn: false, voltage1Label: 'Input Voltage', voltage2Label: 'Load Voltage', voltage1: 0, voltage2: 0, isOverall: false },
  { id: 'load2', name: 'Load 2', isOn: false, voltage1Label: 'Input Voltage', voltage2Label: 'Load Voltage', voltage1: 0, voltage2: 0, isOverall: false },
  { id: 'load3', name: 'Load 3', isOn: false, voltage1Label: 'Input Voltage', voltage2Label: 'Load Voltage', voltage1: 0, voltage2: 0, isOverall: false },
];

const App: React.FC = () => {
  const [breakers, setBreakers] = useState<Breaker[]>(INITIAL_BREAKERS);

  useEffect(() => {
    const interval = setInterval(() => {
      setBreakers(prevBreakers => {
        const masterBreaker = prevBreakers[0];
        const isMasterOn = masterBreaker.isOn;

        const newSystemVoltage = isMasterOn ? 12.0 + (Math.random() * 0.5 - 0.25) : 0;
        let totalLoadVoltage = 0;

        const nextBreakers = prevBreakers.map(breaker => {
          if (breaker.isOverall) {
            // Defer voltage2 update for the overall breaker
            return { ...breaker, voltage1: newSystemVoltage }; 
          }

          const newLoadVoltage = breaker.isOn && isMasterOn ? 11.8 + (Math.random() * 0.4 - 0.2) : 0;
          totalLoadVoltage += newLoadVoltage;
          
          return {
            ...breaker,
            voltage1: newSystemVoltage,
            voltage2: newLoadVoltage,
          };
        });

        // Now, update the overall breaker's total load
        nextBreakers[0].voltage2 = totalLoadVoltage;

        return nextBreakers;
      });
    }, 1000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = useCallback((id: string, newIsOn: boolean) => {
    setBreakers(prevBreakers => {
      const targetBreaker = prevBreakers.find(b => b.id === id);
      if (!targetBreaker) return prevBreakers;

      // Logic for Overall Breaker
      if (targetBreaker.isOverall) {
        if (!newIsOn) {
          // Turning master off turns everything off
          return prevBreakers.map(b => ({ ...b, isOn: false }));
        } else {
          // Turning master on
          return prevBreakers.map(b => (b.id === id ? { ...b, isOn: true } : b));
        }
      } else { // Logic for Load Breakers
        // Cannot turn on a load if master is off
        if (newIsOn && !prevBreakers[0].isOn) {
          return prevBreakers;
        }
        return prevBreakers.map(b => (b.id === id ? { ...b, isOn: newIsOn } : b));
      }
    });
  }, []);

  return (
    <main className="text-gray-100 min-h-screen w-full flex items-center justify-center p-4 sm:p-6 md:p-10">
      <div className="max-w-7xl w-full">
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
    </main>
  );
};

export default App;
