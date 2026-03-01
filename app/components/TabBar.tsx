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
        height: 80,
        backgroundColor: "#FDFAF5",
        borderTop: "1px solid #E8E0D4",
      }}
    >
      <div className="flex items-center justify-around h-full px-2 pb-4 max-w-[430px] mx-auto">
        {tabs.map((tab) => {
          const isActive = location.pathname.startsWith(tab.path);
          const Icon = tab.icon;
          return (
            <button
              key={tab.label}
              onClick={() => navigate(tab.path)}
              className="flex flex-col items-center gap-1 flex-1 cursor-pointer"
            >
              <Icon
                size={22}
                strokeWidth={1.8}
                style={{
                  color: isActive ? "#C8522A" : "rgba(26, 18, 8, 0.35)",
                }}
              />
              <span
                className="font-[\'DM_Sans\']"
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: isActive ? "#C8522A" : "rgba(26, 18, 8, 0.35)",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
