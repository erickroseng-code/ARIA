import { Header } from '@/components/layout/Header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#050508]">
      <Header />
      <main className="p-4">
        {children}
      </main>
    </div>
  );
}
