import Link from 'next/link';

const steps = [
  { n: '01', title: 'Ingest', desc: 'Paste a YouTube tutorial URL. We extract structured summary points automatically.' },
  { n: '02', title: 'Extract skills', desc: 'Claude turns the transcript into executable skills with dependencies and tags.' },
  { n: '03', title: 'Build DAG', desc: 'Skills compile into a dependency graph — your blueprint for production.' },
  { n: '04', title: 'Ship', desc: 'Generate Dockerfiles, CI, scripts, marketing copy, and run the pipeline.' },
];

const outcomes = [
  'Deploy-ready artifacts in minutes',
  'Marketing assets for X, LinkedIn, and more',
  'Knowledge graph you can query and reuse',
  'Full pipeline execution with dry-run mode',
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center font-bold">
              BE
            </div>
            <span className="font-semibold tracking-tight">Business Engine</span>
          </div>
          <nav className="flex items-center gap-6 text-sm text-gray-400">
            <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
            <Link href="/studio" className="btn btn-primary text-sm py-2 px-4">Open Studio</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="max-w-6xl mx-auto px-6 pt-20 pb-16">
          <p className="text-emerald-400 text-sm font-medium mb-4 tracking-wide uppercase">
            YouTube → Production in one session
          </p>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight max-w-3xl">
            Turn any tutorial into a{' '}
            <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              deployable business system
            </span>
          </h1>
          <p className="mt-6 text-lg text-gray-400 max-w-2xl leading-relaxed">
            Business Engine ingests video content, extracts skills, builds dependency graphs,
            generates deployment artifacts, and produces marketing assets — so you sell systems, not slides.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/studio" className="btn btn-primary text-base px-8 py-3">
              Start free in Studio
            </Link>
            <Link href="/pricing" className="btn btn-secondary text-base px-8 py-3">
              View plans
            </Link>
          </div>
        </section>

        <section className="border-y border-white/10 bg-[#111111]">
          <div className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step) => (
              <div key={step.n}>
                <span className="text-3xl font-bold text-white/20">{step.n}</span>
                <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-gray-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold mb-8">What you get</h2>
          <ul className="grid md:grid-cols-2 gap-4">
            {outcomes.map((item) => (
              <li key={item} className="flex items-start gap-3 card">
                <span className="text-emerald-400 mt-0.5">✓</span>
                <span className="text-gray-300">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="max-w-6xl mx-auto px-6 pb-24">
          <div className="card bg-gradient-to-br from-blue-950/40 to-emerald-950/30 border-blue-500/20 text-center py-14 px-8">
            <h2 className="text-2xl md:text-3xl font-bold">Ready to productize your next tutorial?</h2>
            <p className="mt-3 text-gray-400 max-w-xl mx-auto">
              Open Studio, paste a URL, and walk away with artifacts you can ship or sell.
            </p>
            <Link href="/studio" className="btn btn-primary mt-8 inline-flex text-base px-10 py-3">
              Launch Studio →
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 py-8 text-center text-sm text-gray-500">
        Business Engine · Built on Next.js 16 & Vercel
      </footer>
    </div>
  );
}