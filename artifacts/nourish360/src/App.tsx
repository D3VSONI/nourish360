import { useEffect,type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Home from '@/pages/home';
import Auth from '@/pages/auth';
import Assess from '@/pages/assess';
import Results from '@/pages/results';
import Track from '@/pages/track';
import { LangProvider,useLang } from '@/lib/i18n';
import { AppProvider } from '@/lib/store';
import { Shell } from '@/components/shell';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

function Router() {
  const [path]=useLocation();
  const {tr}=useLang();
  useEffect(()=>{
    const title=path==='/'?tr('Health check-ups','स्वास्थ्य जाँच'):path.startsWith('/start/')?tr('Patient profile','मरीज़ की प्रोफ़ाइल'):path==='/assess'?tr('Check-up','जाँच'):path==='/results'?tr('Visit results','जाँच का नतीजा'):path.startsWith('/track/')?tr('Ambulance practice','एम्बुलेंस अभ्यास'):tr('Page not found','पेज नहीं मिला');
    document.title=`${title} · Nourish360`;
  },[path,tr]);
  return (
    <Shell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/start/:role" component={Auth} />
          <Route path="/assess" component={Assess} />
          <Route path="/results" component={Results} />
          <Route path="/track/:id" component={Track} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Shell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <LangProvider><AppProvider>
            <Router />
          </AppProvider></LangProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
