const AriaWelcome = () => {
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Bom dia";
        if (hour < 18) return "Boa tarde";
        return "Boa noite";
    };

    return (
        <div className="flex flex-col items-center justify-center text-center px-4 select-none mb-6 animate-fade-in">
            <h1 className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight flex items-center gap-3 animate-scale-in">
                <img src="/aria-logo.png" alt="ARIA" className="w-10 h-10 md:w-12 md:h-12 rounded-xl" />
                {getGreeting()}, <span className="text-gradient">Senhor Erick</span>
            </h1>
        </div>
    );
};

export default AriaWelcome;
