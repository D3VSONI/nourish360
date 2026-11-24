import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Clock3, FilePlus2, Loader2, RotateCw } from 'lucide-react';
import {
  getListEscalationTicketsQueryKey,
  useCreateEscalationTicket,
  useGetCatalog,
  useListEscalationTickets,
  useStartDemo,
  type EscalationAuthority,
  type RiskTier,
} from '@workspace/api-client-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useApp } from '@/lib/store';
import { dateLabel, roleLabel, useLang, villageName } from '@/lib/i18n';

export const TIER_STYLE: Record<RiskTier, string> = {
  GREEN: 'bg-[#16A34A]',
  AMBER: 'bg-[#D97706]',
  RED: 'bg-[#DC2626]',
};

const authorities: { value: EscalationAuthority; label: readonly [string, string] }[] = [
  { value: 'PHC_MEDICAL_OFFICER', label: ['PHC Medical Officer', 'प्राथमिक स्वास्थ्य अधिकारी'] },
  { value: 'CHC_MEDICAL_OFFICER', label: ['CHC Medical Officer', 'सामुदायिक स्वास्थ्य अधिकारी'] },
  { value: 'DISTRICT_MEDICAL_OFFICER', label: ['District Medical Officer', 'ज़िला चिकित्सा अधिकारी'] },
];

function authorityLabel(authority: EscalationAuthority, lang: 'en' | 'hi') {
  return authorities.find(item => item.value === authority)?.label[lang === 'hi' ? 1 : 0] ?? authority;
}

