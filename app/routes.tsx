import React from "react";
import { createBrowserRouter, Navigate } from "react-router";
import { SplashScreen } from "./components/SplashScreen";
import { OnboardingScreen } from "./components/OnboardingScreen";
import { AuthScreen } from "./components/AuthScreen";
import { HomeScreen } from "./components/HomeScreen";
import { QuickModeScreen } from "./components/QuickModeScreen";
import { PracticeScreen } from "./components/PracticeScreen";
import { TherapistScreen } from "./components/TherapistScreen";
import { TherapistClosingScreen } from "./components/TherapistClosingScreen";
import { HistoryScreen } from "./components/HistoryScreen";
import { MyVoiceScreen } from "./components/MyVoiceScreen";
import { TacticalReportScreen } from "./components/TacticalReportScreen";
import { AdminPaymentsScreen } from "./components/AdminPaymentsScreen";
import { NotFoundScreen } from "./components/NotFoundScreen";
import { useAppContext } from "./app-context";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { authUser } = useAppContext();
  if (!authUser) return <Navigate to="/auth" replace />;
  return children;
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
      <QuickModeScreen />
    </RequireAuth>
  );
}

function ProtectedPractice() {
  return (
    <RequireAuth>
      <PracticeScreen />
    </RequireAuth>
  );
}

function ProtectedTacticalReport() {
  return (
    <RequireAuth>
      <TacticalReportScreen />
    </RequireAuth>
  );
}

function ProtectedTherapistNew() {
  return (
    <RequireAuth>
      <TherapistScreen />
    </RequireAuth>
  );
}

function ProtectedTherapistClosing() {
  return (
    <RequireAuth>
      <TherapistClosingScreen />
    </RequireAuth>
  );
}

function ProtectedHistoryNew() {
  return (
    <RequireAuth>
      <HistoryScreen />
    </RequireAuth>
  );
}

function ProtectedVoiceNew() {
  return (
    <RequireAuth>
      <MyVoiceScreen />
    </RequireAuth>
  );
}

function ProtectedAdmin() {
  return (
    <RequireAuth>
      <AdminPaymentsScreen />
    </RequireAuth>
  );
}

export const router = createBrowserRouter([
  { path: "/", Component: SplashScreen },
  { path: "/onboarding", Component: OnboardingScreen },
  { path: "/auth", Component: AuthScreen },
  { path: "/home", Component: ProtectedHome },
  { path: "/quick", Component: ProtectedQuick },
  { path: "/practice", Component: ProtectedPractice },
  { path: "/tactical-report", Component: ProtectedTacticalReport },
  { path: "/therapist", Component: ProtectedTherapistNew },
  { path: "/therapist-close", Component: ProtectedTherapistClosing },
  { path: "/history", Component: ProtectedHistoryNew },
  { path: "/voice", Component: ProtectedVoiceNew },
  { path: "/admin/payments", Component: ProtectedAdmin },
  { path: "*", Component: NotFoundScreen },
]);
