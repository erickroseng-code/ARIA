interface AriaWelcomeProps {
    onSelect?: (command: string) => void;
}

const AriaWelcome = ({ onSelect }: AriaWelcomeProps) => {
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Bom dia";
        if (hour < 18) return "Boa tarde";
        return "Boa noite";
    };

    return (
        <div className="flex flex-col items-center text-center px-4 select-none animate-fade-in gap-6">
            {/* Greeting */}
            <h1 className="text-3xl md:text-4xl font-semibold text-white tracking-tight flex items-center gap-3 animate-scale-in drop-shadow-sm">
                <img src="/aria-logo.png" alt="ARIA" className="w-10 h-10 md:w-12 md:h-12 rounded-xl shadow-[0_0_15px_rgba(255,255,255,0.2)]" />
                {getGreeting()},{" "}
                <span
                    className="text-white drop-shadow-md font-light italic"
                    style={{ fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}
                >
                    Senhor Erick
                </span>
            </h1>
        </div>
    );
};

export default AriaWelcome;
