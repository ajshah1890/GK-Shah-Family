import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { Layout } from "@/components/layout/Layout";

import Dashboard from "@/pages/Dashboard";
import Members from "@/pages/Members";
import MemberProfile from "@/pages/MemberProfile";
import MemberForm from "@/pages/MemberForm";
import FamilyTree from "@/pages/FamilyTree";
import Statistics from "@/pages/Statistics";
import Settings from "@/pages/Settings";
import Import from "@/pages/Import";
import RelationshipExplorer from "@/pages/RelationshipExplorer";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/members" component={Members} />
        <Route path="/members/new" component={MemberForm} />
        <Route path="/members/:id/edit" component={MemberForm} />
        <Route path="/members/:id" component={MemberProfile} />
        <Route path="/family-tree" component={FamilyTree} />
        <Route path="/relationships" component={RelationshipExplorer} />
        <Route path="/import" component={Import} />
        <Route path="/statistics" component={Statistics} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster position="bottom-center" />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
