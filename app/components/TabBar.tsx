import { Home, Zap, Target, Heart, Clock } from "lucide-react";
import { useNavigate, useLocation } from "react-router";

const tabs = [
  { label: "Home", icon: Home, path: "/home" },
  { label: "Quick", icon: Zap, path: "/quick" },
  { label: "Practice", icon: Target, path: "/practice" },
  { label: "Therapist", icon: Heart, path: "/therapist" },
  { label: "History", icon: Clock, path: "/history" },
];

export function TabBar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        height: 60,
        backgroundColor: "#FDFAF5",
        borderTop: "1px solid #E8E0D4",
      }}
    >
      <div className="flex items-center justify-around h-full px-1 pb-0 max-w-[430px] mx-auto">
        {tabs.map((tab) => {
          const isActive = location.pathname.startsWith(tab.path);
          const Icon = tab.icon;
          return (
            <button
              key={tab.label}
              onClick={() => navigate(tab.path)}
              className="flex items-center justify-center cursor-pointer"
              style={{
                flex: 1,
                height: 56,
                paddingTop: 4,
                background: "none",
                border: "none",
              }}
            >
              <div
                className="flex flex-col items-center justify-center transition-all"
                style={{
                  padding: "4px 14px",
                  borderRadius: 999,
                  backgroundColor: isActive ? "rgba(200, 82, 42, 0.10)" : "transparent",
                  gap: 2,
                  minWidth: tab.label === "Therapist" ? 84 : 62,
                }}
              >
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.2 : 1.8}
                  style={{
                    color: isActive ? "#C8522A" : "rgba(26, 18, 8, 0.35)",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? "#C8522A" : "rgba(26, 18, 8, 0.45)",
                    fontFamily: "'DM Sans', sans-serif",
                    lineHeight: 1,
                    letterSpacing: "-0.02em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {tab.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
