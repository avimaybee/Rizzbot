import React, { Suspense, lazy } from "react";
import { createBrowserRouter, Navigate, Outlet, useLocation } from "react-router";
import { SplashScreen } from "./components/SplashScreen";
import { AuthScreen } from "./components/AuthScreen";
import { HomeScreen } from "./components/HomeScreen";
import { NotFoundScreen } from "./components/NotFoundScreen";
import { TabBar } from "./components/TabBar";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useAppContext } from "./app-context";

const QuickModeScreen = lazy(() =>
  import("./components/QuickModeScreen").then((m) => ({ default: m.QuickModeScreen }))
);
const PracticeScreen = lazy(() =>
  import("./components/PracticeScreen").then((m) => ({ default: m.PracticeScreen }))
);
const TherapistScreen = lazy(() =>
  import("./components/TherapistScreen").then((m) => ({ default: m.TherapistScreen }))
);
const TherapistClosingScreen = lazy(() =>
  import("./components/TherapistClosingScreen").then((m) => ({ default: m.TherapistClosingScreen }))
);
const HistoryScreen = lazy(() =>
  import("./components/HistoryScreen").then((m) => ({ default: m.HistoryScreen }))
);
const ChatScreen = lazy(() =>
  import("./components/ChatScreen").then((m) => ({ default: m.ChatScreen }))
);
const SettingsScreen = lazy(() =>
  import("./components/SettingsScreen").then((m) => ({ default: m.SettingsScreen }))
);
const MemoryScreen = lazy(() =>
  import("./components/MemoryScreen").then((m) => ({ default: m.MemoryScreen }))
);
const MyVoiceScreen = lazy(() =>
  import("./components/MyVoiceScreen").then((m) => ({ default: m.MyVoiceScreen }))
);
const TacticalReportScreen = lazy(() =>
  import("./components/TacticalReportScreen").then((m) => ({ default: m.TacticalReportScreen }))
);
const OnboardingScreen = lazy(() =>
  import("./components/OnboardingScreen").then((m) => ({ default: m.OnboardingScreen }))
);

function ScreenFallback() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: "#F5EFE6" }}
    >
      <div
        className="animate-spin"
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          border: "2px solid #E8E0D4",
          borderTopColor: "#C8522A",
        }}
        role="status"
        aria-label="Loading screen"
      />
    </div>
  );
}

/** Lazy screens load in their own chunk; each gets a crash boundary + loader. */
function LazyScreen({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary label="screen">
      <Suspense fallback={<ScreenFallback />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { authUser, authLoading } = useAppContext();
  const location = useLocation();
  if (authLoading) return <ScreenFallback />;
  if (!authUser) return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  return children;
}

/** Layout that persists the TabBar across all main authenticated pages */
function TabBarLayout() {
  return (
    <>
      <Outlet />
      <TabBar />
    </>
  );
}

function ProtectedHome() {
  return (
    <RequireAuth>
      <HomeScreen />
    </RequireAuth>
  );
}

function ProtectedQuick() {
  return (
    <RequireAuth>
      <LazyScreen><QuickModeScreen /></LazyScreen>
    </RequireAuth>
  );
}

function ProtectedPractice() {
  return (
    <RequireAuth>
      <LazyScreen><PracticeScreen /></LazyScreen>
    </RequireAuth>
  );
}

function ProtectedTacticalReport() {
  return (
    <RequireAuth>
      <LazyScreen><TacticalReportScreen /></LazyScreen>
    </RequireAuth>
  );
}

function ProtectedTherapistNew() {
  return (
    <RequireAuth>
      <LazyScreen><TherapistScreen /></LazyScreen>
    </RequireAuth>
  );
}

function ProtectedTherapistClosing() {
  return (
    <RequireAuth>
      <LazyScreen><TherapistClosingScreen /></LazyScreen>
    </RequireAuth>
  );
}

function ProtectedHistoryNew() {
  return (
    <RequireAuth>
      <LazyScreen><HistoryScreen /></LazyScreen>
    </RequireAuth>
  );
}

function ProtectedVoiceNew() {
  return (
    <RequireAuth>
      <LazyScreen><MyVoiceScreen /></LazyScreen>
    </RequireAuth>
  );
}

function ProtectedChat() {
  return (
    <RequireAuth>
      <LazyScreen><ChatScreen /></LazyScreen>
    </RequireAuth>
  );
}

function ProtectedChatIncognito() {
  return (
    <RequireAuth>
      <LazyScreen><ChatScreen incognito /></LazyScreen>
    </RequireAuth>
  );
}

function ProtectedChatThread() {
  return (
    <RequireAuth>
      <LazyScreen><ChatScreen /></LazyScreen>
    </RequireAuth>
  );
}

function ProtectedSettings() {
  return (
    <RequireAuth>
      <LazyScreen><SettingsScreen /></LazyScreen>
    </RequireAuth>
  );
}

function ProtectedMemory() {
  return (
    <RequireAuth>
      <LazyScreen><MemoryScreen /></LazyScreen>
    </RequireAuth>
  );
}

export const router = createBrowserRouter([
  { path: "/", Component: SplashScreen },
  { path: "/onboarding", Component: () => (<LazyScreen><OnboardingScreen /></LazyScreen>) },
  { path: "/auth", Component: AuthScreen },
  { path: "*", Component: NotFoundScreen },
  {
    // Layout route: renders TabBar once, persists across all child pages
    Component: TabBarLayout,
    children: [
      { path: "/home", Component: ProtectedHome },
      { path: "/chat", Component: ProtectedChat },
      { path: "/chat/incognito", Component: ProtectedChatIncognito },
      { path: "/chat/:threadId", Component: ProtectedChatThread },
      { path: "/settings", Component: ProtectedSettings },
      { path: "/settings/memory", Component: ProtectedMemory },
      { path: "/quick", Component: ProtectedQuick },
      { path: "/practice", Component: ProtectedPractice },
      { path: "/tactical-report", Component: ProtectedTacticalReport },
      { path: "/therapist", Component: ProtectedTherapistNew },
      { path: "/therapist-close", Component: ProtectedTherapistClosing },
      { path: "/history", Component: ProtectedHistoryNew },
      { path: "/voice", Component: ProtectedVoiceNew },
    ],
  },
]);

