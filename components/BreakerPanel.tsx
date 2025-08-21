
import React from 'react';
import type { Breaker } from '../types';

interface BreakerPanelProps {
  breaker: Breaker;
  onToggle: (id: string, newState: boolean) => void;
  isMasterOn: boolean;
}

const BreakerPanel: React.FC<BreakerPanelProps> = ({ breaker, onToggle, isMasterOn }) => {
  const { id, name, isOn, voltage1Label, voltage2Label, voltage1, voltage2, isOverall } = breaker;

  const canTurnOn = isOverall || isMasterOn;

  return (
    <div className="bg-[#282828] rounded-2xl p-6 md:p-8 border border-green-400/30 shadow-2xl shadow-green-500/10 text-center flex flex-col justify-between min-h-[380px] transition-all duration-500">
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
        <div className="bg-gray-900/70 p-4 rounded-lg border border-gray-600/50">
          <h3 className="text-gray-400 text-xs font-light uppercase tracking-widest mb-2">{voltage1Label}</h3>
          <div className="font-orbitron text-3xl text-green-400 drop-shadow-[0_0_5px_#00ff7f]">
            {voltage1.toFixed(2)} V
          </div>
        </div>
        <div className="bg-gray-900/70 p-4 rounded-lg border border-gray-600/50">
          <h3 className="text-gray-400 text-xs font-light uppercase tracking-widest mb-2">{voltage2Label}</h3>
          <div className="font-orbitron text-3xl text-green-400 drop-shadow-[0_0_5px_#00ff7f]">
            {voltage2.toFixed(2)} V
          </div>
        </div>
      </div>
    </div>
  );
};

export default BreakerPanel;
