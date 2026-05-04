import { useNavigate } from "react-router";
import { Users, ClipboardList } from "lucide-react";

const MODE_KEY = "gtc_mode";

export function PlayModePage() {
  const navigate = useNavigate();

  function choose(mode: "footballers" | "managers") {
    localStorage.setItem(MODE_KEY, mode);
    navigate(`/play/${mode}`);
  }

  return (
    <div className="h-dvh flex flex-col items-center justify-center bg-[#1a1a2e] px-4 gap-6 font-sans">
      <h1 className="text-white font-bold text-base tracking-[0.2em] uppercase mb-2">
        Guess the Career
      </h1>
      <p className="text-gray-400 text-sm">Choose a game mode</p>
      <div className="flex flex-col gap-4 w-full max-w-xs">
        <button
          onClick={() => choose("footballers")}
          className="flex flex-col items-center justify-center gap-2 bg-[#2a2a4e] hover:bg-[#3a3a5e] text-white rounded-xl py-8 transition-colors border border-white/10"
        >
          <Users size={32} className="text-white/80" />
          <span className="font-bold text-sm tracking-widest uppercase">
            Players
          </span>
          <span className="text-gray-400 text-xs">Guess the footballer</span>
        </button>
        <button
          onClick={() => choose("managers")}
          className="flex flex-col items-center justify-center gap-2 bg-[#2a2a4e] hover:bg-[#3a3a5e] text-white rounded-xl py-8 transition-colors border border-white/10"
        >
          <ClipboardList size={32} className="text-white/80" />
          <span className="font-bold text-sm tracking-widest uppercase">
            Managers
          </span>
          <span className="text-gray-400 text-xs">Guess the manager</span>
        </button>
      </div>
    </div>
  );
}
