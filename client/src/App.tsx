import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AuthErrorBoundary } from "@/components/auth-error-boundary";
import { getInitials } from "@/lib/map-utils";
import Home from "@/pages/home";
import MapDetail from "@/pages/map-detail";
import Profile from "@/pages/profile";
import Auth from "@/pages/auth";
import AddPin from "@/pages/add-pin";
import EditPin from "@/pages/edit-pin";
import AdminPage from "@/pages/admin";
import NotFound from "@/pages/not-found";
import { LogIn, MapPinned, Shield, User, LogOut } from "lucide-react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/profile" component={Profile} />
      <Route path="/auth" component={Auth} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/map/:shareUrl/add-pin" component={AddPin} />
      <Route path="/map/:shareUrl/edit-pin/:pinId" component={EditPin} />
      <Route path="/map/:shareUrl" component={MapDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function HeaderContent() {
  const { user, login, logout, loading } = useAuth();
  const [, setLocation] = useLocation();

  const displayName = user
    ? user.fullName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Account"
    : "";

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <button
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
            onClick={() => setLocation("/")}
            data-testid="button-home-logo"
          >
            <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center shadow-sm shadow-primary/30">
              <MapPinned className="w-4 h-4 text-primary-foreground" strokeWidth={2.25} />
            </div>
            <span className="text-lg font-semibold tracking-tight text-foreground">PinTogather</span>
          </button>

          <div className="flex items-center gap-2">
            {!loading &&
              (user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 hover:bg-muted transition-colors"
                      data-testid="button-user-menu"
                    >
                      <Avatar className="h-7 w-7 border border-border">
                        {user.profileImageUrl && <AvatarImage src={user.profileImageUrl} alt={displayName} />}
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {getInitials(displayName || "?")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden sm:block text-sm font-medium text-foreground max-w-[10rem] truncate">
                        {displayName}
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium truncate">{displayName}</span>
                        {user.email && (
                          <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                        )}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setLocation("/profile")} data-testid="menu-item-profile">
                      <User className="h-4 w-4 mr-2" />
                      Profile settings
                    </DropdownMenuItem>
                    {user.isAdmin && (
                      <DropdownMenuItem onClick={() => setLocation("/admin")} data-testid="menu-item-admin">
                        <Shield className="h-4 w-4 mr-2" />
                        Admin panel
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} data-testid="menu-item-signout">
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button onClick={login} data-auth-trigger data-testid="button-signin" size="sm" className="h-9 px-4">
                  <LogIn className="h-3.5 w-3.5 mr-1.5" />
                  Sign in
                </Button>
              ))}
          </div>
        </div>
      </div>
    </header>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthErrorBoundary>
        <AuthProvider>
          <TooltipProvider>
            <div className="min-h-screen bg-background">
              <HeaderContent />
              <Router />
              <Toaster />
            </div>
          </TooltipProvider>
        </AuthProvider>
      </AuthErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
