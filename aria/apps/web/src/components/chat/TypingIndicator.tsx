import Image from "next/image";

const TypingIndicator = () => {
    return (
        <div className="w-full mb-8 opacity-0 animate-fade-up">
            {/* Avatar row */}
            <div className="flex items-center gap-2.5 mb-3">
                <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-primary/40">
                    <Image src="/aria-logo.png" alt="ARIA" width={28} height={28} className="w-full h-full object-cover" />
                </div>
                <span className="text-xs font-semibold text-primary/95 tracking-wide uppercase">ARIA</span>
            </div>
            {/* Thinking message */}
            <div className="pl-[38px] flex items-center gap-3">
                <span className="text-[14px] text-white/50 italic">ARIA está pensando</span>
                <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-[bounce_1.2s_ease-in-out_infinite_0ms]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-[bounce_1.2s_ease-in-out_infinite_150ms]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-[bounce_1.2s_ease-in-out_infinite_300ms]" />
                </div>
            </div>
        </div>
    );
};

export default TypingIndicator;

