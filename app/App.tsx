import { RouterProvider } from "react-router";
import { router } from "./routes";
import { ToastProvider } from "./components/ui/Toast";
import { AppProvider, useAppContext } from "./app-context";

function WellbeingModal() {
  const { wellbeingCheckIn, dismissWellbeing, dismissWellbeingForDay } = useAppContext();

  if (!wellbeingCheckIn?.triggered || !wellbeingCheckIn.reason) return null;

  const content = {
    late_night: {
      title: "Late-night check-in",
      message:
        "It is late and things can feel more intense at night. Pause for a minute, then decide your next move with a clear head.",
    },
    same_person: {
      title: "Energy balance check",
      message:
        "You have spent a lot of energy on one person. Make sure they are matching your effort before you keep investing.",
    },
    high_frequency: {
      title: "Take a quick breather",
      message:
        "You have run many sessions recently. A short break can help you return with better judgment.",
    },
    high_risk: {
      title: "Pattern risk detected",
      message:
        "Recent conversations look high-risk. Protect your peace first and only respond when it serves you.",
    },
  }[wellbeingCheckIn.reason];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center px-5"
      style={{ backgroundColor: "rgba(26,18,8,0.45)" }}
    >
      <div
        className="w-full max-w-[390px]"
        style={{
          backgroundColor: "#FDFAF5",
          borderRadius: 24,
          padding: 24,
          boxShadow: "0 20px 60px rgba(26,18,8,0.2)",
        }}
      >
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "rgba(26,18,8,0.45)",
          }}
        >
          Wellbeing
        </p>
        <p
          style={{
            marginTop: 8,
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 30,
            fontStyle: "italic",
            color: "#1A1208",
            lineHeight: 1.15,
          }}
        >
          {content.title}
        </p>
        <p
          style={{
            marginTop: 12,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 14,
            color: "rgba(26,18,8,0.6)",
            lineHeight: 1.6,
          }}
        >
          {content.message}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={dismissWellbeing}
            style={{
              height: 48,
              borderRadius: 999,
              border: "none",
              backgroundColor: "#C8522A",
              color: "#FFFFFF",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            I am good, continue
          </button>
          <button
            onClick={dismissWellbeingForDay}
            style={{
              height: 48,
              borderRadius: 999,
              border: "1px solid #E8E0D4",
              backgroundColor: "transparent",
              color: "rgba(26,18,8,0.65)",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Skip reminders today
          </button>
        </div>
      </div>
    </div>
  );
}

function AppRouter() {
  const { authLoading } = useAppContext();

  if (authLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#F5EFE6" }}
      >
        <div className="text-center">
          <div
            className="animate-spin"
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: "2px solid #E8E0D4",
              borderTopColor: "#C8522A",
              margin: "0 auto",
            }}
          />
          <p
            style={{
              marginTop: 10,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12,
              color: "rgba(26,18,8,0.55)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Loading
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <RouterProvider router={router} />
      <WellbeingModal />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <AppRouter />
      </ToastProvider>
    </AppProvider>
  );
}
