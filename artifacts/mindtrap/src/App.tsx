import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SocketProvider } from "@/contexts/SocketContext";
import NotFound from "@/pages/not-found";

import Home from "@/pages/Home";
import Lobby from "@/pages/Lobby";
import Game from "@/pages/Game";
import Results from "@/pages/Results";
import Stats from "@/pages/Stats";
import Admin from "@/pages/Admin";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/lobby/:roomCode" component={Lobby} />
      <Route path="/game/:roomCode" component={Game} />
      <Route path="/results/:roomCode" component={Results} />
      <Route path="/stats/:roomCode/:playerName" component={Stats} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SocketProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </SocketProvider>
    </QueryClientProvider>
  );
}

export default App;
