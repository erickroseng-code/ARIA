'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function Header() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <header className="glass-panel m-4 p-4 rounded-2xl flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold">A</span>
        </div>
        <h1 className="text-xl font-bold text-gradient">ARIA</h1>
      </div>

      <button
        onClick={handleLogout}
        className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white"
        title="Logout"
      >
        <LogOut size={20} />
      </button>
    </header>
  );
}