export function PatientAttentionPanel() {
  const { online, adoptRecord } = useApp();
  const { lang, tr } = useLang();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const catalog = useGetCatalog({ query: { enabled: online } });
  const tickets = useListEscalationTickets({ query: { enabled: online } });
  const start = useStartDemo();
  const createTicket = useCreateEscalationTicket();
  const [raiseFor, setRaiseFor] = useState<string | null>(null);
  const [authority, setAuthority] = useState<EscalationAuthority>('PHC_MEDICAL_OFFICER');

  const attentionCases = (catalog.data?.demo_cases ?? []).filter(
    patient => patient.risk_tier === 'AMBER' || patient.risk_tier === 'RED',
  );
  const pendingTicket = createTicket.isPending;

  const openPatient = (healthId: string) => {
    start.mutate({ data: { health_id: healthId } }, {
      onSuccess: async record => {
        await adoptRecord(record);
        navigate(record.visits.length ? '/results' : '/assess');
      },
      onError: () => toast({ title: tr('Patient record could not open.', 'मरीज़ का रिकॉर्ड नहीं खुला।') }),
    });
  };

  const raise = (healthId: string) => {
    createTicket.mutate({ data: { health_id: healthId, authority } }, {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getListEscalationTicketsQueryKey() });
        setRaiseFor(null);
        toast({
          title: tr('Ticket saved for tracking.', 'टिकट ट्रैकिंग के लिए सहेजा गया।'),
          description: tr('No notification was sent.', 'कोई सूचना नहीं भेजी गई।'),
        });
      },
      onError: () => toast({ title: tr('Ticket could not be raised. Refresh and try again.', 'टिकट नहीं बना। फिर कोशिश करें।') }),
    });
  };

  return (
    <section className="panel p-4 sm:p-5" data-testid="panel-worker-queue">
      <div className="mb-3 flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-primary">
          <FilePlus2 className="size-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">
            {tr('Local tracking only. The selected authority is a label; tickets are not forwarded or resolved here.', 'सिर्फ़ स्थानीय ट्रैकिंग। चुना गया अधिकारी केवल एक लेबल है; यहाँ टिकट आगे नहीं भेजे या हल नहीं किए जाते।')}
          </p>
          <p className="mt-1 text-xs font-semibold text-red-800">
            {tr('A real emergency needs a direct call to 108; a ticket does not dispatch help.', 'असली आपातकाल में सीधे 108 पर कॉल करें; टिकट से मदद नहीं भेजी जाती।')}
          </p>
        </div>
      </div>

      <Tabs defaultValue="attention" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl p-1">
          <TabsTrigger value="attention" className="min-h-[48px] whitespace-normal px-2 text-center">
            {tr('Needs your attention', 'आपकी जाँच ज़रूरी')}
          </TabsTrigger>
          <TabsTrigger value="tickets" className="min-h-[48px] whitespace-normal px-2 text-center">
            {tr('Raised tickets', 'उठाए गए टिकट')} · {tickets.data?.length ?? 0}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attention" className="space-y-3">
          {catalog.isLoading && <div className="h-20 animate-pulse rounded-xl bg-muted" />}
          {catalog.isError && (
            <button type="button" className="tap gap-2" disabled={!online} onClick={() => void catalog.refetch()}>
              <RotateCw size={17} />{tr('Could not load patients. Retry', 'मरीज़ नहीं मिले। फिर कोशिश करें')}
            </button>
          )}
          {!catalog.isLoading && !catalog.isError && attentionCases.length === 0 && (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              {tr('No amber or red profiles need attention.', 'किसी पीले या लाल प्रोफ़ाइल की जाँच बाकी नहीं है।')}
            </p>
          )}
          <div className="grid gap-3 lg:grid-cols-2">
            {attentionCases.map(patient => {
              const raisedTicket = tickets.data?.find(ticket => ticket.health_id === patient.health_id);
              return (
              <article key={patient.health_id} className="rounded-2xl border-2 border-border bg-card p-3 sm:p-4" data-testid={`card-attention-${patient.health_id}`}>
                <div className="flex items-start gap-3">
                  <span aria-hidden="true" className={`mt-1 h-10 w-2 shrink-0 rounded-full ${TIER_STYLE[patient.risk_tier]}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-extrabold">{patient.label}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold text-white ${TIER_STYLE[patient.risk_tier]}`}>
                        {patient.risk_tier === 'RED' ? tr('Red · Urgent', 'लाल · तुरंत') : tr('Amber · Review', 'पीला · समीक्षा')}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {roleLabel(patient.patient_type, lang)} · {tr('Health ID', 'हेल्थ आईडी')} {patient.health_id} · {villageName(patient.village, lang)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" className="tap tap-primary gap-2" disabled={!online || start.isPending} onClick={() => openPatient(patient.health_id)}>
                        {start.isPending && start.variables?.data.health_id === patient.health_id
                          ? <Loader2 size={17} className="animate-spin" />
                          : <ArrowRight size={17} />}
                        {tr('Open visit history', 'जाँच का इतिहास खोलें')}
                      </button>
                      {raisedTicket ? (
                        <span
                          className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border-2 border-primary/30 bg-accent px-4 text-sm font-bold text-primary"
                          role="status"
                          data-testid={`status-ticket-raised-${patient.health_id}`}
                        >
                          <CheckCircle2 size={17} />
                          {tr('Ticket raised', 'टिकट उठाया गया')} · {raisedTicket.status === 'PENDING' ? tr('Pending', 'बाकी') : tr('Action taken', 'कार्रवाई हुई')}
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="tap gap-2"
                          disabled={!online || pendingTicket || tickets.isLoading || tickets.isError}
                          aria-expanded={raiseFor === patient.health_id}
                          onClick={() => setRaiseFor(current => current === patient.health_id ? null : patient.health_id)}
                        >
                          <FilePlus2 size={17} />{tr('Raise ticket', 'टिकट उठाएँ')}
                        </button>
                      )}
                    </div>
                    {raiseFor === patient.health_id && (
                      <form className="mt-3 space-y-2 rounded-xl border bg-background p-3" onSubmit={event => { event.preventDefault(); raise(patient.health_id); }}>
                        <label className="block text-sm font-bold">
                          {tr('Suggested authority · tracking only', 'सुझाया गया अधिकारी · सिर्फ़ ट्रैकिंग')}
                          <select className="field mt-1 w-full" value={authority} onChange={event => setAuthority(event.target.value as EscalationAuthority)}>
                            {authorities.map(item => <option key={item.value} value={item.value}>{item.label[lang === 'hi' ? 1 : 0]}</option>)}
                          </select>
                        </label>
                        <div className="flex gap-2">
                          <button type="submit" className="tap tap-primary flex-1 gap-2" disabled={!online || createTicket.isPending}>
                            {createTicket.isPending ? <Loader2 size={17} className="animate-spin" /> : <FilePlus2 size={17} />}
                            {tr('Save ticket', 'टिकट सहेजें')}
                          </button>
                          <button type="button" className="tap" onClick={() => setRaiseFor(null)}>{tr('Cancel', 'रद्द करें')}</button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              </article>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="tickets" className="space-y-3">
          {tickets.isLoading && <div className="h-24 animate-pulse rounded-xl bg-muted" />}
          {tickets.isError && (
            <button type="button" className="tap gap-2" disabled={!online} onClick={() => void tickets.refetch()}>
              <RotateCw size={17} />{tr('Could not load tickets. Retry', 'टिकट नहीं मिले। फिर कोशिश करें')}
            </button>
          )}
          {!tickets.isLoading && !tickets.isError && !tickets.data?.length && (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              {tr('No tickets have been raised yet.', 'अभी कोई टिकट नहीं उठाया गया है।')}
            </p>
          )}
          {tickets.data?.map(ticket => (
            <article key={ticket.id} className="rounded-2xl border-2 border-border bg-card p-3 sm:p-4" data-testid={`card-ticket-${ticket.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-extrabold">{ticket.patient_name} · {tr('Health ID', 'हेल्थ आईडी')} {ticket.health_id}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {roleLabel(ticket.patient_type, lang)} · {villageName(ticket.village, lang)} · {tr('Suggested authority:', 'सुझाया गया अधिकारी:')} {authorityLabel(ticket.authority, lang)}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${ticket.status === 'PENDING' ? 'bg-amber-100 text-amber-950' : 'bg-green-100 text-green-950'}`}>
                  {ticket.status === 'PENDING' ? tr('Pending', 'बाकी') : tr('Action taken', 'कार्रवाई हुई')}
                </span>
              </div>
              <p className="mt-2 rounded-lg bg-muted/60 p-2 text-sm">{ticket.reason}</p>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock3 size={14} />{dateLabel(ticket.created_at, lang, true)}
              </p>
              {ticket.status === 'ACTION_TAKEN' && ticket.action_note && (
                <div className="mt-2 rounded-xl border border-green-300 bg-green-50 p-3 text-sm">
                  <p className="font-bold">{tr('Example action note', 'उदाहरण कार्रवाई नोट')}</p>
                  <p className="mt-1">{ticket.action_note}</p>
                </div>
              )}
            </article>
          ))}
        </TabsContent>
      </Tabs>
    </section>
  );
}
