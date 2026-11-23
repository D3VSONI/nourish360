import { Link } from 'wouter';
import { ArrowRight, Siren, TriangleAlert } from 'lucide-react';
import type { PatientType } from '@workspace/api-client-react';
import { useApp, ROLE_META } from '@/lib/store';
import { useLang, roleLabel } from '@/lib/i18n';
import { DemoBar } from '@/components/demo-bar';
import { ActiveDrills } from '@/components/active-drills';
import { Call108 } from '@/components/shell';
import { RoleArt } from '@/components/role-art';

const ACCENT: Record<PatientType, string> = {
  CHILD: 'hsl(var(--primary))',
  PREGNANT_LADY: 'hsl(var(--tier-amber))',
  MOTHER: 'hsl(var(--tier-green))',
};
const subtitles:Record<PatientType,readonly [string,string]>={CHILD:['Ages 0–5 · Growth & fever','0–5 साल · बढ़त और बुखार'],PREGNANT_LADY:['Pregnancy & blood pressure','गर्भ और बीपी'],MOTHER:['After-delivery care','प्रसव के बाद की देखभाल']};

export default function Home() {
  const { record, openEmergency } = useApp();
  const { lang, tr } = useLang();
  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="rise pt-8 md:pt-12">
        <p className="text-sm font-bold uppercase tracking-[.14em] text-primary">{tr('Ganaur · Murthal · Kharkhoda · Rai', 'गन्नौर · मुरथल · खरखौदा · राई')}</p>
        <h1 className="mt-3 text-[2rem] font-extrabold leading-tight text-foreground md:text-5xl" data-testid="text-home-title">
          {tr('Who needs a health check today?', 'आज किसकी जांच करनी है?')}
        </h1>
        {lang === 'en' && <p lang="hi" className="mt-1 text-xl font-semibold text-primary md:text-2xl">आज किसकी जांच करनी है?</p>}
        {record && (
          <Link href="/results" data-testid="link-continue" className="tap tap-primary mt-6 w-full sm:w-auto">
            {tr(`Continue with ${record.patient.full_name}`, `${record.patient.full_name} के साथ जारी रखें`)} <ArrowRight className="h-5 w-5" />
          </Link>
        )}
      </section>

      <section className="mt-8 grid gap-5 md:grid-cols-3" aria-label={tr('Choose who to check', 'किसकी जांच, चुनें')}>
        {(Object.keys(ROLE_META) as PatientType[]).map((r, i) => (
          <Link
            key={r}
            href={`/start/${ROLE_META[r].slug}`}
            data-testid={`card-role-${r}`}
            className="rise press panel group flex items-center gap-4 border-foreground/80 transition-transform hover:-translate-y-0.5 md:flex-col md:items-start md:gap-5 md:p-6"
            style={{ animationDelay: `${0.08 + i * 0.07}s`, borderTop: `8px solid ${ACCENT[r]}` }}
          >
            <RoleArt role={r} className="h-20 w-20 shrink-0 md:h-28 md:w-28" />
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-extrabold leading-tight">{roleLabel(r, lang)}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{tr(...subtitles[r])}</p>
            </div>
            <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full border-2 border-foreground/80 bg-primary text-primary-foreground transition-transform group-hover:translate-x-1 md:self-end">
              <ArrowRight className="h-6 w-6" />
            </span>
          </Link>
        ))}
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        <div className="zone zone-red p-5" data-testid="panel-real-emergency">
          <p className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-[hsl(0_74%_38%)]">
            <TriangleAlert className="h-5 w-5" /> {tr('Real emergency', 'असली आपातकाल')}
          </p>
          <p className="mt-2 text-xl font-bold">{tr("Bleeding, fits, can't breathe?", 'खून बहना, दौरे, सांस न आना?')}</p>
          <p className="mt-1 text-muted-foreground">{tr('Do not use this app. Call the ambulance line now.', 'ऐप मत चलाइए। अभी एम्बुलेंस बुलाइए।')}</p>
          <Call108 className="mt-4 w-full text-lg" testId="link-call-108-home" />
        </div>
        <div className="panel border-dashed" data-testid="panel-drill">
          <p className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">{tr('Practice only', 'सिर्फ़ अभ्यास')}</p>
          <p className="mt-2 text-xl font-bold">{tr('Ambulance drill (simulation)', 'एम्बुलेंस ड्रिल (नकली)')}</p>
          <p className="mt-1 text-muted-foreground">{tr('Rehearse the steps. No real ambulance is sent.', 'कदमों का अभ्यास करें। कोई असली एम्बुलेंस नहीं आएगी।')}</p>
          <button onClick={() => openEmergency()} data-testid="button-hero-drill" className="tap mt-4 w-full">
            <Siren className="h-5 w-5" /> {tr('Start practice drill', 'अभ्यास ड्रिल शुरू करें')}
          </button>
        </div>
      </section>

      <div className="mt-8"><ActiveDrills /></div>
      <section className="mt-8"><DemoBar /></section>
    </div>
  );
}
