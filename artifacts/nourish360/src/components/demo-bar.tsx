import { useLocation } from 'wouter';
import { Loader2, Sparkles } from 'lucide-react';
import { useGetCatalog, useStartDemo, type RiskTier } from '@workspace/api-client-react';
import { useApp, ROLE_META } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

export const TIER_STYLE: Record<RiskTier, string> = {
  GREEN: 'bg-[hsl(var(--tier-green))] text-white',
  AMBER: 'bg-[hsl(var(--tier-amber))] text-[hsl(285_38%_14%)]',
  RED: 'bg-[hsl(var(--tier-red))] text-white',
};

export function DemoBar() {
  const catalog = useGetCatalog();
  const start = useStartDemo();
  const { adoptRecord, online } = useApp();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const cases = catalog.data?.demo_cases ?? [];

  const pick = (health_id: string) =>
    start.mutate({ data: { health_id } }, {
      onSuccess: async (rec) => { await adoptRecord(rec); navigate(rec.visits.length ? '/results' : '/assess'); },
      onError: () => toast({ title: 'Demo could not start', description: 'Try again in a moment.' }),
    });

  return (
    <div className="rounded-3xl border border-dashed border-primary/40 bg-card/70 p-4" data-testid="panel-demo">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
        <Sparkles className="h-4 w-4" /> Demo quick-fill
        <span className="font-normal text-muted-foreground">· isolated synthetic copy with 3 past visits</span>
      </div>
      {catalog.isLoading ? (
        <div className="flex gap-2">{[0, 1, 2].map((i) => <div key={i} className="h-14 flex-1 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : catalog.isError ? (
        <button onClick={() => catalog.refetch()} className="text-sm underline" data-testid="button-retry-demo">Couldn't load demo cases. Retry</button>
      ) : (
        <div className="flex flex-wrap gap-2">
          {cases.map((c) => (
            <button key={c.health_id} disabled={start.isPending || !online} onClick={() => pick(c.health_id)} data-testid={`button-demo-${c.health_id}`}
              className="press group flex min-w-[180px] flex-1 items-center gap-3 rounded-2xl border bg-background px-3 py-2.5 text-left hover:border-primary disabled:opacity-50">
              <span className={`h-8 w-1.5 rounded-full ${TIER_STYLE[c.risk_tier].split(' ')[0]}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{c.label}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{ROLE_META[c.patient_type].label} · {c.village}</span>
              </span>
              {start.isPending && start.variables?.data.health_id === c.health_id && <Loader2 className="h-4 w-4 animate-spin" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
