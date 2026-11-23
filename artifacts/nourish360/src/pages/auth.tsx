import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { ArrowLeft, Info, Loader2, MessageSquare, PhoneCall } from 'lucide-react';
import {
  useGetCatalog, useRegisterPatient, useSendOtp, useVerifyOtp,
  type Challenge, type ClinicalProfile, type PatientType, type RegistrationInputChannel,
} from '@workspace/api-client-react';
import { errorMessage, useApp, ROLE_META, slugToRole } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { DemoBar } from '@/components/demo-bar';
import NotFound from '@/pages/not-found';
import { cn } from '@/lib/utils';

const field = 'w-full rounded-xl border bg-background px-3.5 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';
const PHONE_RE = /^(?:\+91)?00000\d{5}$/;
const SAMPLE: Record<PatientType, { name: string; profile: ClinicalProfile; guardian?: string }> = {
  CHILD: { name: 'Demo Child Kavya', guardian: 'Demo Guardian Sunita', profile: { dob_months: 14, birth_weight_kg: 2.6, last_weight_kg: 8.4 } },
  PREGNANT_LADY: { name: 'Demo Mother Rekha', profile: { age: 24, gestational_weeks: 26, blood_group: 'B+', gravida: 2 } },
  MOTHER: { name: 'Demo Mother Pooja', profile: { age: 27, days_postpartum: 9, delivery_type: 'Normal', blood_group: 'O+' } },
};

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>{children}</label>;
}

function Channel({ value, onChange }: { value: RegistrationInputChannel; onChange: (c: RegistrationInputChannel) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(['sms', 'call'] as const).map((c) => (
        <button type="button" key={c} onClick={() => onChange(c)} data-testid={`button-channel-${c}`}
          className={cn('press flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm', value === c ? 'border-primary bg-primary/10 font-semibold text-primary' : 'hover:bg-muted')}>
          {c === 'sms' ? <MessageSquare className="h-4 w-4" /> : <PhoneCall className="h-4 w-4" />}{c === 'sms' ? 'Verify via SMS' : 'Verify via voice call'}
        </button>
      ))}
    </div>
  );
}

export default function Auth() {
  const params = useParams<{ role: string }>();
  const role = slugToRole(params.role);
  if (!role) return <NotFound />;
  return <AuthInner key={role} role={role} />;
}

