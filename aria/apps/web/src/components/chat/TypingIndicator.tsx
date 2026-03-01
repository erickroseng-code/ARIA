import Image from "next/image";
import { cn } from "@/lib/utils";

const TypingIndicator = () => {
    return (
        <div className="w-full mb-6 animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out">
            <div className="flex items-center gap-2.5 mb-2">
                <div className="relative w-6 h-6 flex items-center justify-center flex-shrink-0">
                    {/* Glowing Spinning Ring */}
                    <svg className="absolute -inset-1 w-8 h-8 animate-[spin_1.5s_linear_infinite] text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle className="opacity-0" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"></circle>
                        <path className="opacity-100" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>

                    {/* ARIA Logo */}
                    <div className="w-5 h-5 rounded-md overflow-hidden relative z-10 bg-transparent">
                        <Image src="/aria-logo.png" alt="ARIA" width={20} height={20} className="w-full h-full object-cover" />
                    </div>
                </div>

                {/* Text Indicator */}
                <span className="text-[14px] font-medium bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent tracking-wide uppercase animate-pulse drop-shadow-sm">
                    Pensando...
                </span>
            </div>

            {/* Content Placeholder (Fade/Gradient) */}
            <div className="pl-[34px] mt-1.5 flex flex-col gap-2">
                <div className="h-5 w-[60%] rounded bg-gradient-to-r from-white/10 via-white/[0.02] to-transparent animate-pulse" />
                <div className="h-4 w-[40%] rounded bg-gradient-to-r from-white/10 via-white/[0.02] to-transparent animate-pulse animation-delay-150" />
            </div>
        </div>
    );
};

export default TypingIndicator;

