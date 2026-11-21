import { useNavigate } from "react-router";
import { ChevronLeft, ChevronRight, Mic } from "lucide-react";

export function SettingsScreen() {
  const navigate = useNavigate();
  return (
    <div className="relative min-h-screen pb-[72px]" style={{ backgroundColor: "#F5EFE6" }}>
      <div className="relative z-10 px-5 pt-4 max-w-[430px] mx-auto">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} aria-label="Back" className="cursor-pointer flex items-center justify-center" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#FDFAF5", border: "1px solid #E8E0D4" }}>
            <ChevronLeft size={20} color="#1A1208" />
          </button>
          <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 22, fontWeight: 700, color: "#1A1208" }}>Settings</h1>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={() => navigate("/settings/memory")}
            className="cursor-pointer w-full flex items-center text-left"
            style={{ minHeight: 72, backgroundColor: "#FDFAF5", borderRadius: 20, border: "1px solid #E8E0D4", padding: "14px 18px" }}
          >
            <span className="flex-1">
              <span className="block" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "#1A1208" }}>Memory</span>
              <span className="block" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.55)" }}>Things Rizzbot can remember across your chats</span>
            </span>
            <ChevronRight size={18} color="rgba(26,18,8,0.35)" />
          </button>
          <button
            onClick={() => navigate("/voice")}
            className="cursor-pointer w-full flex items-center text-left"
            style={{ minHeight: 72, backgroundColor: "#FDFAF5", borderRadius: 20, border: "1px solid #E8E0D4", padding: "14px 18px" }}
          >
            <span className="flex items-center gap-3 flex-1">
              <Mic size={19} color="#C8522A" />
              <span>
                <span className="block" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "#1A1208" }}>My Voice</span>
                <span className="block" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.55)" }}>Train your texting style</span>
              </span>
            </span>
            <ChevronRight size={18} color="rgba(26,18,8,0.35)" />
          </button>
        </div>
      </div>
    </div>
  );
}
