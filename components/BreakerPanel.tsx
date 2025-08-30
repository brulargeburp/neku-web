
import React, { useState, useEffect } from 'react';
import type { Breaker } from '../types';

interface BreakerPanelProps {
  breaker: Breaker;
  onToggle: (id: string, newState: boolean) => void;
  isMasterOn: boolean;
  onSetMaxCurrent: (id: string, value: number) => void;
  onSetMinCurrent: (id: string, value: number) => void;
  isAdminMode: boolean;
}

const BreakerPanel: React.FC<BreakerPanelProps> = ({ breaker, onToggle, isMasterOn, onSetMaxCurrent, onSetMinCurrent, isAdminMode }) => {
  const { id, name, isOn, current1Label, current2Label, current1, current2, isOverall, maxCurrent, minCurrent, lastTripReason } = breaker;

  const [editableMaxCurrent, setEditableMaxCurrent] = useState<string>(maxCurrent?.toFixed(2) ?? '5.00');
  const [editableMinCurrent, setEditableMinCurrent] = useState<string>(minCurrent?.toFixed(2) ?? '0.10');

  useEffect(() => {
    setEditableMaxCurrent(maxCurrent?.toFixed(2) ?? '5.00');
  }, [maxCurrent]);

  useEffect(() => {
    setEditableMinCurrent(minCurrent?.toFixed(2) ?? '0.10');
  }, [minCurrent]);

  const handleMaxCurrentBlur = () => {
    const value = parseFloat(editableMaxCurrent);
    if (!isNaN(value) && value >= 0 && value !== maxCurrent) {
      onSetMaxCurrent(id, value);
    } else {
      setEditableMaxCurrent(maxCurrent?.toFixed(2) ?? '5.00');
    }
  };
  
  const handleMinCurrentBlur = () => {
    const value = parseFloat(editableMinCurrent);
    if (!isNaN(value) && value >= 0 && value !== minCurrent) {
      onSetMinCurrent(id, value);
    } else {
      setEditableMinCurrent(minCurrent?.toFixed(2) ?? '0.10');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  const canTurnOn = isOverall || isMasterOn;
  
  const statusText = isOn ? "NORMAL" : (lastTripReason ?? 'OFF');
  const statusColor = isOn ? "text-green-400" : (lastTripReason === 'Overload' || lastTripReason === 'Short Circuit' ? "text-yellow-400" : "text-red-500");

  return (
    <div className={`bg-[#282828] rounded-2xl p-6 md:p-8 border border-green-400/30 shadow-2xl shadow-green-500/10 text-center flex flex-col justify-between ${isOverall ? 'min-h-[380px]' : 'min-h-[460px]'} transition-all duration-500`}>
      <div>
        <h1 className="font-orbitron text-green-400 text-2xl mb-4 tracking-wider uppercase">{name}</h1>
        <div className="font-orbitron text-lg mb-5">
          STATUS: 
          <span className={`ml-2 font-bold transition-colors duration-300 ${isOn ? 'text-green-400' : 'text-red-500'}`}>
            {isOn ? 'ON' : 'OFF'}
          </span>
        </div>
        <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={() => onToggle(id, true)}
            disabled={!canTurnOn || isOn}
            className="font-orbitron text-white font-bold py-3 px-6 rounded-lg bg-green-500 shadow-[0_0_15px_rgba(0,255,127,0.4)] hover:bg-green-400 hover:shadow-[0_0_20px_rgba(0,255,127,0.6)] disabled:bg-gray-600/50 disabled:shadow-none disabled:cursor-not-allowed transition-all duration-300"
          >
            ON
          </button>
          <button
            onClick={() => onToggle(id, false)}
            disabled={!isOn}
            className="font-orbitron text-white font-bold py-3 px-6 rounded-lg bg-red-500 shadow-[0_0_15px_rgba(255,65,65,0.4)] hover:bg-red-400 hover:shadow-[0_0_20px_rgba(255,65,65,0.6)] disabled:bg-gray-600/50 disabled:shadow-none disabled:cursor-not-allowed transition-all duration-300"
          >
            OFF
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {isOverall ? (
          <>
            <div className="bg-gray-900/70 p-4 rounded-lg border border-gray-600/50">
              <h3 className="text-gray-400 text-xs font-light uppercase tracking-widest mb-2">{current1Label}</h3>
              <div className="font-orbitron text-3xl text-green-400 drop-shadow-[0_0_5px_#00ff7f]">
                {current1.toFixed(2)} A
              </div>
            </div>
            <div className="bg-gray-900/70 p-4 rounded-lg border border-gray-600/50">
              <h3 className="text-gray-400 text-xs font-light uppercase tracking-widest mb-2">{current2Label}</h3>
              <div className="font-orbitron text-3xl text-green-400 drop-shadow-[0_0_5px_#00ff7f]">
                {current2.toFixed(2)} A
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-gray-900/70 p-4 rounded-lg border border-gray-600/50">
              <h3 className="text-gray-400 text-xs font-light uppercase tracking-widest mb-2">Load Current</h3>
              <div className="font-orbitron text-2xl text-green-400 drop-shadow-[0_0_5px_#00ff7f]">
                {current1.toFixed(2)} A
              </div>
            </div>
            <div className="bg-gray-900/70 p-4 rounded-lg border border-gray-600/50">
              <h3 className="text-gray-400 text-xs font-light uppercase tracking-widest mb-2">Status</h3>
              <div className={`font-orbitron text-2xl truncate ${statusColor} drop-shadow-[0_0_5px_#00ff7f]`}>
                {statusText}
              </div>
            </div>
            <div className="bg-gray-900/70 p-4 rounded-lg border border-gray-600/50">
               <h3 className="text-gray-400 text-xs font-light uppercase tracking-widest mb-2">Min Current (A)</h3>
               <input
                type="number"
                value={editableMinCurrent}
                onChange={(e) => setEditableMinCurrent(e.target.value)}
                onBlur={handleMinCurrentBlur}
                onKeyDown={handleKeyDown}
                disabled={!isAdminMode}
                className="font-orbitron text-2xl text-green-400 bg-transparent w-full text-center outline-none p-0 border-0 drop-shadow-[0_0_5px_#00ff7f] disabled:text-gray-500 disabled:cursor-not-allowed"
                aria-label="Set minimum current"
                step="0.05"
                min="0"
              />
            </div>
            <div className="bg-gray-900/70 p-4 rounded-lg border border-gray-600/50">
              <h3 className="text-gray-400 text-xs font-light uppercase tracking-widest mb-2">Max Current (A)</h3>
              <input
                type="number"
                value={editableMaxCurrent}
                onChange={(e) => setEditableMaxCurrent(e.target.value)}
                onBlur={handleMaxCurrentBlur}
                onKeyDown={handleKeyDown}
                disabled={!isAdminMode}
                className="font-orbitron text-2xl text-green-400 bg-transparent w-full text-center outline-none p-0 border-0 drop-shadow-[0_0_5px_#00ff7f] disabled:text-gray-500 disabled:cursor-not-allowed"
                aria-label="Set maximum current"
                step="0.1"
                min="0"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BreakerPanel;
