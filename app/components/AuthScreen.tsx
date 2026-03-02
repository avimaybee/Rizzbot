import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { GrainOverlay } from "./GrainOverlay";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Mail } from "lucide-react";
import {
  resetPassword,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from "../../services/firebaseService";
import { useAppContext } from "../app-context";

const photos = [
  {
    src: "https://images.unsplash.com/photo-1761046543573-5dd23d38ea85?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5b3VuZyUyMHdvbWFuJTIwc21pbGluZyUyMHBvcnRyYWl0JTIwd2FybXxlbnwxfHx8fDE3NzIxODg0MzJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    rotate: "-6deg",
    top: "4%",
    left: "8%",
    zIndex: 1,
  },
  {
    src: "https://images.unsplash.com/photo-1628499636754-3162d34ca39c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5b3VuZyUyMG1hbiUyMGxhdWdoaW5nJTIwY2FuZGlkJTIwcG9ydHJhaXR8ZW58MXx8fHwxNzcyMTg4NDMyfDA&ixlib=rb-4.1.0&q=80&w=1080",
    rotate: "4deg",
    top: "2%",
    left: "35%",
    zIndex: 2,
  },
  {
    src: "https://images.unsplash.com/photo-1758523672800-63130c59175b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb3VwbGUlMjBoYXBweSUyMGNhc3VhbCUyMGRhdGluZ3xlbnwxfHx8fDE3NzIxODg0MzN8MA&ixlib=rb-4.1.0&q=80&w=1080",
    rotate: "-3deg",
    top: "8%",
    left: "55%",
    zIndex: 3,
  },
];

type EmailMode = "signin" | "signup" | "reset";

export function AuthScreen() {
  const navigate = useNavigate();
  const { authUser } = useAppContext();
  const [mode, setMode] = useState<EmailMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);

  useEffect(() => {
    if (authUser) {
      navigate("/home", { replace: true });
    }
  }, [authUser, navigate]);

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Google sign-in failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async () => {
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (mode !== "reset" && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        await signUpWithEmail(email.trim(), password, displayName.trim() || undefined);
      } else if (mode === "signin") {
        await signInWithEmail(email.trim(), password);
      } else {
        await resetPassword(email.trim());
        setError("Reset link sent. Check your email.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ backgroundColor: "#F5EFE6" }}
    >
      <GrainOverlay />

      <div className="relative w-full" style={{ height: "42%" }}>
        {photos.map((photo, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              top: photo.top,
              left: photo.left,
              transform: `rotate(${photo.rotate})`,
              zIndex: photo.zIndex,
              width: "42%",
            }}
          >
            <div
              className="p-2 pb-8"
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 8,
                boxShadow: "0 4px 20px rgba(26, 18, 8, 0.12)",
              }}
            >
              <ImageWithFallback
                src={photo.src}
                alt="Person"
                className="w-full aspect-[3/4] object-cover"
                style={{ borderRadius: 4 }}
              />
            </div>
          </div>
        ))}
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 z-20"
        style={{
          backgroundColor: "#FDFAF5",
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          boxShadow: "0 -4px 30px rgba(26, 18, 8, 0.08)",
          minHeight: "58%",
        }}
      >
        <div className="flex justify-center pt-3">
          <div
            style={{
              width: 40,
              height: 4,
              borderRadius: 100,
              backgroundColor: "#E8E0D4",
            }}
          />
        </div>

        <div className="px-5 pt-8 pb-8 flex flex-col items-center">
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12,
              fontWeight: 400,
              letterSpacing: "0.15em",
              color: "rgba(26, 18, 8, 0.55)",
              textTransform: "uppercase",
            }}
          >
            MASTER THE ART OF
          </p>
          <p
            className="mt-1"
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 36,
              fontWeight: 700,
              fontStyle: "italic",
              color: "#C8522A",
              lineHeight: 1.2,
            }}
          >
            connection
          </p>
          <p
            className="mt-3"
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              fontWeight: 400,
              color: "rgba(26, 18, 8, 0.55)",
            }}
          >
            Your personal AI dating coach is ready to help.
          </p>

          <div className="w-full mt-7 flex flex-col gap-3">
            <button
              onClick={handleGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 cursor-pointer"
              style={{
                height: 56,
                borderRadius: 100,
                border: "1px solid #E8E0D4",
                backgroundColor: "#FFFFFF",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 15,
                fontWeight: 500,
                color: "#1A1208",
                opacity: loading ? 0.6 : 1,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path
                  d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
                  fill="#4285F4"
                />
                <path
                  d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
                  fill="#34A853"
                />
                <path
                  d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.547 0 9s.348 2.825.957 4.039l3.007-2.332z"
                  fill="#FBBC05"
                />
                <path
                  d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </button>

            <button
              onClick={() => setShowEmailForm((prev) => !prev)}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 cursor-pointer transition-colors"
              style={{
                height: 56,
                borderRadius: 100,
                backgroundColor: "#C8522A",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 15,
                fontWeight: 500,
                color: "#FFFFFF",
                border: "none",
                opacity: loading ? 0.6 : 1,
              }}
            >
              <Mail size={18} />
              {showEmailForm ? "Hide email form" : "Sign in with Email"}
            </button>
          </div>

          {showEmailForm && (
            <div
              className="w-full mt-4"
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 20,
                border: "1px solid #E8E0D4",
                padding: 16,
              }}
            >
              <div className="flex gap-2 mb-3">
                {(["signin", "signup", "reset"] as EmailMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    style={{
                      borderRadius: 999,
                      padding: "6px 12px",
                      border: mode === m ? "1px solid #C8522A" : "1px solid #E8E0D4",
                      backgroundColor: mode === m ? "#F5E8E0" : "transparent",
                      color: mode === m ? "#C8522A" : "rgba(26,18,8,0.65)",
                      fontSize: 12,
                      fontFamily: "'DM Sans', sans-serif",
                      cursor: "pointer",
                    }}
                  >
                    {m === "signin" ? "Sign in" : m === "signup" ? "Sign up" : "Reset"}
                  </button>
                ))}
              </div>

              {mode === "signup" && (
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Display name (optional)"
                  className="w-full mb-2 h-[42px] px-3 rounded-[12px] border border-[#E8E0D4] bg-[#FFFFFF] outline-none text-[14px] text-[#1A1208] transition-all duration-300 focus:border-[#C8522A] focus:ring-[3px] focus:ring-[#C8522A]/20 shadow-sm"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                />
              )}

              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                type="email"
                className="w-full mb-2 h-[42px] px-3 rounded-[12px] border border-[#E8E0D4] bg-[#FFFFFF] outline-none text-[14px] text-[#1A1208] transition-all duration-300 focus:border-[#C8522A] focus:ring-[3px] focus:ring-[#C8522A]/20 shadow-sm"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              />

              {mode !== "reset" && (
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  type="password"
                  className="w-full mb-2 h-[42px] px-3 rounded-[12px] border border-[#E8E0D4] bg-[#FFFFFF] outline-none text-[14px] text-[#1A1208] transition-all duration-300 focus:border-[#C8522A] focus:ring-[3px] focus:ring-[#C8522A]/20 shadow-sm"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                />
              )}

              {error && (
                <p
                  style={{
                    marginBottom: 8,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 12,
                    color: error.toLowerCase().includes("sent") ? "#7A9E7E" : "#C8522A",
                  }}
                >
                  {error}
                </p>
              )}

              <button
                onClick={handleEmailSubmit}
                disabled={loading}
                style={{
                  width: "100%",
                  height: 42,
                  borderRadius: 12,
                  border: "none",
                  backgroundColor: "#C8522A",
                  color: "#FFFFFF",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? "Please wait..." : mode === "reset" ? "Send reset link" : "Continue"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
