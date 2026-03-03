import { useNavigate } from "react-router";
import { GrainOverlay } from "./GrainOverlay";
import { MicroIllustrations } from "./MicroIllustrations";

export function NotFoundScreen() {
    const navigate = useNavigate();

    return (
        <div className="relative min-h-[100svh] flex flex-col items-center justify-center px-6" style={{ backgroundColor: "#F5EFE6" }}>
            <GrainOverlay />
            <div className="pointer-events-none absolute inset-0">
                <MicroIllustrations />
            </div>
            <div className="relative z-10 text-center max-w-[320px]">
                <p
                    style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: 96,
                        fontWeight: 800,
                        color: "rgba(192, 94, 60, 0.18)",
                        lineHeight: 1,
                    }}
                >
                    404
                </p>
                <p
                    style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: 28,
                        fontWeight: 700,
                        fontStyle: "italic",
                        color: "#1A1208",
                        marginTop: -16,
                        lineHeight: 1.2,
                    }}
                >
                    Wrong chat, maybe?
                </p>
                <p
                    style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 14,
                        color: "rgba(26,18,8,0.5)",
                        marginTop: 12,
                        lineHeight: 1.5,
                    }}
                >
                    This page doesn't exist. Let's get you back on track.
                </p>
                <button
                    onClick={() => navigate("/home")}
                    className="hover-scale fade-press cursor-pointer"
                    style={{
                        margin: "32px auto 0",
                        backgroundColor: "#C8522A",
                        color: "#FFFFFF",
                        border: "none",
                        borderRadius: 100,
                        width: "100%",
                        maxWidth: 320,
                        padding: "14px 24px",
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 15,
                        fontWeight: 600,
                        boxShadow: "0 4px 14px rgba(200,82,42,0.25)",
                    }}
                >
                    Go Home →
                </button>
            </div>
        </div>
    );
}
