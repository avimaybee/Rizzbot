import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Zap, Sparkles, ShieldCheck, Copy, ExternalLink, ArrowRight } from "lucide-react";
import { useAppContext } from "../app-context";
import { submitUtrPayment } from "../../services/dbService";

interface PremiumModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function PremiumModal({ isOpen, onClose }: PremiumModalProps) {
    const { authUser, updatePremiumStatus } = useAppContext();
    const [step, setStep] = useState<"features" | "payment">("features");
    const [utr, setUtr] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const upiId = "avimaybe7@oksbi";
    const amount = 500;
    const transactionNote = `RIZZ_${authUser?.uid?.slice(-6) || "USER"}`;

    // UPI Deep Link for QR
    const upiLink = `upi://pay?pa=${upiId}&pn=Rizzbot&am=${amount}&tn=${transactionNote}&cu=INR`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiLink)}`;

    const handleCopyUpi = () => {
        navigator.clipboard.writeText(upiId);
        alert("UPI ID copied!");
    };

    const handleSubmitUtr = async () => {
        if (!/^\d{12}$/.test(utr)) {
            setError("Please enter a valid 12-digit UTR/Transaction ID.");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const res = await submitUtrPayment(utr);
            if (res.success) {
                await updatePremiumStatus();
                alert("Success! Your Premium access is now active.");
                onClose();
            }
        } catch (err: any) {
            setError(err.message || "Failed to verify transaction. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative w-full max-w-md bg-[#FDFCFB] rounded-[32px] overflow-hidden shadow-2xl border border-[#E8DCC4]"
                    >
                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-6 right-6 p-2 rounded-full bg-[#F5EFE6] text-[#1A1208] hover:bg-[#E8DCC4] transition-colors z-20"
                        >
                            <X size={20} />
                        </button>

                        <div className="px-8 pt-10 pb-12 text-center">
                            {step === "features" ? (
                                <>
                                    <div className="inline-flex items-center justify-center p-4 mb-6 rounded-3xl bg-[#C8522A]/10 text-[#C8522A]">
                                        <Zap size={32} fill="currentColor" />
                                    </div>

                                    <h2 className="premium-title">Rizzbot Premium</h2>
                                    <p className="mt-2 text-[#1A1208]/60 font-medium">
                                        Unlock the full potential of your game.
                                    </p>

                                    <div className="mt-8 space-y-4 text-left">
                                        <FeatureItem icon={<Sparkles size={18} />} text="Unlimited AI advice & simulations" />
                                        <FeatureItem icon={<ShieldCheck size={18} />} text="Advanced persona personalization" />
                                        <FeatureItem icon={<Zap size={18} />} text="Priority responses & no limits" />
                                    </div>

                                    <div className="mt-10 p-6 rounded-3xl bg-[#F5EFE6] border border-[#E8DCC4]">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-xs font-bold uppercase tracking-widest text-[#1A1208]/40">
                                                    Lifetime Deal
                                                </p>
                                                <p className="text-2xl font-bold text-[#1A1208]">₹500</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-[#1A1208]/60">Pay once, keep it</p>
                                                <p className="text-sm font-bold text-[#C8522A]">Forever</p>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setStep("payment")}
                                        className="w-full mt-8 py-4 px-6 rounded-2xl bg-[#1A1208] text-white font-bold flex items-center justify-center gap-2 hover:bg-[#2D1F0E] active:scale-[0.98] transition-all"
                                    >
                                        Get Lifetime Access
                                    </button>
                                </>
                            ) : (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                                    <h3 className="text-2xl font-bold text-[#1A1208]">Pay via UPI</h3>
                                    <p className="text-sm text-[#1A1208]/60 mt-2">Scan the QR code with any UPI app</p>

                                    <div className="mt-6 flex flex-col items-center">
                                        <div className="p-4 bg-white rounded-3xl border-2 border-[#E8DCC4] shadow-sm">
                                            <img src={qrUrl} alt="UPI QR Code" className="w-40 h-40" />
                                        </div>

                                        <button
                                            onClick={handleCopyUpi}
                                            className="mt-4 flex items-center gap-2 text-xs font-bold text-[#C8522A] uppercase tracking-wider"
                                        >
                                            <Copy size={14} /> Copy UPI ID: {upiId}
                                        </button>
                                    </div>

                                    <div className="mt-8 text-left">
                                        <label className="text-xs font-bold text-[#1A1208]/40 uppercase tracking-widest ml-1">
                                            Step 2: Enter 12-Digit UTR / Ref No.
                                        </label>
                                        <div className="mt-2 relative">
                                            <input
                                                type="text"
                                                placeholder="e.g. 402928374656"
                                                value={utr}
                                                onChange={(e) => setUtr(e.target.value.replace(/\D/g, "").slice(0, 12))}
                                                className="w-full p-4 rounded-2xl bg-[#F5EFE6] border border-[#E8DCC4] text-[#1A1208] font-mono focus:outline-none focus:ring-2 focus:ring-[#C8522A]/20"
                                            />
                                        </div>
                                        {error && <p className="mt-2 text-xs text-red-500 font-medium ml-1">{error}</p>}
                                    </div>

                                    <button
                                        onClick={handleSubmitUtr}
                                        disabled={loading || utr.length < 12}
                                        className="w-full mt-6 py-4 px-6 rounded-2xl bg-[#C8522A] text-white font-bold flex items-center justify-center gap-2 hover:bg-[#B04520] active:scale-[0.98] transition-all disabled:opacity-50"
                                    >
                                        {loading ? "Verifying..." : "Activate Lifetime Access"}
                                        {!loading && <ArrowRight size={18} />}
                                    </button>

                                    <p className="mt-4 text-[10px] text-[#1A1208]/40 uppercase tracking-widest font-bold">
                                        Access is granted instantly after submission
                                    </p>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>

                    <style dangerouslySetInnerHTML={{
                        __html: `
            .premium-title {
              font-family: 'Cormorant Garamond', serif;
              font-size: 32px;
              font-weight: 700;
              font-style: italic;
              color: #1A1208;
              line-height: 1.2;
            }
          `}} />
                </div>
            )}
        </AnimatePresence>
    );
}

function FeatureItem({ icon, text }: { icon: React.ReactNode; text: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className="p-1 rounded bg-[#C8522A]/10 text-[#C8522A]">
                {icon}
            </div>
            <p className="text-[#1A1208] font-medium text-sm">{text}</p>
            <div className="ml-auto">
                <Check size={16} className="text-[#C8522A]" />
            </div>
        </div>
    );
}
