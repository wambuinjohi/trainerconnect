import React, { useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ApiConfigProvider } from "@/contexts/ApiConfigContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AutoSetupWrapper } from "@/components/AutoSetupWrapper";
import { ConnectionStatusDialog } from "@/components/ConnectionStatusDialog";
import { AuthForm } from "@/components/auth/AuthForm";
import { ClientDashboard } from "@/components/client/ClientDashboard";
import { TrainerDashboard } from "@/components/trainer/TrainerDashboard";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import NotFound from "./pages/NotFound";
import ClearCache from "./pages/ClearCache";
import AdminSetup from "./pages/AdminSetup";
import ApiTest from "./pages/ApiTest";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import UploadDemo from "./pages/UploadDemo";
import PasswordReset from "./pages/PasswordReset";
import ResetPasswords from "./pages/ResetPasswords";
import MpesaMigration from "./pages/MpesaMigration";

const queryClient = new QueryClient();

const AppContent = () => {
  const { user, userType, loading } = useAuth();

  useEffect(() => {
    // You can add any custom logic for auto-login or token check here
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-gradient-primary mx-auto mb-4 animate-pulse"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Show public Home page when not authenticated
    return <Home />;
  }

  // Route based on user type
  switch (userType) {
    case "client":
      return <ClientDashboard />;
    case "trainer":
      return <TrainerDashboard />;
    case "admin":
      return <AdminDashboard />;
    default:
      return <ClientDashboard />;
  }
};

const App = () => (
  <ErrorBoundary>
    <ThemeProvider attribute="class" defaultTheme="system">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Sonner />
          <ApiConfigProvider>
            <AuthProvider>
              <AutoSetupWrapper>
                <ConnectionStatusDialog />
                <BrowserRouter>
                  <Routes>
                    <Route path="/" element={<AppContent />} />
                    <Route
                      path="/signin"
                      element={
                        <AuthForm onSuccess={() => (window.location.href = "/")} />
                      }
                    />
                    <Route
                      path="/signup"
                      element={
                        <AuthForm
                          initialTab="signup"
                          onSuccess={() => (window.location.href = "/")}
                        />
                      }
                    />
                    <Route path="/password-reset" element={<PasswordReset />} />
                    <Route path="/reset-passwords" element={<ResetPasswords />} />
                    <Route path="/admin/reset-passwords" element={<ResetPasswords />} />
                    <Route path="/setup" element={<AdminSetup />} />
                    <Route path="/api-test" element={<ApiTest />} />
                    <Route path="/explore" element={<Explore />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/contact" element={<Contact />} />
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/home" element={<Home />} />
                    <Route path="/clear-cache" element={<ClearCache />} />
                    <Route path="/upload-demo" element={<UploadDemo />} />
                    <Route path="/admin/mpesamigration" element={<MpesaMigration />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
              </AutoSetupWrapper>
            </AuthProvider>
          </ApiConfigProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
