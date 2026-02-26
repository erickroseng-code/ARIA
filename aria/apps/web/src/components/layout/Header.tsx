'use client';

export function Header() {
  return (
    <header className="glass-panel m-4 p-4 rounded-2xl flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold">A</span>
        </div>
        <h1 className="text-xl font-bold text-gradient">ARIA</h1>
      </div>
    </header>
  );
}
