import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Music } from 'lucide-react';

export default function MusicPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.3);
  const [showControls, setShowControls] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create audio element
    audioRef.current = new Audio('/terminator-tension.mp3');
    audioRef.current.loop = true;
    audioRef.current.volume = volume;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(() => {
          // Auto-play blocked, show controls
          setShowControls(true);
        });
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  return (
    <div 
      className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${
        showControls ? 'w-64' : 'w-auto'
      }`}
    >
      {/* Compact view */}
      {!showControls && (
        <button
          onClick={() => setShowControls(true)}
          className="flex items-center gap-2 px-4 py-3 bg-black/80 backdrop-blur-md border border-[#D4AF37]/50 rounded-full text-[#D4AF37] hover:bg-[#D4AF37]/20 transition-all hover:scale-105 group"
        >
          <Music className="w-5 h-5 group-hover:animate-pulse" />
          <span className="text-sm font-medium">Música</span>
          {!isPlaying && <span className="text-xs text-gray-400">(click para activar)</span>}
        </button>
      )}

      {/* Full controls */}
      {showControls && (
        <div className="bg-black/90 backdrop-blur-md border border-[#D4AF37]/50 rounded-2xl p-4 shadow-2xl shadow-[#D4AF37]/20">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#00D4FF] flex items-center justify-center">
                <Music className="w-4 h-4 text-black" />
              </div>
              <div>
                <p className="text-white text-sm font-medium">Ambiente</p>
                <p className="text-gray-400 text-xs">Tensión Institucional</p>
              </div>
            </div>
            <button
              onClick={() => setShowControls(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <span className="text-lg">×</span>
            </button>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                isPlaying 
                  ? 'bg-[#D4AF37] text-black hover:bg-[#D4AF37]/80' 
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" />
              )}
            </button>

            {/* Mute */}
            <button
              onClick={toggleMute}
              className="w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-all"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>

            {/* Volume slider */}
            <div className="flex-1">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #D4AF37 0%, #D4AF37 ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.2) ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.2) 100%)`
                }}
              />
            </div>
          </div>

          {/* Visualizer effect */}
          {isPlaying && (
            <div className="flex items-center justify-center gap-1 mt-4 h-6">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-gradient-to-t from-[#D4AF37] to-[#00D4FF] rounded-full animate-music-bar"
                  style={{
                    height: `${Math.random() * 20 + 5}px`,
                    animationDelay: `${i * 0.1}s`,
                    animationDuration: `${0.5 + Math.random() * 0.5}s`
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
