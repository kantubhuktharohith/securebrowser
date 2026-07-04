import { Switch, Route, Redirect } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Home from "@/pages/home";

// Admin pages
import AdminLogin from "@/pages/admin/login";
import HallTicketGeneration from "@/pages/admin/hall-ticket-generation";
import AdminDashboard from "@/pages/admin/dashboard";
import MonitoringSystem from "@/pages/admin/monitoring";
import IncidentManagement from "@/pages/admin/incidents";
import QuestionManagement from "@/pages/admin/question-management";
import Results from "@/pages/admin/results";
import DraftBin from "@/pages/admin/draft-bin";
import ManualVerification from "@/pages/admin/manual-verification";
import AdminAnalytics from "@/pages/admin/analytics";

// Student pages
import StudentStart from "@/pages/student/start";
import StudentAuthentication from "@/pages/student/authentication";
import IdCardScan from "@/pages/student/id-card-scan";
import IdentityVerification from "@/pages/student/identity-verification";
import ExamMode from "@/pages/student/exam";
import ExamComplete from "@/pages/student/exam-complete";
import StudentDashboard from "@/pages/student/dashboard";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="w-10 h-10 border-[3px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }
  
  return isAuthenticated ? <Component /> : <Redirect to="/admin/login" replace />;
}

function AuthRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="w-10 h-10 border-[3px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }
  
  return isAuthenticated ? <Redirect to="/" replace /> : <Component />;
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {/* Home route - conditional based on auth */}
      <Route path="/" component={isLoading || !isAuthenticated ? Landing : Home} />
      
      {/* Admin login - protected against authenticated users */}
      <Route path="/admin/login">
        <AuthRoute component={AdminLogin} />
      </Route>
      
      {/* Student routes - always available (they guard themselves) */}
      <Route path="/student/start" component={StudentStart} />
      <Route path="/student/auth" component={StudentAuthentication} />
      <Route path="/hall-ticket" component={StudentAuthentication} />
      <Route path="/student/id-card-scan" component={IdCardScan} />
      <Route path="/student/identity-verification" component={IdentityVerification} />
      <Route path="/student/exam" component={ExamMode} />
      <Route path="/exam-complete" component={ExamComplete} />
      <Route path="/student/dashboard" component={StudentDashboard} />
      
      {/* Admin routes - protected by auth */}
      <Route path="/admin">
        <ProtectedRoute component={Home} />
      </Route>
      <Route path="/admin/hall-tickets">
        <ProtectedRoute component={HallTicketGeneration} />
      </Route>
      <Route path="/admin/dashboard">
        <ProtectedRoute component={AdminDashboard} />
      </Route>
      <Route path="/admin/monitoring">
        <ProtectedRoute component={MonitoringSystem} />
      </Route>
      <Route path="/admin/incidents">
        <ProtectedRoute component={IncidentManagement} />
      </Route>
      <Route path="/admin/questions">
        <ProtectedRoute component={QuestionManagement} />
      </Route>
      <Route path="/admin/results">
        <ProtectedRoute component={Results} />
      </Route>
      <Route path="/admin/draft-bin">
        <ProtectedRoute component={DraftBin} />
      </Route>
      <Route path="/admin/manual-verification">
        <ProtectedRoute component={ManualVerification} />
      </Route>
      <Route path="/admin/analytics">
        <ProtectedRoute component={AdminAnalytics} />
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        window.location.reload();
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
