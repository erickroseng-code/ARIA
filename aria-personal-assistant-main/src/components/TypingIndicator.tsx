const TypingIndicator = () => {
  return (
    <div className="flex w-full mb-4 justify-start">
      <div className="glass rounded-2xl rounded-bl-md px-4 py-3">
        <span className="text-xs font-medium text-primary block mb-2 tracking-wide">ARIA</span>
        <div className="flex items-center gap-1.5 h-5">
          <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms", animationDuration: "1s" }} />
          <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms", animationDuration: "1s" }} />
          <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms", animationDuration: "1s" }} />
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
