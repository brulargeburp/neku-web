import React, { useState, useEffect } from 'react';
import type { Breaker } from '../types';

interface BreakerPanelProps {
  breaker: Breaker;
  onToggle: (id: string, newState: boolean) => void;
  onSetMaxCurrent: (id: string, value: number) => void;
  onSetMinCurrent: (id: string, value: number) => void;
  onSetGracePeriod: (id: string, value: number) => void;
  isAdminMode: boolean;
}

const BreakerPanel: React.FC<BreakerPanelProps> = ({ breaker, onToggle, onSetMaxCurrent, onSetMinCurrent, onSetGracePeriod, isAdminMode }) => {
  const { id, name, isOn, current1Label, current2Label, current1, current2, isOverall, maxCurrent, minCurrent, gracePeriodMs, lastTripReason } = breaker;

  const [editableMaxCurrent, setEditableMaxCurrent] = useState<string>(maxCurrent?.toFixed(2) ?? '3.00');
  const [editableMinCurrent, setEditableMinCurrent] = useState<string>(minCurrent?.toFixed(2) ?? '0.00');
  const [editableGracePeriod, setEditableGracePeriod] = useState<string>(gracePeriodMs?.toString() ?? '500');

  useEffect(() => {
    setEditableMaxCurrent(maxCurrent?.toFixed(2) ?? '3.00');
  }, [maxCurrent]);

  useEffect(() => {
    setEditableMinCurrent(minCurrent?.toFixed(2) ?? '0.00');
  }, [minCurrent]);

  useEffect(() => {
    setEditableGracePeriod(gracePeriodMs?.toString() ?? '500');
  }, [gracePeriodMs]);

  const handleMaxCurrentBlur = () => {
    const value = parseFloat(editableMaxCurrent);
    if (!isNaN(value) && value >= 0 && value !== maxCurrent) {
      onSetMaxCurrent(id, value);
    } else {
      setEditableMaxCurrent(maxCurrent?.toFixed(2) ?? '3.00');
    }
  };
  
  const handleMinCurrentBlur = () => {
    const value = parseFloat(editableMinCurrent);
    if (!isNaN(value) && value >= 0 && value !== minCurrent) {
      onSetMinCurrent(id, value);
    } else {
      setEditableMinCurrent(minCurrent?.toFixed(2) ?? '0.00');
    }
  };

  const handleGracePeriodBlur = () => {
    const value = parseInt(editableGracePeriod, 10);
    if (!isNaN(value) && value >= 0 && value !== gracePeriodMs) {
      onSetGracePeriod(id, value);
    } else {
      setEditableGracePeriod(gracePeriodMs?.toString() ?? '500');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };
  
  const statusText = isOn ? "NORMAL" : (lastTripReason ?? 'OFF');
  const statusColor = isOn ? "text-[#00ff7f]" : (lastTripReason === 'Overload' || lastTripReason === 'Short Circuit' ? "text-[#f7ff00]" : "text-[#ff4141]");

  const panelStateClasses = isOverall
    ? 'border-gray-600/50 shadow-[0_0_20px_rgba(0,255,127,0.1)]' // Subtle green glow for overall
    : isOn
    ? 'border-[#00ff7f]/80 shadow-[0_0_25px_rgba(0,255,127,0.4)]'
    : (lastTripReason === 'Overload' || lastTripReason === 'Short Circuit'
      ? 'border-[#f7ff00]/80 shadow-[0_0_25px_rgba(247,255,0,0.4)]'
      : 'border-gray-700');

  const displayCurrent = (current: number) => {
    return (current < 0.1 ? 0 : current).toFixed(2);
  };

  const baseButtonClass = "font-orbitron text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 disabled:bg-black/25 disabled:text-gray-600 disabled:shadow-none disabled:cursor-not-allowed";

  return (
    <div className={`bg-[#282828] rounded-2xl p-6 md:p-8 border ${panelStateClasses} text-center flex flex-col ${isOverall ? 'justify-start gap-y-6' : 'justify-between min-h-[540px]'} transition-all duration-500`}>
      {/* --- Top Section --- */}
      <div>
        <h1 className={`font-orbitron text-[#00ff7f] text-2xl tracking-wider uppercase ${isOverall ? 'mb-0' : 'mb-4'}`}>{name}</h1>
        {!isOverall && (
          <>
            <div className="font-orbitron text-lg mb-5">
              STATUS: 
              <span className={`ml-2 font-bold transition-colors duration-300 ${isOn ? 'text-[#00ff7f]' : 'text-[#ff4141]'}`}>
                {isOn ? 'ON' : 'OFF'}
              </span>
            </div>
            <div className="flex justify-center gap-4 mb-8">
              <button
                onClick={() => onToggle(id, true)}
                disabled={isOverall || isOn}
                className={`${baseButtonClass} bg-[#1e1e1e] border border-gray-600/80 hover:bg-gray-700/60 hover:border-green-400/80`}
              >
                ON
              </button>
              <button
                onClick={() => onToggle(id, false)}
                disabled={!isOn}
                className={`${baseButtonClass} bg-[#1e1e1e] border border-gray-600/80 hover:bg-gray-700/60 hover:border-red-400/80`}
              >
                OFF
              </button>
            </div>
          </>
        )}
      </div>
      
      {/* --- Bottom Section (Readings) --- */}
      <div>
        {isOverall ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-900/70 p-4 rounded-lg border border-gray-600/50">
              <h3 className="text-gray-400 text-xs font-light uppercase tracking-widest mb-2">{current1Label}</h3>
              <div className="font-orbitron text-3xl text-[#00ff7f] drop-shadow-[0_0_5px_rgba(0,255,127,0.7)]">
                {displayCurrent(current1)} A
              </div>
            </div>
            <div className="bg-gray-900/70 p-4 rounded-lg border border-gray-600/50">
              <h3 className="text-gray-400 text-xs font-light uppercase tracking-widest mb-2">{current2Label}</h3>
              <div className="font-orbitron text-3xl text-[#00ff7f] drop-shadow-[0_0_5px_rgba(0,255,127,0.7)]">
                {displayCurrent(current2)} A
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-900/70 p-4 rounded-lg border border-gray-600/50">
                  <h3 className="text-gray-400 text-xs font-light uppercase tracking-widest mb-2">Load Current</h3>
                  <div className="font-orbitron text-2xl text-[#00ff7f] drop-shadow-[0_0_5px_rgba(0,255,127,0.7)]">
                    {displayCurrent(current1)} A
                  </div>
                </div>
                <div className="bg-gray-900/70 p-4 rounded-lg border border-gray-600/50">
                  <h3 className="text-gray-400 text-xs font-light uppercase tracking-widest mb-2">Status</h3>
                  <div className={`font-orbitron text-2xl truncate ${statusColor} drop-shadow-[0_0_5px_currentColor]`}>
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
                    className="font-orbitron text-2xl text-[#00ff7f] bg-transparent w-full text-center outline-none p-0 border-0 drop-shadow-[0_0_5px_rgba(0,255,127,0.7)] disabled:text-gray-500 disabled:cursor-not-allowed disabled:drop-shadow-none"
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
                    className="font-orbitron text-2xl text-[#00ff7f] bg-transparent w-full text-center outline-none p-0 border-0 drop-shadow-[0_0_5px_rgba(0,255,127,0.7)] disabled:text-gray-500 disabled:cursor-not-allowed disabled:drop-shadow-none"
                    aria-label="Set maximum current"
                    step="0.1"
                    min="0"
                  />
                </div>
            </div>
            <div className="bg-gray-900/70 p-4 rounded-lg border border-gray-600/50 mt-4">
              <h3 className="text-gray-400 text-xs font-light uppercase tracking-widest mb-2">Grace Period (ms)</h3>
              <input
                type="number"
                value={editableGracePeriod}
                onChange={(e) => setEditableGracePeriod(e.target.value)}
                onBlur={handleGracePeriodBlur}
                onKeyDown={handleKeyDown}
                disabled={!isAdminMode}
                className="font-orbitron text-2xl text-[#00ff7f] bg-transparent w-full text-center outline-none p-0 border-0 drop-shadow-[0_0_5px_rgba(0,255,127,0.7)] disabled:text-gray-500 disabled:cursor-not-allowed disabled:drop-shadow-none"
                aria-label="Set grace period in milliseconds"
                step="50"
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
