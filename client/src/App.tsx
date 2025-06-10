import { useState } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Home from "@/pages/home";
import MapDetail from "@/pages/map-detail";
import Profile from "@/pages/profile";
import Auth from "@/pages/auth";
import AddPin from "@/pages/add-pin";
import EditPin from "@/pages/edit-pin";
import NotFound from "@/pages/not-found";
import { LogIn, User, LogOut } from "lucide-react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/profile" component={Profile} />
      <Route path="/auth" component={Auth} />
      <Route path="/map/:shareUrl/add-pin" component={AddPin} />
      <Route path="/map/:shareUrl/edit-pin/:pinId" component={EditPin} />
      <Route path="/map/:shareUrl" component={MapDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function HeaderContent() {
  const { user, signOut, loading } = useAuth();
  const [, setLocation] = useLocation();

  const handleSignOut = async () => {
    try {
      await signOut();
      setLocation('/');
    } catch (error) {
      console.error('Sign out error:', error);
      // Force sign out by clearing local state even if Supabase fails
      setLocation('/');
      window.location.reload();
    }
  };

  return (
    <>
      <header className="bg-white shadow-material">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <button 
              className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
              onClick={() => setLocation('/')}
            >
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-neutral-900">CollabMap</h1>
            </button>
            
            <div className="flex items-center space-x-4">
              {!loading && (
                user ? (
                  <div className="flex items-center space-x-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLocation('/profile')}
                    >
                      <User className="h-4 w-4 mr-1" />
                      Profile
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSignOut}
                    >
                      <LogOut className="h-4 w-4 mr-1" />
                      Sign Out
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => setLocation('/auth')}
                    data-auth-trigger
                    className="bg-primary hover:bg-primary/90"
                  >
                    <LogIn className="h-4 w-4 mr-2" />
                    Sign In
                  </Button>
                )
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <div className="min-h-screen bg-neutral-50">
            <HeaderContent />
            <Router />
            <Toaster />
          </div>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