function AuthInner({ role }: { role: PatientType }) {
  const { setRole, adoptRecord, online } = useApp();
  const {toast} = useToast();
  const [, navigate] = useLocation();
  const catalog = useGetCatalog();
  const register = useRegisterPatient();
  const sendOtp = useSendOtp();
  const verify = useVerifyOtp();
  const [tab, setTab] = useState<'new' | 'login'>('new');
  const [channel, setChannel] = useState<RegistrationInputChannel>('sms');
  const s = SAMPLE[role];
  const [name, setName] = useState(s.name);
  const [phone, setPhone] = useState('0000000000');
  const [village, setVillage] = useState('');
  const [guardian, setGuardian] = useState(s.guardian ?? '');
  const [guardianConsent, setGuardianConsent] = useState(false);
  const [consent, setConsent] = useState(false);
  const [profile, setProfile] = useState<ClinicalProfile>(s.profile);
  const [hid, setHid] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => { setRole(role); }, [role, setRole]);
  useEffect(() => { if (!village && catalog.data?.villages[0]) setVillage(catalog.data.villages[0].name); }, [catalog.data, village]);

  const num = (k: keyof ClinicalProfile) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setProfile((p) => ({ ...p, [k]: e.target.value === '' ? undefined : Number(e.target.value) }));
  const str = (k: keyof ClinicalProfile) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setProfile((p) => ({ ...p, [k]: e.target.value || undefined }));

  const phoneOk = PHONE_RE.test(phone);
  const canRegister = name.trim().length >= 2 && phoneOk && village && consent && (role !== 'CHILD' || (guardian.trim().length >= 2 && guardianConsent));

  const doRegister = (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    if (!canRegister) return;
    register.mutate({ data: { patient_type: role, full_name: name.trim(), phone_number: phone, village, consent, channel, profile, ...(role === 'CHILD' ? { guardian_name: guardian.trim(), guardian_consent: guardianConsent } : {}) } }, {
      onSuccess: (c) => { setChallenge(c); setCode(''); toast({title:'Saved to Database',description:'Demo profile created. Verify your code to open it.'}); },
      onError: (e) => setErr(errorMessage(e,'Registration could not be confirmed. Reconnect and try again.')),
    });
  };
  const doLogin = (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    sendOtp.mutate({ data: { health_id: hid.trim().toUpperCase(), phone_number: loginPhone, channel } }, {
      onSuccess: (c) => { setChallenge(c); setCode(''); },
      onError: (e) => setErr(errorMessage(e,'Could not request a demo code. Try again once online.')),
    });
  };
  const doVerify = (e: React.FormEvent) => {
    e.preventDefault(); if (!challenge) return; setErr('');
    verify.mutate({ data: { health_id: challenge.health_id, challenge_id: challenge.challenge_id, code } }, {
      onSuccess: async (rec) => { await adoptRecord(rec); navigate(rec.visits.length ? '/results' : '/assess'); },
      onError: (e) => setErr(errorMessage(e,'Verification did not finish. Request a fresh demo code if needed.')),
    });
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-[1fr_1.3fr]">
      <aside className="rise">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" data-testid="link-back"><ArrowLeft className="h-4 w-4" /> All roles</Link>
        <p className="font-display mt-6 text-6xl text-primary/25">{ROLE_META[role].hindi}</p>
        <h1 className="font-display text-4xl font-semibold">{ROLE_META[role].label}</h1>
        <p className="mt-2 text-foreground/70">{ROLE_META[role].sub}</p>
        <div className="mt-6 flex gap-3 rounded-2xl border border-[hsl(var(--tier-amber)/.5)] bg-[hsl(var(--secondary)/.18)] p-4 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Do not enter real names, numbers or health details. Only reserved demo numbers <span className="font-mono">0000000000–0000009999</span> are accepted.</p>
        </div>
        <div className="mt-6"><DemoBar /></div>
      </aside>

      <section className="rise rounded-[2rem] border bg-card p-5 shadow-[0_20px_50px_-30px_hsl(312_52%_30%/.4)] md:p-7" style={{ animationDelay: '.1s' }}>
        {challenge ? (
          <form key="verify" onSubmit={doVerify} className="space-y-5">
            <h2 className="font-display text-2xl font-semibold">Enter the 6-digit code</h2>
            <div className="rounded-2xl bg-primary p-4 text-primary-foreground">
              <p className="font-mono text-xs opacity-75">Health ID</p>
              <p className="font-mono text-2xl tracking-wider" data-testid="text-health-id">{challenge.health_id}</p>
            </div>
            {challenge.demo_code && (
              <button type="button" onClick={() => setCode(challenge.demo_code!)} data-testid="button-use-demo-code" className="press w-full rounded-xl border border-dashed p-3 text-left text-sm hover:bg-muted">
                Demo helper: code is <span className="font-mono font-semibold">{challenge.demo_code}</span>. Tap to fill.
              </button>
            )}
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="______" data-testid="input-otp"
              className={cn(field, 'text-center font-mono text-3xl tracking-[.5em]')} />
            {err && <p className="text-sm text-[hsl(var(--tier-red))]">{err}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setChallenge(null)} className="press rounded-xl border px-4" data-testid="button-otp-back">Back</button>
              <button disabled={code.length !== 6 || verify.isPending || !online} data-testid="button-verify" className="press flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-40">
                {verify.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Verify and continue
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-2 rounded-2xl bg-muted p-1">
              {(['new', 'login'] as const).map((t) => (
                <button key={t} type="button" aria-pressed={tab===t} onClick={() => { setTab(t); setErr(''); }} data-testid={`tab-${t}`}
                  className={cn('rounded-xl py-2.5 text-sm font-medium transition', tab === t ? 'bg-card shadow-sm' : 'text-muted-foreground')}>
                  {t === 'new' ? 'New registration' : 'Returning user'}
                </button>
              ))}
            </div>
            {tab === 'new' ? (
              <form key="registration" onSubmit={doRegister} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <L label="Synthetic alias"><input className={field} value={name} onChange={(e) => setName(e.target.value)} data-testid="input-name" /></L>
                  <L label="Demo mobile (reserved)"><input className={cn(field, 'font-mono', !phoneOk && 'border-[hsl(var(--tier-red))]')} value={phone} onChange={(e) => setPhone(e.target.value.trim())} data-testid="input-phone" /></L>
                </div>
                <L label="Village / block (demo preset)">
                  <select className={field} value={village} onChange={(e) => setVillage(e.target.value)} data-testid="select-village">
                    {(catalog.data?.villages ?? []).map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
                  </select>
                </L>
                <div className="grid gap-3 sm:grid-cols-2">
                  {role === 'CHILD' && <>
                    <L label="Age (months)"><input type="number" className={field} value={profile.dob_months ?? ''} onChange={num('dob_months')} data-testid="input-dob-months" /></L>
                    <L label="Birth weight (kg)"><input type="number" step="0.1" className={field} value={profile.birth_weight_kg ?? ''} onChange={num('birth_weight_kg')} data-testid="input-birth-weight" /></L>
                    <L label="Last recorded weight (kg)"><input type="number" step="0.1" className={field} value={profile.last_weight_kg ?? ''} onChange={num('last_weight_kg')} data-testid="input-last-weight" /></L>
                  </>}
                  {role !== 'CHILD' && <L label="Age"><input type="number" className={field} value={profile.age ?? ''} onChange={num('age')} data-testid="input-age" /></L>}
                  {role === 'PREGNANT_LADY' && <>
                    <L label="Gestational weeks (or enter LMP)"><input type="number" min="1" max="45" className={field} value={profile.gestational_weeks ?? ''} onChange={num('gestational_weeks')} data-testid="input-gest-weeks" /></L>
                    <L label="Last menstrual period (optional)"><input type="date" max={new Date().toISOString().slice(0,10)} className={field} value={profile.lmp_date ?? ''} onChange={str('lmp_date')} data-testid="input-lmp" /></L>
                    <L label="Gravida (pregnancy count)"><input type="number" className={field} value={profile.gravida ?? ''} onChange={num('gravida')} data-testid="input-gravida" /></L>
                  </>}
                  {role === 'MOTHER' && <>
                    <L label="Days since delivery"><input type="number" className={field} value={profile.days_postpartum ?? ''} onChange={num('days_postpartum')} data-testid="input-days-pp" /></L>
                    <L label="Delivery type">
                      <select className={field} value={profile.delivery_type ?? 'Normal'} onChange={str('delivery_type')} data-testid="select-delivery-type">
                        <option value="Normal">Normal</option><option value="C-Section">C-Section</option>
                      </select>
                    </L>
                  </>}
                  {role !== 'CHILD' && <L label="Blood group">
                    <select className={field} value={profile.blood_group ?? ''} onChange={str('blood_group')} data-testid="select-blood-group">
                      <option value="">Unknown</option>{['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((b) => <option key={b}>{b}</option>)}
                    </select>
                  </L>}
                </div>
                {role === 'CHILD' && (
                  <div className="space-y-3 rounded-2xl border p-4">
                    <L label="Guardian alias"><input className={field} value={guardian} onChange={(e) => setGuardian(e.target.value)} data-testid="input-guardian" /></L>
                    <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={guardianConsent} onChange={(e) => setGuardianConsent(e.target.checked)} className="mt-1 accent-[hsl(var(--primary))]" data-testid="checkbox-guardian-consent" />Guardian consents on the child's behalf.</label>
                  </div>
                )}
                <label className="flex items-start gap-2 rounded-2xl bg-muted/60 p-4 text-sm">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 accent-[hsl(var(--primary))]" data-testid="checkbox-consent" />
                  <span>I consent (DPDP Act 2023) to processing of this <b>synthetic</b> profile for demo triage and referral simulation. I can export or erase it anytime.</span>
                </label>
                <Channel value={channel} onChange={setChannel} />
                {err && <p className="text-sm text-[hsl(var(--tier-red))]">{err}</p>}
                <button disabled={!canRegister || register.isPending || !online} data-testid="button-register" className="press flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 font-semibold text-primary-foreground disabled:opacity-40">
                  {register.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{online ? 'Generate Health ID' : 'Registration needs a connection'}
                </button>
              </form>
            ) : (
              <form key="returning" onSubmit={doLogin} className="space-y-4">
                <L label="Nourish360 Health ID"><input className={cn(field, 'font-mono uppercase')} placeholder="N360-SNP-1001" value={hid} onChange={(e) => setHid(e.target.value)} data-testid="input-health-id" /></L>
                <L label="Demo mobile"><input className={cn(field, 'font-mono')} placeholder="0000000001" value={loginPhone} onChange={(e) => setLoginPhone(e.target.value.trim())} data-testid="input-login-phone" /></L>
                <p className="font-mono text-[11px] text-muted-foreground">Templates: 1001 / 0000000001 · 1002 / 0000000002 · 1003 / 0000000003</p>
                <Channel value={channel} onChange={setChannel} />
                {err && <p className="text-sm text-[hsl(var(--tier-red))]">{err}</p>}
                <button disabled={!/^N360-SNP-[A-Z0-9]{4,8}$/i.test(hid.trim()) || !loginPhone || sendOtp.isPending || !online} data-testid="button-send-otp" className="press flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 font-semibold text-primary-foreground disabled:opacity-40">
                  {sendOtp.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Send code
                </button>
              </form>
            )}
          </>
        )}
      </section>
    </div>
  );
}
