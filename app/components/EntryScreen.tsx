import React, { useState } from 'react';

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

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50 overflow-hidden font-sans">
      {/* Background with Grid and Blur */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-0"></div>
      <div className="absolute inset-0 grid-bg opacity-30 z-0 animate-pulse-slow"></div>

      {/* Animated Background Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-[100px] animate-float"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-[100px] animate-float" style={{ animationDelay: '2s' }}></div>

      {/* Main Glass Panel */}
      <div className="relative z-10 w-full max-w-md p-8 glass-panel rounded-2xl border-white/10 animate-pop-in flex flex-col items-center">

        {/* Header / Logo */}
        <div className="mb-10 text-center relative group">
          <h1 className="text-6xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 via-teal-300 to-cyan-400 drop-shadow-[0_0_25px_rgba(52,211,153,0.4)]">
            SLITHER
          </h1>
          <div className="h-1 w-full bg-gradient-to-r from-transparent via-emerald-500 to-transparent mt-2 opacity-50"></div>

          {isDead ? (
            <div className="mt-4 px-4 py-1 bg-rose-500/20 border border-rose-500/50 rounded-full inline-block">
              <span className="text-rose-500 font-bold tracking-widest text-sm uppercase drop-shadow-md animate-pulse">Eliminated</span>
            </div>
          ) : (
            <p className="mt-3 text-slate-400 text-xs font-bold tracking-[0.3em] uppercase opacity-70">
              Dominate the Pit
            </p>
          )}
        </div>

        {/* Form Container */}
        <div className="w-full space-y-8">

          {/* Input Section */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Operative Name
            </label>
            <div className={`relative group transition-all duration-300 ${isFocused ? 'scale-[1.02]' : ''}`}>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onKeyPress={(e) => e.key === 'Enter' && onJoin()}
                placeholder="ENTER ALIAS"
                maxLength={15}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 text-center font-bold text-lg text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/50 focus:bg-black/60 transition-all uppercase tracking-wider"
              />
              {/* Focus Glow Border */}
              <div className={`absolute inset-0 -z-10 rounded-xl bg-gradient-to-r from-emerald-500/0 via-emerald-500/30 to-cyan-500/0 transition-opacity duration-500 ${isFocused ? 'opacity-100 blur-md' : 'opacity-0'}`}></div>
            </div>
          </div>

          {/* Skin Selection Grid */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 flex justify-between">
              <span>Select Skin</span>
              <span className="text-emerald-400">{skins.find(s => s.id === selectedSkin)?.name}</span>
            </label>
            <div className="grid grid-cols-5 gap-3 p-3 bg-black/20 rounded-xl border border-white/5">
              {skins.map((skin) => (
                <button
                  key={skin.id}
                  onClick={() => setSelectedSkin(skin.id)}
                  className={`group relative aspect-square rounded-lg transition-all duration-300 overflow-hidden ${selectedSkin === skin.id
                      ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-black scale-105 shadow-[0_0_20px_rgba(52,211,153,0.3)]'
                      : 'hover:scale-110 opacity-70 hover:opacity-100'
                    }`}
                >
                  <div className="absolute inset-0" style={{ backgroundColor: skin.color }}></div>

                  {/* Glass Sheen */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent"></div>

                  {/* Selected Indicator */}
                  {selectedSkin === skin.id && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-white rounded-full shadow-lg"></div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={onJoin}
            disabled={isConnecting || !playerName.trim()}
            className={`
              relative w-full py-5 rounded-xl font-black text-xl tracking-widest uppercase overflow-hidden transition-all duration-300
              ${!playerName.trim() || isConnecting
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
                : isDead
                  ? 'bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white shadow-[0_0_30px_rgba(244,63,94,0.4)] hover:shadow-[0_0_50px_rgba(244,63,94,0.6)] border border-rose-400/20'
                  : 'bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-[0_0_30px_rgba(16,185,129,0.4)] hover:shadow-[0_0_50px_rgba(16,185,129,0.6)] border border-emerald-400/20'
              }
            `}
          >
            <div className="relative z-10 flex items-center justify-center gap-3">
              {isConnecting ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-current opacity-50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Linking...</span>
                </>
              ) : (
                <>
                  <span>{isDead ? 'Respawn' : 'Engage'}</span>
                  <svg className={`w-5 h-5 transition-transform duration-300 ${(!playerName.trim()) ? '' : 'group-hover:translate-x-1'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </div>

            {/* Scanline Effect on Button */}
            {!isConnecting && playerName.trim() && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-20deg] translate-x-[-150%] animate-[shine_2s_infinite]"></div>
            )}
          </button>

          {/* Footer Status */}
          <div className="flex items-center justify-center gap-2 pt-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-rose-500 shadow-[0_0_10px_#f43f5e]'}`}></div>
            <span className={`text-[10px] font-bold tracking-wider ${isConnected ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>
              {isConnected ? 'SYSTEM ONLINE' : 'OFFLINE'}
            </span>
          </div>

        </div>
      </div>

      {/* Version Tag */}
      <div className="absolute bottom-4 right-4 text-white/10 text-[10px] uppercase font-bold tracking-widest pointer-events-none">
        v2.0 // Stable
      </div>
    </div>
  );
}
