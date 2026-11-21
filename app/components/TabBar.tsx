import { Clock, MessageSquare, Settings, Zap } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { haptics } from "../utils/haptics";

const tabs = [
  { label: "Chat", icon: MessageSquare, path: "/chat" },
  { label: "Quick", icon: Zap, path: "/quick" },
  { label: "History", icon: Clock, path: "/history" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

export function TabBar({ embedded = false }: { embedded?: boolean } = {}) {
  const navigate = useNavigate();
  const location = useLocation();

  // When rendered globally, Chat embeds TabBar directly below its composer so it flows cleanly with keyboard/sidebar.
  if (!embedded && location.pathname.startsWith("/chat")) {
    return null;
  }

  return (
    <nav
      aria-label="Primary"
      className={embedded ? "w-full shrink-0" : "fixed bottom-0 left-0 right-0 z-50"}
      style={{
        height: embedded ? 58 : "calc(62px + env(safe-area-inset-bottom))",
        paddingBottom: embedded ? 0 : "env(safe-area-inset-bottom)",
        backgroundColor: "#FDFAF5",
        borderTop: "1px solid #E8E0D4",
      }}
    >
      <div className="flex items-center justify-around h-full px-2 max-w-[460px] mx-auto">
        {tabs.map((tab) => {
          const isActive =
            tab.path === "/chat"
              ? location.pathname.startsWith("/chat")
              : tab.path === "/settings"
                ? location.pathname.startsWith("/settings") || location.pathname === "/voice"
                : location.pathname === tab.path;
          const Icon = tab.icon;
          return (
            <button
              key={tab.label}
              type="button"
              onClick={() => {
                haptics.light();
                navigate(tab.path);
              }}
              aria-current={isActive ? "page" : undefined}
              className="flex items-center justify-center cursor-pointer transition-transform active:scale-95"
              style={{ flex: 1, height: 52, background: "none", border: "none" }}
            >
              <span
                className="flex flex-col items-center justify-center transition-colors"
                style={{
                  padding: "5px 15px",
                  borderRadius: 999,
                  backgroundColor: isActive ? "rgba(200, 82, 42, 0.12)" : "transparent",
                  gap: 2,
                  minWidth: 64,
                }}
              >
                <Icon
                  size={19}
                  strokeWidth={isActive ? 2.2 : 1.75}
                  style={{ color: isActive ? "#C8522A" : "rgba(26, 18, 8, 0.42)", flexShrink: 0 }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: isActive ? 650 : 500,
                    color: isActive ? "#C8522A" : "rgba(26,18,8,0.5)",
                    fontFamily: "'DM Sans', sans-serif",
                    lineHeight: 1,
                    letterSpacing: "-0.02em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {tab.label}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
