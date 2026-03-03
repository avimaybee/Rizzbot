import { useEffect, useState } from "react";
import { ChevronLeft, Check, X, Shield, AlertCircle, Search } from "lucide-react";
import { useNavigate } from "react-router";
import { getAdminPayments, updatePaymentStatus } from "../../services/dbService";
import { GrainOverlay } from "./GrainOverlay";

export function AdminPaymentsScreen() {
    const navigate = useNavigate();
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchTerm, setSearchTerm] = useState("");

    const fetchPayments = async () => {
        try {
            setLoading(true);
            const data = await getAdminPayments();
            setPayments(data);
        } catch (err: any) {
            setError(err.message || "Failed to load payments. Are you an admin?");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPayments();
    }, []);

    const handleStatusUpdate = async (id: number, status: 'COMPLETED' | 'REJECTED') => {
        if (!confirm(`Are you sure you want to ${status.toLowerCase()} this payment?`)) return;

        try {
            await updatePaymentStatus(id, status);
            await fetchPayments();
        } catch (err: any) {
            alert(err.message || "Failed to update status");
        }
    };

    const filteredPayments = payments.filter(p =>
        p.transaction_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.user_email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen pb-12" style={{ backgroundColor: "#F5EFE6" }}>
            <GrainOverlay />

            <div className="relative z-10 px-6 pt-14 max-w-2xl mx-auto">
                <button onClick={() => navigate("/home")} className="flex items-center gap-2 text-[#1A1208]/60 font-medium mb-8">
                    <ChevronLeft size={18} /> Back to App
                </button>

                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 700, fontStyle: "italic" }}>
                            Payment Recon
                        </h1>
                        <p className="text-[#1A1208]/60 mt-1">Verify submitted UPI UTRs</p>
                    </div>
                    <div className="p-3 bg-black rounded-2xl text-white">
                        <Shield size={24} />
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative mb-6">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1A1208]/30" size={18} />
                    <input
                        type="text"
                        placeholder="Search UTR or User Email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-4 pl-12 rounded-2xl bg-[#FDFAF5] border border-[#E8DCC4] text-[#1A1208] focus:ring-2 focus:ring-[#C8522A]/20 transition-all outline-none"
                    />
                </div>

                {error ? (
                    <div className="p-8 text-center bg-red-50 rounded-3xl border border-red-100 mt-12">
                        <AlertCircle className="mx-auto text-red-500 mb-4" size={32} />
                        <p className="text-red-700 font-medium">{error}</p>
                    </div>
                ) : loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-24 bg-white/40 animate-pulse rounded-3xl" />
                        ))}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredPayments.map((p) => (
                            <div
                                key={p.id}
                                className={`p-6 rounded-[28px] border transition-all ${p.status === 'REJECTED' ? 'opacity-50 grayscale' : 'bg-white shadow-sm border-[#E8DCC4]'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#1A1208]/40 mb-1">
                                            UTR / Transaction ID
                                        </p>
                                        <p className="text-lg font-mono font-bold text-[#1A1208]">{p.transaction_id}</p>
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${p.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                            p.status === 'PENDING_RECONCILIATION' ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-red-100 text-red-700'
                                        }`}>
                                        {p.status}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-[#F5EFE6]">
                                    <div>
                                        <p className="text-xs text-[#1A1208]/60 font-medium">{p.user_email}</p>
                                        <p className="text-[10px] text-[#1A1208]/40 font-bold mt-0.5">
                                            {new Date(p.created_at).toLocaleString()}
                                        </p>
                                    </div>

                                    {p.status === 'PENDING_RECONCILIATION' && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleStatusUpdate(p.id, 'REJECTED')}
                                                className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                                title="Reject & Revoke Premium"
                                            >
                                                <X size={20} />
                                            </button>
                                            <button
                                                onClick={() => handleStatusUpdate(p.id, 'COMPLETED')}
                                                className="p-2 rounded-xl bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                                                title="Match & Approve"
                                            >
                                                <Check size={20} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {filteredPayments.length === 0 && (
                            <div className="p-12 text-center text-[#1A1208]/40 bg-white/30 rounded-3xl border border-dashed border-[#E8DCC4]">
                                No payment submissions found.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
