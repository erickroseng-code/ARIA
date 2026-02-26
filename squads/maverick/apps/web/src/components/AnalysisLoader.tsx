import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FluidOrganism } from "@/components/FluidOrganism";

// Each step maps to what really happens on the backend
const STEPS = [
    {
        icon: "🕵️",
        agent: "Scout",
        title: "Escaneando o perfil...",
        detail: "Acessando bio, posts recentes, destaques e métricas públicas",
        color: "hsla(22, 38%, 74%,", // Gold/Rose
        duration: 8000,
    },
    {
        icon: "📚",
        agent: "Scholar",
        title: "Consultando a base de conhecimento...",
        detail: "Buscando padrões em Hit Makers, Contágio, Neuromarketing e mais 8 livros",
        color: "hsla(196, 60%, 82%,", // Soft Blue
        duration: 12000,
    },
    {
        icon: "🔬",
        agent: "Scholar",
        title: "Cruzando dados com teoria...",
        detail: "Identificando gaps de identidade visual, posicionamento e distribuição",
        color: "hsla(210, 40%, 90%,", // Light Blue
        duration: 8000,
    },
    {
        icon: "🧠",
        agent: "Strategist",
        title: "Gerando diagnóstico...",
        detail: "Formulando análise com embasamento nos 11 livros da base",
        color: "hsla(30, 40%, 85%,", // Light Gold
        duration: 15000,
    },
    {
        icon: "⚡",
        agent: "Maverick",
        title: "Montando o relatório final...",
        detail: "Priorizando ações de maior impacto para esta semana",
        color: "hsla(200, 50%, 80%,", // Deeper Soft Blue
        duration: 99999, // stays until analysis is ready
    },
];

interface AnalysisLoaderProps {
    handle: string;
}

export function AnalysisLoader({ handle }: AnalysisLoaderProps) {
    const [stepIndex, setStepIndex] = useState(0);
    const [completedSteps, setCompletedSteps] = useState<number[]>([]);

    useEffect(() => {
        let elapsed = 0;

        const timers = STEPS.slice(0, -1).map((step, i) => {
            elapsed += step.duration;
            return setTimeout(() => {
                setCompletedSteps(prev => [...prev, i]);
                setStepIndex(i + 1);
            }, elapsed);
        });

        return () => timers.forEach(clearTimeout);
    }, []);

    const current = STEPS[stepIndex];
    const colors = [
        current.color,
        "hsla(22, 38%, 74%,",
        "hsla(196, 60%, 82%,",
        "hsla(210, 40%, 90%,",
    ];

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-apple-base text-[#1D1D1F] overflow-hidden relative px-4">
            {/* Dynamic fluid background */}
            <div className="fixed inset-0 pointer-events-none opacity-80 mix-blend-multiply transition-all duration-1000">
                <FluidOrganism colors={colors} />
            </div>

            <div className="relative z-10 w-full max-w-md mx-auto">

                {/* Handle badge */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-10"
                >
                    <span className="px-4 py-1.5 rounded-full bg-white/80 border border-black/5 text-[#1D1D1F] shadow-sm text-sm font-semibold tracking-tight">
                        @{handle}
                    </span>
                </motion.div>

                {/* Current step — big animated text */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={stepIndex}
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="text-center mb-12"
                    >
                        <motion.span
                            className="text-5xl mb-4 block"
                            animate={{ scale: [1, 1.08, 1] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        >
                            {current.icon}
                        </motion.span>

                        <span className="text-xs font-bold tracking-widest text-[#8E8E93] uppercase mb-3 block">
                            {current.agent}
                        </span>

                        <h2 className="text-2xl font-bold tracking-tight text-[#1D1D1F] mb-2 drop-shadow-sm">
                            {current.title}
                        </h2>
                        <p className="text-[15px] font-medium text-[#3A3A3C] leading-relaxed max-w-xs mx-auto">
                            {current.detail}
                        </p>
                    </motion.div>
                </AnimatePresence>

                {/* Step progress list */}
                <div className="space-y-2 bg-white/60 backdrop-blur-apple p-3 border border-black/5 shadow-sm rounded-3xl">
                    {STEPS.map((step, i) => {
                        const isDone = completedSteps.includes(i);
                        const isActive = i === stepIndex;
                        const isFuture = i > stepIndex;

                        return (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -16 }}
                                animate={{ opacity: isFuture ? 0.4 : 1, x: 0 }}
                                transition={{ delay: i * 0.06, duration: 0.4 }}
                                className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all duration-500 ${isActive ? "bg-white border border-black/5 shadow-sm" : ""
                                    }`}
                            >
                                {/* Status indicator */}
                                <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                                    {isDone ? (
                                        <motion.svg
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="w-5 h-5 text-[#34C759]"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                        </motion.svg>
                                    ) : isActive ? (
                                        <span className="w-2 h-2 rounded-full bg-apple-primary animate-pulse block shadow-sm" />
                                    ) : (
                                        <span className="w-2 h-2 rounded-full bg-black/10 block" />
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-wide">
                                            {step.agent}
                                        </span>
                                    </div>
                                    <p className={`text-[14px] font-semibold truncate transition-colors duration-300 ${isDone ? "text-[#8E8E93] line-through" : isActive ? "text-[#1D1D1F]" : "text-[#8E8E93]"
                                        }`}>
                                        {step.title}
                                    </p>
                                </div>

                                {isDone && (
                                    <span className="text-[10px] font-bold text-[#34C759]/80 shrink-0">concluído</span>
                                )}
                                {isActive && (
                                    <span className="text-[10px] font-bold text-[#007AFF] shrink-0 animate-pulse">em andamento</span>
                                )}
                            </motion.div>
                        );
                    })}
                </div>

                {/* Subtle progress bar */}
                <div className="mt-8 h-px w-full bg-black/5 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-r from-apple-softBlue to-apple-gold rounded-full"
                        initial={{ width: "0%" }}
                        animate={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                </div>
                <p className="text-center text-xs font-semibold text-[#8E8E93] mt-3">
                    {stepIndex + 1} de {STEPS.length} etapas
                </p>
            </div>
        </div>
    );
}
