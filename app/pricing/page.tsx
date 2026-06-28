import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing — Business Engine',
  description: 'Plans for creators and agencies turning tutorials into production systems.',
};

const plans = [
  {
    name: 'Starter',
    price: 'Free',
    period: '',
    description: 'Try the full pipeline on your own tutorials.',
    features: ['5 ingests / month', 'Skill extraction', 'DAG builder', 'Artifact preview'],
    cta: 'Open Studio',
    href: '/studio',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/mo',
    description: 'For solo creators shipping systems weekly.',
    features: [
      'Unlimited ingests',
      'Claude-powered extraction',
      'Full artifact export',
      'Marketing asset generation',
      'Redis-backed knowledge graph',
    ],
    cta: 'Get Pro',
    href: 'https://connectkk.gumroad.com',
    highlighted: true,
  },
  {
    name: 'Agency',
    price: '$99',
    period: '/mo',
    description: 'Teams productizing client tutorials at scale.',
    features: [
      'Everything in Pro',
      'Priority API limits',
      'White-label artifacts',
      'Dedicated support',
      'Custom integrations',
    ],
    cta: 'Contact sales',
    href: 'mailto:connectkk11@gmail.com?subject=Business%20Engine%20Agency',
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center font-bold">
              BE
            </div>
            <span className="font-semibold">Business Engine</span>
          </Link>
          <Link href="/studio" className="btn btn-primary text-sm py-2 px-4">Studio</Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-14">
          <h1 className="text-4xl font-bold">Simple pricing</h1>
          <p className="mt-4 text-gray-400 max-w-lg mx-auto">
            Start free. Upgrade when you are selling systems built from tutorials, not just watching them.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`card flex flex-col ${
                plan.highlighted ? 'border-blue-500/50 ring-1 ring-blue-500/30' : ''
              }`}
            >
              {plan.highlighted && (
                <span className="badge badge-blue self-start mb-4">Most popular</span>
              )}
              <h2 className="text-xl font-bold">{plan.name}</h2>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold">{plan.price}</span>
                {plan.period && <span className="text-gray-500">{plan.period}</span>}
              </div>
              <p className="mt-3 text-sm text-gray-400">{plan.description}</p>
              <ul className="mt-6 space-y-3 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2 text-sm text-gray-300">
                    <span className="text-emerald-400">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`mt-8 btn w-full text-center ${
                  plan.highlighted ? 'btn-primary' : 'btn-secondary'
                }`}
                {...(plan.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}