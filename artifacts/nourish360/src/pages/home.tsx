import { Link } from 'wouter';
import { ArrowRight, Baby, HeartHandshake, Siren, Sprout } from 'lucide-react';
import type { PatientType } from '@workspace/api-client-react';
import { useApp, ROLE_META } from '@/lib/store';
import { DemoBar } from '@/components/demo-bar';
import { Call108 } from '@/components/shell';

const ICONS: Record<PatientType, typeof Baby> = { CHILD: Baby, PREGNANT_LADY: Sprout, MOTHER: HeartHandshake };
const TINTS: Record<PatientType, string> = {
  CHILD: 'from-[hsl(168_38%_86%)] to-card',
  PREGNANT_LADY: 'from-[hsl(42_86%_84%)] to-card',
  MOTHER: 'from-[hsl(312_40%_90%)] to-card',
};

export default function Home() {
  const { record, openEmergency } = useApp();
  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="grid gap-8 py-10 md:grid-cols-[1.2fr_1fr] md:py-16">
        <div className="rise">
          <p className="font-mono text-xs uppercase tracking-[.22em] text-muted-foreground">Ganaur · Murthal · Kharkhoda · Rai</p>
          <h1 className="font-display mt-3 text-5xl font-semibold leading-[1.02] text-primary md:text-7xl">
            Every visit,<br />remembered.
          </h1>
          <p className="mt-5 max-w-md text-lg text-foreground/75">
            A practice workflow for ASHA-style check-ups across Sonipat villages. Open a demo profile online, then record assessments offline and sync when your connection returns.
          </p>
          {record && (
            <Link href="/results" data-testid="link-continue" className="press mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground">
              Continue with {record.patient.full_name} <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
        <div className="rise phulkari relative overflow-hidden rounded-[2rem] border-2 border-[hsl(var(--tier-red)/.35)] bg-card p-6" style={{ animationDelay: '.12s' }}>
          <p className="font-mono text-[11px] uppercase tracking-widest text-[hsl(var(--tier-red))]">Emergency first</p>
          <p className="font-display mt-2 text-3xl font-semibold">Bleeding, fits, can't breathe?</p>
          <p className="mt-2 text-sm text-muted-foreground">Don't use this app. Call the state ambulance line now.</p>
          <Call108 className="mt-5 w-full justify-center py-4 text-lg" />
          <button onClick={() => openEmergency()} data-testid="button-hero-drill" className="press mt-3 flex w-full items-center justify-center gap-2 rounded-full border py-3 text-sm font-medium hover:bg-muted">
            <Siren className="h-4 w-4" /> Practise the ambulance drill (simulation)
          </button>
        </div>
      </section>

      <section>
        <p className="mb-4 font-mono text-xs uppercase tracking-[.2em] text-muted-foreground">Who are we checking today?</p>
        <div className="grid gap-4 md:grid-cols-[1.15fr_1fr_1fr]">
          {(Object.keys(ROLE_META) as PatientType[]).map((r, i) => {
            const Icon = ICONS[r];
            return (
              <Link key={r} href={`/start/${ROLE_META[r].slug}`} data-testid={`card-role-${r}`}
                className={`rise press group relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-[1.75rem] border bg-gradient-to-br ${TINTS[r]} p-6 transition-transform hover:-translate-y-1`}
                style={{ animationDelay: `${0.2 + i * 0.08}s` }}>
                <Icon className="h-9 w-9 text-primary" strokeWidth={1.6} />
                <div>
                  <span className="font-display text-4xl text-primary/30">{ROLE_META[r].hindi}</span>
                  <h2 className="font-display text-3xl font-semibold">{ROLE_META[r].label}</h2>
                  <p className="mt-1 text-sm text-foreground/70">{ROLE_META[r].sub}</p>
                </div>
                <ArrowRight className="absolute right-6 top-6 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-8"><DemoBar /></section>
    </div>
  );
}
