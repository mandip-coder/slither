import React, { useState, useEffect } from 'react';

interface Skin {
  id: string;
  name: string;
  color: string;
}

interface EntryScreenProps {
  playerName: string;
  setPlayerName: (name: string) => void;
  selectedSkin: string;
  setSelectedSkin: (id: string) => void;
  onJoin: () => void;
  isConnecting: boolean;
  isConnected: boolean;
  isDead: boolean;
  skins: Skin[];
}

export default function EntryScreen({
  playerName,
  setPlayerName,
  selectedSkin,
  setSelectedSkin,
  onJoin,
  isConnecting,
  isConnected,
  isDead,
  skins
}: EntryScreenProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50 overflow-hidden font-sans">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md z-0 transition-opacity duration-1000"></div>

      {/* Animated Gradient Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-40">
        <div className="absolute top-[20%] left-[20%] w-[500px] h-[500px] bg-purple-600/30 rounded-full blur-[120px] animate-blob"></div>
        <div className="absolute bottom-[20%] right-[20%] w-[500px] h-[500px] bg-emerald-600/30 rounded-full blur-[120px] animate-blob animation-delay-2000"></div>
        <div className="absolute top-[40%] right-[40%] w-[400px] h-[400px] bg-cyan-600/30 rounded-full blur-[120px] animate-blob animation-delay-4000"></div>
      </div>

      {/* Main Content Card */}
      <div className={`
        relative z-10 w-full max-w-[480px] p-8 mx-4
        bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl
        flex flex-col items-center gap-8
        transform transition-all duration-700 ease-out
        ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}
      `}>

        {/* Logo / Header */}
        <div className="text-center space-y-2 relative">
          <h1 className="text-7xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-slate-400 drop-shadow-2xl">
            SLITHER
          </h1>
          <div className="flex items-center justify-center gap-3">
            <div className="h-[2px] w-12 bg-gradient-to-r from-transparent to-emerald-500/50"></div>
            <p className="text-emerald-400 text-xs font-bold tracking-[0.4em] uppercase glow-text">
              {isDead ? 'Simulation Fail' : 'Neural Link Ready'}
            </p>
            <div className="h-[2px] w-12 bg-gradient-to-l from-transparent to-emerald-500/50"></div>
          </div>
        </div>

        {/* Input Field */}
        <div className="w-full relative group">
          <div className={`absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl blur opacity-20 group-hover:opacity-60 transition duration-500 ${isFocused ? 'opacity-100 duration-200' : ''}`}></div>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={(e) => e.key === 'Enter' && playerName.trim() && !isConnecting && onJoin()}
            placeholder="ENTER OPERATIVE ID"
            maxLength={12}
            className="relative w-full bg-slate-900/90 border border-white/10 text-white placeholder-white/20 text-center text-xl font-bold py-5 rounded-xl focus:outline-none focus:bg-slate-900/95 transition-all uppercase tracking-widest shadow-inner"
            spellCheck={false}
          />
        </div>

        {/* Skin Selector */}
        <div className="w-full space-y-3">
          <div className="flex justify-between items-center px-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Skin</span>
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">{skins.find(s => s.id === selectedSkin)?.name}</span>
          </div>

          <div className="grid grid-cols-5 gap-3">
            {skins.map((skin) => (
              <button
                key={skin.id}
                onClick={() => setSelectedSkin(skin.id)}
                className={`
                    relative group aspect-square rounded-xl overflow-hidden transition-all duration-300
                    ${selectedSkin === skin.id
                    ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-900 scale-110 shadow-lg shadow-emerald-500/20 z-10'
                    : 'hover:scale-105 opacity-60 hover:opacity-100 hover:ring-1 hover:ring-white/20'
                  }
                 `}
              >
                <div className="absolute inset-0" style={{ backgroundColor: skin.color }}></div>
                {/* Gloss Effect */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/30 to-transparent"></div>
                {/* Selected Indicator */}
                {selectedSkin === skin.id && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)]"></div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Play Button */}
        <button
          onClick={onJoin}
          disabled={isConnecting || !playerName.trim()}
          className={`
            relative w-full group overflow-hidden rounded-xl p-[2px] transition-all duration-300
            ${!playerName.trim() || isConnecting ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]'}
          `}
        >
          <div className={`
            absolute inset-0 bg-gradient-to-r
            ${isDead
              ? 'from-rose-500 via-orange-500 to-red-500'
              : 'from-emerald-500 via-teal-500 to-cyan-500'
            }
            animate-gradient-x
          `}></div>

          <div className="relative bg-slate-900 h-full rounded-[10px] px-8 py-4 flex items-center justify-center gap-3 group-hover:bg-opacity-90 transition-all">
            {isConnecting ? (
              <span className="text-white font-black tracking-widest uppercase animate-pulse">Establishing Link...</span>
            ) : (
              <>
                <span className={`font-black text-xl tracking-[0.2em] uppercase bg-clip-text text-transparent bg-gradient-to-r ${isDead ? 'from-rose-400 to-orange-400' : 'from-emerald-400 to-cyan-400'}`}>
                  {isDead ? 'Re-Deploy' : 'Engage'}
                </span>
                <svg className={`w-5 h-5 ${isDead ? 'text-rose-400' : 'text-emerald-400'} transform group-hover:translate-x-1 transition-transform`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}
          </div>
        </button>

        {/* Connection Status Footer */}
        <div className="flex items-center gap-2 px-4 py-2 bg-black/20 rounded-full border border-white/5">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
          <span className={`text-[10px] font-bold tracking-wider ${isConnected ? 'text-emerald-500/80' : 'text-rose-500/80'}`}>
            {isConnected ? `SERVER ONLINE // ${Math.floor(Math.random() * 20 + 30)}ms` : 'CONNECTION LOST'}
          </span>
        </div>

      </div>

      {/* Version info */}
      <div className="absolute bottom-6 right-6 text-white/10 text-[10px] font-mono tracking-widest">
        BUILD v2.1.0 // STABLE
      </div>
    </div>
  );
}

