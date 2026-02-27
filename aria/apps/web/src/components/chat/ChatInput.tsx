import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import * as mammoth from "mammoth";
import { Send, Mic, MicOff, Plus, Paperclip, Globe, Wand2, Blocks, ChevronLeft, Check, Loader2, FileText, Image as ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { slashCommands, SlashCommand } from "@/data/slashCommands";
import { SlashCommandMenu } from "./SlashCommandMenu";
import { useChatStore } from "@/stores/chatStore";

interface ChatInputProps {
    onSend: (message: string) => void;
    disabled?: boolean;
    prefill?: string;
    onPrefillConsumed?: () => void;
}

const ChatInput = ({ onSend, disabled, prefill, onPrefillConsumed }: ChatInputProps) => {
    const [message, setMessage] = useState("");
    const [isListening, setIsListening] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const recognitionRef = useRef<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const attachmentMenuRef = useRef<HTMLDivElement>(null);

    // Menu States
    const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
    const [menuView, setMenuView] = useState<'main' | 'connectors'>('main');
    const [activeConnectors, setActiveConnectors] = useState<Record<string, boolean>>({
        google: false,
        clickup: false,
        notion: false
    });
    const [recentDocs, setRecentDocs] = useState<any[]>([]);
    const [isLoadingDocs, setIsLoadingDocs] = useState(false);

    // File Attachments
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);

    const { setHubOpen } = useChatStore();
    const [showSlashMenu, setShowSlashMenu] = useState(false);
    const [slashQuery, setSlashQuery] = useState("");
    const [slashIndex, setSlashIndex] = useState(0);

    // Filter commands based on query
    const filteredCommands = useMemo(() => {
        if (!slashQuery) return slashCommands;
        const q = slashQuery.toLowerCase();
        return slashCommands.filter(cmd =>
            cmd.title.toLowerCase().includes(q) ||
            cmd.category.toLowerCase().includes(q) ||
            cmd.syntax.toLowerCase().includes(q)
        );
    }, [slashQuery]);

    useEffect(() => {
        if (prefill) {
            setMessage(prefill);
            onPrefillConsumed?.();
            setTimeout(() => textareaRef.current?.focus(), 0);
        }
    }, [prefill, onPrefillConsumed]);

    // Handle click outside for toggling the attachment menu
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target as Node)) {
                setShowAttachmentMenu(false);
                setTimeout(() => setMenuView('main'), 200); // Reset view after animation
            }
        };

        if (showAttachmentMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showAttachmentMenu]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
        }
    }, [message]);

    const handleAttachmentClick = () => {
        setShowAttachmentMenu(prev => !prev);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            setPendingFiles(prev => [...prev, ...files]);
            setShowAttachmentMenu(false);
            // Reset input so the same file can be selected again if removed
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const removeFile = (index: number) => {
        setPendingFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleMenuAction = (action: string) => {
        if (action === 'files') {
            fileInputRef.current?.click();
            setShowAttachmentMenu(false);
        } else if (action === 'connectors') {
            setMenuView('connectors');
        } else if (action === 'open-hub') {
            setHubOpen(true);
            setShowAttachmentMenu(false);
        } else {
            // Placeholder para futuras integrações
            console.log("Ação do menu clicada:", action);
            setShowAttachmentMenu(false);
        }
    };

    const toggleConnector = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newState = !activeConnectors[id];
        setActiveConnectors(prev => ({ ...prev, [id]: newState }));

        if (id === 'google' && newState) {
            fetchRecentDriveDocs();
        } else if (id === 'google' && !newState) {
            setRecentDocs([]);
        }
    };

    const fetchRecentDriveDocs = async () => {
        setIsLoadingDocs(true);
        try {
            const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
            const res = await fetch(`${API_BASE}/api/workspace/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    service: 'drive',
                    action: 'listRecentFiles',
                    params: { limit: 5 }
                })
            });
            const data = await res.json();
            if (data.success && data.data) {
                setRecentDocs(data.data);
            }
        } catch (error) {
            console.error("Error fetching docs:", error);
        } finally {
            setIsLoadingDocs(false);
        }
    };

    const handleSubmit = async () => {
        if ((!message.trim() && pendingFiles.length === 0) || disabled) return;

        let finalMessage = message.trim();

        // Append text file contents if any
        const textFiles = pendingFiles.filter(f =>
            f.type.startsWith('text/') ||
            f.name.endsWith('.md') ||
            f.name.endsWith('.csv') ||
            f.name.endsWith('.json') ||
            f.name.endsWith('.docx')
        );

        if (textFiles.length > 0) {
            const fileContents = await Promise.all(textFiles.map(async (file) => {
                if (file.name.endsWith('.docx')) {
                    try {
                        const arrayBuffer = await file.arrayBuffer();
                        const result = await mammoth.extractRawText({ arrayBuffer });
                        return `\n\n--- Content from ${file.name} (Word Doc) ---\n${result.value}\n--- End of ${file.name} ---`;
                    } catch (err) {
                        console.error(`Error parsing docx ${file.name}:`, err);
                        return `\n\n[Error reading content from ${file.name}]`;
                    }
                }
                const text = await file.text();
                return `\n\n--- Content from ${file.name} ---\n${text}\n--- End of ${file.name} ---`;
            }));
            finalMessage += fileContents.join('');
        }

        const otherFiles = pendingFiles.filter(f => !textFiles.includes(f));
        if (otherFiles.length > 0) {
            finalMessage += `\n\n[Attached Files: ${otherFiles.map(f => f.name).join(', ')}]`;
        }

        onSend(finalMessage);
        setMessage("");
        setPendingFiles([]);
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setMessage(val);

        // Check if slash menu should be open
        const cursorPosition = e.target.selectionStart;
        const textBeforeCursor = val.substring(0, cursorPosition);

        // Match a slash at the beginning of line or preceded by space, optionally followed by some text
        const match = textBeforeCursor.match(/(?:^|\n|\s)\/([^\s]*)$/);

        if (match) {
            setShowSlashMenu(true);
            setSlashQuery(match[1]);
            setSlashIndex(0);
        } else {
            setShowSlashMenu(false);
        }
    };

    const handleSelectSlashCommand = useCallback((cmd: SlashCommand) => {
        const cursorPosition = textareaRef.current?.selectionStart || 0;
        const textBeforeCursor = message.substring(0, cursorPosition);
        const textAfterCursor = message.substring(cursorPosition);

        const slashPos = textBeforeCursor.lastIndexOf('/');
        if (slashPos !== -1) {
            const newTextBefore = textBeforeCursor.substring(0, slashPos) + cmd.syntax;
            const newMsg = newTextBefore + textAfterCursor;
            setMessage(newMsg);

            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.focus();
                    const newPos = newTextBefore.length;
                    textareaRef.current.setSelectionRange(newPos, newPos);
                }
            }, 0);
        } else {
            setMessage(cmd.syntax + ' ');
        }
        setShowSlashMenu(false);
    }, [message]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (showSlashMenu) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSlashIndex(prev => (prev < filteredCommands.length - 1 ? prev + 1 : prev));
                return;
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                setSlashIndex(prev => (prev > 0 ? prev - 1 : prev));
                return;
            }
            if (e.key === "Enter" && !e.shiftKey && filteredCommands.length > 0) {
                e.preventDefault();
                handleSelectSlashCommand(filteredCommands[slashIndex]);
                return;
            }
            if (e.key === "Escape") {
                e.preventDefault();
                setShowSlashMenu(false);
                return;
            }
        }

        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const toggleVoice = useCallback(() => {
        const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognitionAPI) {
            alert("Seu navegador não suporta reconhecimento de voz.");
            return;
        }

        if (isListening && recognitionRef.current) {
            recognitionRef.current.stop();
            setIsListening(false);
            return;
        }

        const recognition = new SpeechRecognitionAPI();
        recognition.lang = "pt-BR";
        recognition.continuous = false;
        recognition.interimResults = true;

        recognition.onresult = (event: any) => {
            let transcript = "";
            for (let i = 0; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            setMessage(transcript);

            // Auto-send on final result
            if (event.results[event.results.length - 1].isFinal) {
                setTimeout(() => {
                    if (transcript.trim()) {
                        onSend(transcript.trim());
                        setMessage("");
                    }
                }, 500);
            }
        };

        recognition.onend = () => setIsListening(false);
        recognition.onerror = () => setIsListening(false);

        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
    }, [isListening, onSend]);

    return (
        <div className="w-full max-w-2xl mx-auto px-4 pb-6">
            <div className="relative">
                {showSlashMenu && (
                    <SlashCommandMenu
                        items={filteredCommands}
                        selectedIndex={slashIndex}
                        onHover={setSlashIndex}
                        onSelect={handleSelectSlashCommand}
                    />
                )}

                <div className={cn(
                    "bg-white/[0.04] backdrop-blur-xl border border-white/[0.1] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.1)] rounded-[24px] flex items-center gap-3 px-4 py-4 transition-all duration-300",
                    isListening && "border-primary/40 shadow-[0_0_24px_hsl(18_50%_50%/0.15)]"
                )}>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        multiple
                    />

                    {/* Add a flex-col layout to stack files above the input area */}
                    <div className="flex flex-col flex-1 w-full gap-2 relative">
                        {/* Pending Files Preview */}
                        {pendingFiles.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-1 pb-2">
                                {pendingFiles.map((file, idx) => (
                                    <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-xl border border-white/10 text-white/90 text-[13px] animate-in slide-in-from-bottom-2 fade-in">
                                        {file.type.startsWith('image/') ? (
                                            <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                                        ) : (
                                            <FileText className="w-3.5 h-3.5 text-purple-400" />
                                        )}
                                        <span className="max-w-[120px] truncate">{file.name}</span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                                            className="ml-1 p-0.5 rounded-full hover:bg-white/20 text-white/50 hover:text-white transition-colors"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex items-end gap-3 w-full">
                            <div className="relative flex-shrink-0" ref={attachmentMenuRef}>
                                <button
                                    onClick={handleAttachmentClick}
                                    className={cn(
                                        "p-2 sm:p-2.5 rounded-xl transition-all duration-200",
                                        showAttachmentMenu
                                            ? "bg-white/[0.12] text-white"
                                            : "text-white/40 hover:text-white hover:bg-white/[0.08]"
                                    )}
                                    aria-label="Anexar documento"
                                >
                                    <Plus className={cn("w-5 h-5 transition-transform duration-300", showAttachmentMenu && "rotate-45")} />
                                </button>

                                {/* Custom Attachment Menu (Frosted Deep Glass) */}
                                {showAttachmentMenu && (
                                    <div className="absolute bottom-[calc(100%+12px)] left-0 min-w-[280px] bg-[#1a1425]/90 backdrop-blur-2xl border border-white/[0.1] rounded-[24px] shadow-[0_16px_40px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.05)] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200 z-50">
                                        {menuView === 'main' ? (
                                            <div className="flex flex-col py-2">
                                                <button
                                                    onClick={() => handleMenuAction('files')}
                                                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.06] transition-colors group"
                                                >
                                                    <Paperclip className="w-4 h-4 text-white/50 group-hover:text-white/90" />
                                                    <span className="text-[14px] font-medium text-white/90 group-hover:text-white">Adicionar arquivos ou fotos</span>
                                                </button>

                                                <div className="h-[1px] w-full bg-white/[0.06] my-1" />

                                                <button
                                                    onClick={() => handleMenuAction('research')}
                                                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.06] transition-colors group"
                                                >
                                                    <Globe className="w-4 h-4 text-[#4b9fd1] group-hover:text-[#67b7e8]" />
                                                    <span className="text-[14px] font-medium text-[#4b9fd1] group-hover:text-[#67b7e8]">Pesquisa na Web</span>
                                                </button>
                                                <button
                                                    onClick={() => handleMenuAction('style')}
                                                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.06] transition-colors group"
                                                >
                                                    <Wand2 className="w-4 h-4 text-white/50 group-hover:text-white/90" />
                                                    <span className="text-[14px] font-medium text-white/90 group-hover:text-white">Usar estilo</span>
                                                </button>
                                                <button
                                                    onClick={() => handleMenuAction('connectors')}
                                                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.06] transition-colors group"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Blocks className="w-4 h-4 text-white/50 group-hover:text-white/90" />
                                                        <span className="text-[14px] font-medium text-white/90 group-hover:text-white">Conectores</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        {Object.values(activeConnectors).filter(Boolean).length > 0 && (
                                                            <span className="w-5 h-5 rounded-full bg-white/10 text-[10px] font-bold text-white flex items-center justify-center">
                                                                {Object.values(activeConnectors).filter(Boolean).length}
                                                            </span>
                                                        )}
                                                        <ChevronLeft className="w-4 h-4 text-white/30 rotate-180 group-hover:text-white/60 transition-transform" />
                                                    </div>
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col animate-in slide-in-from-right-2 duration-300">
                                                <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]">
                                                    <button
                                                        onClick={() => setMenuView('main')}
                                                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                                                    >
                                                        <ChevronLeft className="w-4 h-4" />
                                                    </button>
                                                    <span className="text-[13px] font-semibold text-white/80 uppercase tracking-widest px-1">Conectores</span>
                                                </div>

                                                <div className="flex flex-col py-1.5 px-1">
                                                    {[
                                                        { id: 'google', name: 'Google Drive', logo: '/integrations/drive.png' },
                                                        { id: 'clickup', name: 'ClickUp Tasks', logo: '/integrations/clickup.png' },
                                                        { id: 'notion', name: 'Notion Knowledge', logo: '/integrations/notion.png' }
                                                    ].map((conn) => (
                                                        <div key={conn.id} className="flex flex-col">
                                                            <button
                                                                onClick={(e) => toggleConnector(conn.id, e)}
                                                                className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-white/[0.06] rounded-xl transition-colors group"
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-6 h-6 rounded-md bg-white/[0.05] p-1 flex items-center justify-center">
                                                                        <img src={conn.logo} alt={conn.name} className="w-full h-full object-contain" />
                                                                    </div>
                                                                    <span className="text-[14px] font-medium text-white/90 group-hover:text-white">{conn.name}</span>
                                                                </div>
                                                                <div className={cn(
                                                                    "w-7 h-4 rounded-full relative transition-colors duration-300 border border-white/[0.1]",
                                                                    activeConnectors[conn.id] ? "bg-white/20" : "bg-white/5"
                                                                )}>
                                                                    <div className={cn(
                                                                        "absolute top-0.5 w-3 h-3 rounded-full transition-all duration-300 shadow-sm",
                                                                        activeConnectors[conn.id]
                                                                            ? "right-0.5 bg-white scale-110"
                                                                            : "left-0.5 bg-white/20"
                                                                    )} />
                                                                </div>
                                                            </button>

                                                            {conn.id === 'google' && activeConnectors.google && (
                                                                <div className="flex flex-col gap-1 px-3 pb-3 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                                                    <div className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-1 px-1">Arquivos Recentes</div>
                                                                    {isLoadingDocs ? (
                                                                        <div className="flex items-center justify-center p-2">
                                                                            <Loader2 className="w-4 h-4 text-white/20 animate-spin" />
                                                                        </div>
                                                                    ) : recentDocs.length > 0 ? (
                                                                        recentDocs.map((doc: any) => (
                                                                            <a
                                                                                key={doc.id}
                                                                                href={doc.webViewLink}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-white/[0.08] transition-all group"
                                                                            >
                                                                                <FileText className="w-3.5 h-3.5 text-white/40 group-hover:text-blue-400" />
                                                                                <span className="text-[12px] text-white/60 group-hover:text-white/90 truncate max-w-[180px]">{doc.name}</span>
                                                                            </a>
                                                                        ))
                                                                    ) : (
                                                                        <div className="text-[11px] text-white/20 px-1 italic">Nenhum doc encontrado</div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>

                                                <button
                                                    onClick={() => handleMenuAction('open-hub')}
                                                    className="mt-1 m-2 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] text-[12px] font-medium text-white/50 hover:text-white text-center transition-all duration-200"
                                                >
                                                    Gerenciar Hub completo
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <textarea
                                ref={textareaRef}
                                value={message}
                                onChange={handleChange}
                                onKeyDown={handleKeyDown}
                                placeholder={isListening ? "Ouvindo..." : "Converse com ARIA..."}
                                rows={1}
                                disabled={disabled}
                                className="flex-1 bg-transparent resize-none outline-none text-white/90 placeholder:text-white/40 text-[16px] leading-[1.6] scrollbar-hidden min-h-[28px] py-0.5"
                            />
                            <div className="flex items-center gap-1 mb-0.5">
                                <button
                                    onClick={toggleVoice}
                                    className={cn(
                                        "p-2.5 rounded-xl transition-all duration-200",
                                        isListening
                                            ? "bg-primary/20 text-primary animate-pulse"
                                            : "text-white/40 hover:text-white/80"
                                    )}
                                    aria-label="Microfone"
                                >
                                    {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={(!message.trim() && pendingFiles.length === 0) || disabled}
                                    className="p-3 rounded-xl bg-white/[0.05] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] hover:bg-white/[0.1] text-white/70 hover:text-white disabled:opacity-30 disabled:hover:bg-white/[0.05] transition-all duration-200"
                                    aria-label="Enviar"
                                >
                                    <Send className="w-4 h-4 ml-0.5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatInput;
