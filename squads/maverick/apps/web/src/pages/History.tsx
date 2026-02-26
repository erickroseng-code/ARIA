import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bird, Clock, ChevronRight, Trash2, User, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MaverickAPI } from "@/services/api";
import { FluidOrganism } from "@/components/FluidOrganism";

export default function History() {
    const navigate = useNavigate();
    const [snapshots, setSnapshots] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        async function fetchHistory() {
            setIsLoading(true);
            const data = await MaverickAPI.listHistory();
            setSnapshots(data);
            setIsLoading(false);
        }
        fetchHistory();
    }, []);

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeletingId(id);
        await MaverickAPI.deleteSnapshot(id);
        setSnapshots(prev => prev.filter(s => s.id !== id));
        setDeletingId(null);
    };

    const formatDate = (iso: string) => {
        return new Date(iso).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    return (
        <div className="min-h-screen bg-apple-base text-[#1D1D1F] overflow-hidden relative">
            {/* Background organism */}
            <div className="fixed inset-0 pointer-events-none opacity-80 mix-blend-multiply">
                <FluidOrganism
                    colors={[
                        "hsla(22, 38%, 74%,",
                        "hsla(196, 60%, 82%,",
                        "hsla(210, 40%, 90%,",
                        "hsla(30, 40%, 85%,",
                    ]}
                />
            </div>

            <div className="relative z-10 max-w-3xl mx-auto px-4 pt-16 pb-24">
                {/* Header */}
                <div className="flex items-center gap-3 mb-10">
                    <button
                        onClick={() => navigate("/")}
                        className="p-2 rounded-full bg-white border border-black/5 hover:bg-[#F2F2F7] shadow-sm transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 text-[#1D1D1F]" />
                    </button>
                    <div className="w-8 h-8 rounded-full bg-apple-softBlue flex items-center justify-center shadow-sm border border-black/5">
                        <Bird className="w-4 h-4 text-[#1D1D1F]" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-[#1D1D1F]">Histórico</h1>
                        <p className="text-xs font-semibold text-[#8E8E93]">Suas análises salvas</p>
                    </div>
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div
                                key={i}
                                className="h-20 rounded-3xl bg-white/60 border border-black/5 animate-pulse"
                            />
                        ))}
                    </div>
                ) : snapshots.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center py-24 bg-white/80 backdrop-blur-apple rounded-3xl border border-black/5 shadow-sm"
                    >
                        <Clock className="w-12 h-12 text-[#8E8E93] mx-auto mb-4" />
                        <p className="text-[#8E8E93] font-semibold text-sm">Nenhuma análise salva ainda.</p>
                        <button
                            onClick={() => navigate("/")}
                            className="mt-6 px-5 py-2.5 rounded-full bg-[#1D1D1F] text-white hover:bg-black shadow-sm text-sm font-semibold transition-all"
                        >
                            Analisar um Perfil
                        </button>
                    </motion.div>
                ) : (
                    <AnimatePresence>
                        <div className="space-y-3">
                            {snapshots.map((snapshot, idx) => (
                                <motion.div
                                    key={snapshot.id}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ delay: idx * 0.05 }}
                                    onClick={() => navigate(`/analysis/${snapshot.handle}?snapshot=${snapshot.id}`)}
                                    className="group relative flex items-center gap-4 px-5 py-4 rounded-[24px] bg-white/80 hover:bg-white backdrop-blur-apple border border-black/5 hover:border-black/10 shadow-sm hover:shadow-md cursor-pointer transition-all duration-300"
                                >
                                    {/* Avatar */}
                                    <div className="w-10 h-10 rounded-full bg-[#1D1D1F] flex items-center justify-center shrink-0 shadow-sm border border-black/5">
                                        <User className="w-5 h-5 text-white" />
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-[#1D1D1F] text-sm truncate">@{snapshot.handle}</p>
                                        <p className="text-xs font-semibold text-[#8E8E93] mt-0.5 flex items-center gap-1.5">
                                            <Clock className="w-3 h-3" />
                                            {formatDate(snapshot.createdAt)}
                                        </p>
                                    </div>

                                    {/* Badge: source */}
                                    <span className={`hidden sm:block text-[10px] font-bold px-2 py-0.5 rounded-full border ${snapshot.source === "real_scraping"
                                        ? "bg-[#34C759]/10 text-[#34C759] border-[#34C759]/20"
                                        : "bg-[#FF9500]/10 text-[#FF9500] border-[#FF9500]/20"
                                        }`}>
                                        {snapshot.source === "real_scraping" ? "Real" : "Simulado"}
                                    </span>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={(e) => handleDelete(snapshot.id, e)}
                                            disabled={deletingId === snapshot.id}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-xl hover:bg-[#FF3B30]/10 transition-all"
                                        >
                                            <Trash2 className={`w-4 h-4 ${deletingId === snapshot.id ? "text-[#8E8E93]" : "text-[#FF3B30]"}`} />
                                        </button>
                                        <ChevronRight className="w-5 h-5 text-[#8E8E93] group-hover:text-[#1D1D1F] transition-colors" />
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
}
