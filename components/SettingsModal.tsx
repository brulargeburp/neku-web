import React from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowHistory: () => void;
  onShowAbout: () => void;
  onChangeSfx: () => void;
  onPreviewSfx: () => void;
  audioSrc: string;
  isPreviewing: boolean;
  load1Offset: number;
  onSetLoad1Offset: (value: number) => void;
  notificationPermission: NotificationPermission;
  onEnableNotifications: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  onShowHistory, 
  onShowAbout,
  onChangeSfx, 
  onPreviewSfx, 
  audioSrc, 
  isPreviewing,
  load1Offset,
  onSetLoad1Offset,
  notificationPermission,
  onEnableNotifications
}) => {
  if (!isOpen) {
    return null;
  }

  const getAudioFileName = (src: string) => {
    if (src.startsWith('data:audio')) {
      return 'Custom Sound';
    }
    try {
      const url = new URL(src, window.location.href);
      return url.pathname.split('/').pop() || 'beep.wav';
    } catch {
      return 'beep.wav';
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div
        className="bg-[#282828] w-full max-w-md max-h-[90vh] rounded-2xl border border-[#00ff7f]/30 shadow-2xl shadow-[#00ff7f]/20 text-gray-100 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-gray-600/50">
          <h2 id="settings-modal-title" className="font-orbitron text-[#00ff7f] text-xl tracking-wider uppercase">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close settings modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>
        
        <div className="p-6 space-y-8 overflow-y-auto">
          
          {/* General Section */}
          <div>
            <h3 className="font-orbitron text-[#00ff7f]/80 text-sm tracking-widest uppercase mb-3">General</h3>
            <div className="space-y-3">
              <button
                onClick={onShowHistory}
                className="font-orbitron w-full text-white text-md font-bold py-3 px-4 rounded-lg bg-gray-700/50 border border-[#00ff7f]/30 hover:bg-gray-600/70 transition-colors"
              >
                View History
              </button>
              <button
                onClick={onShowAbout}
                className="font-orbitron w-full text-white text-md font-bold py-3 px-4 rounded-lg bg-gray-700/50 border border-[#00ff7f]/30 hover:bg-gray-600/70 transition-colors"
              >
                About
              </button>
            </div>
          </div>

          {/* Notifications Section */}
          <div>
            <h3 className="font-orbitron text-[#00ff7f]/80 text-sm tracking-widest uppercase mb-3">Notifications</h3>
            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-600/50">
              <div className="flex items-center justify-between">
                <p className="text-gray-300">Trip Alerts:</p>
                {notificationPermission === 'granted' && (
                  <p className="font-orbitron text-[#00ff7f]">Enabled</p>
                )}
                {notificationPermission === 'denied' && (
                  <p className="font-orbitron text-[#ff4141]">Denied</p>
                )}
                {notificationPermission === 'default' && (
                  <button
                    onClick={onEnableNotifications}
                    className="font-orbitron text-white text-sm py-2 px-4 rounded-lg bg-gray-700/50 border border-[#00ff7f]/30 hover:bg-gray-600/70 transition-colors"
                  >
                    Enable
                  </button>
                )}
              </div>
              {notificationPermission === 'denied' && (
                <p className="text-xs text-gray-500 mt-2">
                  You have blocked notifications. Please enable them in your browser's site settings.
                </p>
              )}
            </div>
          </div>

          {/* Audio Section */}
          <div>
            <h3 className="font-orbitron text-[#00ff7f]/80 text-sm tracking-widest uppercase mb-3">Audio</h3>
            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-600/50">
              <div className="flex items-center justify-between mb-3">
                <p className="text-gray-300">Alert Sound:</p>
                <p className="font-orbitron text-[#00ff7f] truncate" title={getAudioFileName(audioSrc)}>
                  {getAudioFileName(audioSrc)}
                </p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={onChangeSfx}
                  className="font-orbitron flex-grow text-white text-md font-bold py-3 px-4 rounded-lg bg-gray-700/50 border border-[#00ff7f]/30 hover:bg-gray-600/70 transition-colors"
                >
                  Change
                </button>
                <button
                  onClick={onPreviewSfx}
                  className="font-orbitron flex-grow text-black text-md font-bold py-3 px-4 rounded-lg bg-[#00ff7f]/90 border border-[#00ff7f]/30 hover:bg-[#00ff7f] transition-colors flex items-center justify-center"
                  aria-label={isPreviewing ? "Pause alert sound preview" : "Play alert sound preview"}
                >
                  {isPreviewing ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
                      </svg>
                      Pause
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                      </svg>
                      Play
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Calibration Section */}
          <div>
            <h3 className="font-orbitron text-[#00ff7f]/80 text-sm tracking-widest uppercase mb-3">Calibration</h3>
            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-600/50">
              <label htmlFor="load1-offset" className="block text-gray-300 mb-2">Load 1 Current Offset (A)</label>
              <input
                id="load1-offset"
                type="number"
                step="0.01"
                value={load1Offset}
                onChange={(e) => onSetLoad1Offset(parseFloat(e.target.value) || 0)}
                className="font-orbitron w-full text-white text-lg py-2 px-3 rounded-lg bg-gray-700/50 border border-[#00ff7f]/30 focus:ring-2 focus:ring-[#00ff7f] focus:border-[#00ff7f] outline-none transition-colors"
                placeholder="e.g., -0.05"
              />
              <p className="text-xs text-gray-500 mt-2">Adjust sensor reading. Use negative values to decrease.</p>
            </div>
          </div>
        </div>

        <footer className="p-4 border-t border-gray-600/50 mt-auto">
          <h3 className="font-orbitron text-center text-[#00ff7f]/80 text-sm tracking-widest uppercase mb-3">
            Customer Support
          </h3>
          <div className="flex justify-center items-center space-x-6">
            <a
              href="https://facebook.com/profile.php?id=61577361526989"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 text-gray-300 hover:text-[#00ff7f] transition-colors group"
              aria-label="Visit our Facebook page (opens in a new tab)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 group-hover:text-[#00ff7f] transition-colors" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v2.385z"/>
              </svg>
              <span>Facebook</span>
            </a>
            <a
              href="mailto:nekunami.business@gmail.com"
              className="flex items-center space-x-2 text-gray-300 hover:text-[#00ff7f] transition-colors group"
              aria-label="Send us an email"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 group-hover:text-[#00ff7f] transition-colors" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
              <span>Email</span>
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default SettingsModal;