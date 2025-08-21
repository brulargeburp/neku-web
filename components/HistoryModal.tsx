
import React from 'react';
import type { HistoryLog } from '../types';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: HistoryLog[];
  onClearHistory: () => void;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, logs, onClearHistory }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-modal-title"
    >
      <div
        className="bg-[#282828] w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl border border-green-400/30 shadow-2xl shadow-green-500/20 text-gray-100"
        onClick={(e) => e.stopPropagation()} // Prevent closing modal when clicking inside
      >
        <header className="flex items-center justify-between p-4 border-b border-gray-600/50">
          <h2 id="history-modal-title" className="font-orbitron text-green-400 text-xl tracking-wider uppercase">
            Neku-Nami Activation History
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close history modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>
        
        <div className="p-6 overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No activation history recorded yet.</p>
          ) : (
            <ul className="space-y-4">
              {logs.map((log, index) => (
                <li key={index} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-900/70 p-4 rounded-lg border border-gray-600/50">
                  <div>
                    <span className={`font-bold ${log.type === 'activated' ? 'text-green-400' : 'text-red-400'}`}>{log.breakerName}</span>
                    <span className="text-gray-300"> was {log.type}.</span>
                  </div>
                  <div className="text-sm text-gray-400 mt-2 sm:mt-0 sm:ml-4 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="p-4 border-t border-gray-600/50 flex justify-end">
          <button
            onClick={onClearHistory}
            disabled={logs.length === 0}
            className="font-orbitron text-white text-sm font-bold py-2 px-4 rounded-lg bg-red-600 shadow-[0_0_10px_rgba(255,65,65,0.3)] hover:bg-red-500 hover:shadow-[0_0_15px_rgba(255,65,65,0.5)] disabled:bg-gray-600/50 disabled:shadow-none disabled:cursor-not-allowed transition-all duration-300"
            aria-label="Clear all history logs"
          >
            Clear History
          </button>
        </footer>
      </div>
    </div>
  );
};

export default HistoryModal;
