import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

import LandingPage from "@/pages/landing";
import BookingPage from "@/pages/booking";
import BookingFormPage from "@/pages/booking-form";
import HistoryPage from "@/pages/history";
import AdminLoginPage from "@/pages/admin-login";

const AdminDashboard = lazy(() => import("@/pages/admin-dashboard"));
const AdminPayments = lazy(() => import("@/pages/admin-payments"));
const AdminLayout = lazy(() => import("@/components/admin-layout"));

function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="space-y-3 text-center">
        <Skeleton className="mx-auto h-10 w-10 rounded-full" />
        <Skeleton className="h-4 w-32 mx-auto" />
      </div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/booking" component={BookingPage} />
        <Route path="/booking/form" component={BookingFormPage} />
        <Route path="/history" component={HistoryPage} />

        <Route path="/admin/dashboard">
          <AdminLayout>
            <AdminDashboard />
          </AdminLayout>
        </Route>

        <Route path="/admin/payments">
          <AdminLayout>
            <AdminPayments />
          </AdminLayout>
        </Route>

        <Route path="/admin" component={AdminLoginPage} />

        <Route>
          <div className="flex h-screen items-center justify-center">
            <p className="text-muted-foreground">Halaman tidak ditemukan</p>
          </div>
        </Route>
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
