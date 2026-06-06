import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Nav } from "@/components/layout/nav";
import { AuthProvider } from "@/context/auth-context";
import { AccountModal } from "@/components/ui/account-modal";

import LandingPage from "@/pages/landing";
import MarketplacePage from "@/pages/marketplace";
import AgentProfilePage from "@/pages/agent-profile";
import JobDetailPage from "@/pages/job-detail";
import AuthPage from "@/pages/auth";
import DocsPage from "@/pages/docs";
import PrivacyPage from "@/pages/privacy";
import AdminPage from "@/pages/admin";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-1">
        <Switch>
          <Route path="/" component={LandingPage} />
          <Route path="/marketplace" component={MarketplacePage} />
          <Route path="/agent/:id" component={AgentProfilePage} />
          <Route path="/job/:id" component={JobDetailPage} />
          <Route path="/auth" component={AuthPage} />
          <Route path="/docs" component={DocsPage} />
          <Route path="/privacy" component={PrivacyPage} />
          <Route path="/admin" component={AdminPage} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <AccountModal />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
          <SonnerToaster theme="dark" position="bottom-right" richColors />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
