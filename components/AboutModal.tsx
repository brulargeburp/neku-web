import React from 'react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-modal-title"
    >
      <div
        className="bg-[#1e1e1e] w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-[#00ff7f]/30 shadow-2xl shadow-[#00ff7f]/20 text-gray-300"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-gray-600/50">
          <h2 id="about-modal-title" className="font-orbitron text-[#00ff7f] text-xl tracking-wider uppercase">
            About Neku-Nami
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close about modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>
        
        <div className="p-6 overflow-y-auto space-y-6 text-base leading-relaxed">
          <div>
            <h3 className="font-orbitron text-[#00ff7f]/90 text-lg tracking-wider uppercase mb-2">Project Description</h3>
            <p>
              Neku-Nami is an IoT-enabled, Arduino-based circuit breaker designed for real-time monitoring and control via a web interface. This project explores the potential of smart technology to enhance electrical safety in households.
            </p>
          </div>
          <div>
            <h3 className="font-orbitron text-[#00ff7f]/90 text-lg tracking-wider uppercase mb-2">Background</h3>
            <p>
              This application is the user interface for the "NEKU-NAMI" research project, developed by senior high school students from the Science, Technology, Engineering, and Mathematics (STEM) program at Las Piñas City National Senior High School - Talon Dos Campus. The study aimed to create a modern, safer, and more transparent alternative to traditional circuit breakers to help mitigate risks associated with electrical faults.
            </p>
          </div>
          <div>
            <h3 className="font-orbitron text-[#00ff7f]/90 text-lg tracking-wider uppercase mb-2">Core Technology</h3>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li><span className="font-bold">Controller:</span> Arduino UNO</li>
              <li><span className="font-bold">Sensor:</span> ACS712 20A Current Sensor for real-time load monitoring.</li>
              <li><span className="font-bold">Actuator:</span> MGR-1 DD220D40 Solid-State Relay for interrupting the circuit.</li>
              <li><span className="font-bold">Interface:</span> This web application, communicating with the hardware via the Web Serial API.</li>
            </ul>
          </div>
          <div className="bg-yellow-900/40 border border-yellow-500/50 text-yellow-300 p-4 rounded-lg">
            <h3 className="font-orbitron text-yellow-300 text-lg tracking-wider uppercase mb-2">Disclaimer</h3>
            <p className="text-yellow-200">
              The Neku-Nami system is a functional prototype developed for educational and research purposes. As outlined in the study, it has not undergone the rigorous testing and certification (e.g., Philippine Electrical Code compliance) required for use in live residential or commercial electrical systems. <strong>Do not connect this device to mains electricity.</strong>
            </p>
          </div>
        </div>

        <footer className="p-4 border-t border-gray-600/50 flex justify-end">
          <button
            onClick={onClose}
            className="font-orbitron text-black font-bold py-2 px-6 rounded-lg bg-[#00ff7f]/90 hover:bg-[#00ff7f] transition-colors"
            aria-label="Close"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
};

export default AboutModal;
