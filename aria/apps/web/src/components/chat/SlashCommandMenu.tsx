import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { SlashCommand } from "@/data/slashCommands";

interface SlashCommandMenuProps {
    items: SlashCommand[];
    selectedIndex: number;
    onSelect: (command: SlashCommand) => void;
    onHover: (index: number) => void;
}

export const SlashCommandMenu = ({ items, selectedIndex, onSelect, onHover }: SlashCommandMenuProps) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to selected item when using keyboard
    useEffect(() => {
        if (!scrollRef.current) return;
        const container = scrollRef.current;
        const selectedElement = container.children[selectedIndex] as HTMLElement;
        if (selectedElement) {
            const top = selectedElement.offsetTop;
            const bottom = top + selectedElement.offsetHeight;
            const containerWindowTop = container.scrollTop;
            const containerWindowBottom = containerWindowTop + container.offsetHeight;

            if (top < containerWindowTop) {
                container.scrollTop = top;
            } else if (bottom > containerWindowBottom) {
                container.scrollTop = bottom - container.offsetHeight;
            }
        }
    }, [selectedIndex]);

    if (items.length === 0) return null;

    return (
        <div className="absolute bottom-[calc(100%+8px)] left-0 w-full bg-[#1a1425]/75 backdrop-blur-xl border border-white/[0.1] rounded-[24px] shadow-[0_16px_40px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.05)] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200 z-50">
            <div
                ref={scrollRef}
                className="max-h-[320px] overflow-y-auto scrollbar-hidden p-3 flex flex-col gap-1.5"
            >
                {items.map((item, index) => {
                    const Icon = item.icon;
                    const isSelected = index === selectedIndex;

                    return (
                        <button
                            key={item.id}
                            onClick={(e) => {
                                e.preventDefault();
                                onSelect(item);
                            }}
                            onMouseEnter={() => onHover(index)}
                            className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-[16px] text-left transition-all duration-200",
                                isSelected ? "bg-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] border border-white/[0.05]" : "border border-transparent hover:bg-white/[0.04]"
                            )}
                        >
                            <div className={cn(
                                "p-1.5 flex-shrink-0 transition-colors",
                                typeof Icon === 'string'
                                    ? "bg-white/95 rounded-[10px] shadow-sm" // Fundo branco p/ logos originais
                                    : cn(
                                        "rounded-[10px]",
                                        isSelected ? "bg-white/20 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]" : "bg-white/10 text-white/70"
                                    )
                            )}>
                                {typeof Icon === 'string' ? (
                                    <img src={Icon} alt={item.category} className="w-5 h-5 object-contain" />
                                ) : (
                                    <Icon className="w-5 h-5" />
                                )}
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className={cn(
                                    "text-[14px] font-medium leading-none mb-1.5 truncate tracking-tight",
                                    isSelected ? "text-white drop-shadow-sm" : "text-white/90"
                                )}>
                                    {item.title}
                                </span>
                                <span className="text-[12px] text-white/50 truncate flex items-center gap-1.5 line-clamp-1">
                                    <span className="px-1.5 py-0.5 rounded-[4px] bg-white/10 text-white/50 font-mono text-[9px] uppercase tracking-wider flex-shrink-0">
                                        {item.category}
                                    </span>
                                    <span className="truncate">{item.syntax}</span>
                                </span>
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    );
};
