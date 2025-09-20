import React, { useState } from 'react';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'nekunami' && password === 'nekunami') {
      setError('');
      onLoginSuccess();
    } else {
      setError('Invalid credentials. Please try again.');
    }
  };

  return (
    <div className="bg-[#121212] min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-[#282828] rounded-2xl p-8 border border-gray-600/50 shadow-[0_0_20px_rgba(0,255,127,0.1)]">
          <h1 className="font-orbitron text-3xl text-center text-[#00ff7f] drop-shadow-[0_0_10px_rgba(0,255,127,0.5)] tracking-widest mb-8">
            Login
          </h1>
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label 
                htmlFor="username" 
                className="block font-orbitron text-sm font-medium text-[#00ff7f]/80 tracking-wider mb-2"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                className="font-orbitron w-full text-white text-lg py-2 px-3 rounded-lg bg-gray-900/70 border border-[#00ff7f]/30 focus:ring-2 focus:ring-[#00ff7f] focus:border-[#00ff7f] outline-none transition-colors"
              />
            </div>
            <div>
              <label 
                htmlFor="password" 
                className="block font-orbitron text-sm font-medium text-[#00ff7f]/80 tracking-wider mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="font-orbitron w-full text-white text-lg py-2 px-3 rounded-lg bg-gray-900/70 border border-[#00ff7f]/30 focus:ring-2 focus:ring-[#00ff7f] focus:border-[#00ff7f] outline-none transition-colors"
              />
            </div>

            {error && (
              <p className="text-[#ff4141] text-sm text-center">{error}</p>
            )}

            <div>
              <button
                type="submit"
                className="font-orbitron w-full text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 bg-green-600 shadow-[0_0_10px_rgba(0,255,127,0.4)] hover:bg-green-500"
              >
                LOGIN
              </button>
            </div>
          </form>
        </div>
        <footer className="mt-8 text-center text-gray-500 text-xs">
          <p>Neku-Nami IoT Breaker Interface v1.5</p>
      </footer>
      </div>
    </div>
  );
};

export default LoginPage;