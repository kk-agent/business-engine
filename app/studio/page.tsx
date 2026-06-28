import dynamic from 'next/dynamic';

const StudioDashboard = dynamic(() => import('@/components/studio/Dashboard'), {
  loading: () => (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="animate-pulse text-gray-400">Loading studio…</div>
    </div>
  ),
});

export default function StudioPage() {
  return <StudioDashboard />;
}