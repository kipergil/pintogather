import { Switch, Route, Redirect, useLocation } from "wouter";
import { APP_NAME } from "@/lib/branding";
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
import MapForm from "@/pages/map-form";
import PublicMap from "@/pages/public-map";
import Profile from "@/pages/profile";
import Pricing from "@/pages/pricing";
import Discover from "@/pages/discover";
import Feed from "@/pages/feed";
import SearchPage from "@/pages/search";
import PublicProfilePage from "@/pages/public-profile";
import Auth from "@/pages/auth";
import EditPin from "@/pages/edit-pin";
import AddItems from "@/pages/add-items";
import AcceptInvitation from "@/pages/accept-invitation";
import AdminPage from "@/pages/admin";
import AdminCurateMap from "@/pages/admin-curate-map";
import CmsPage from "@/pages/cms-page";
import NotFound from "@/pages/not-found";
import { SiteFooter } from "@/components/site-footer";
import { Compass, LogIn, MapPinned, Rss, Search, Shield, User, LogOut, ExternalLink, CreditCard } from "lucide-react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/discover" component={Discover} />
      <Route path="/feed" component={Feed} />
      <Route path="/search" component={SearchPage} />
      <Route path="/profile" component={Profile} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/how-it-works"><CmsPage slug="how-it-works" /></Route>
      <Route path="/who-its-for"><CmsPage slug="who-its-for" /></Route>
      <Route path="/features"><CmsPage slug="features" /></Route>
      <Route path="/use-cases"><CmsPage slug="use-cases" /></Route>
      <Route path="/pages/:slug" component={CmsPage} />
      <Route path="/auth" component={Auth} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/admin/maps/:mapId/curate" component={AdminCurateMap} />
      <Route path="/p/:shareUrl" component={PublicMap} />
      <Route path="/u/:username" component={PublicProfilePage} />
      <Route path="/map/new" component={MapForm} />
      <Route path="/map/:shareUrl/edit-pin/:pinId" component={EditPin} />
      <Route path="/map/:shareUrl/add" component={AddItems} />
      {/* Old name for the add hub — kept so existing links and bookmarks still land somewhere useful. */}
      <Route path="/map/:shareUrl/import">
        {(params) => <Redirect to={`/map/${params.shareUrl}/add`} replace />}
      </Route>
      <Route path="/map/:shareUrl/edit" component={MapForm} />
      <Route path="/map/:shareUrl" component={MapDetail} />
      <Route path="/invitations/:token" component={AcceptInvitation} />
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
          <div className="flex items-center gap-5">
            <button
              className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
              onClick={() => setLocation("/")}
              data-testid="button-home-logo"
            >
              <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center shadow-sm shadow-primary/30">
                <MapPinned className="w-4 h-4 text-primary-foreground" strokeWidth={2.25} />
              </div>
              <span className="text-lg font-semibold tracking-tight text-foreground">{APP_NAME}</span>
            </button>
            <button
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setLocation("/discover")}
              data-testid="button-nav-discover"
            >
              <Compass className="h-4 w-4" />
              <span className="hidden sm:inline">Discover</span>
            </button>
            <button
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setLocation("/search")}
              data-testid="button-nav-search"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Search</span>
            </button>
            {!loading && user && (
              <button
                className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setLocation("/feed")}
                data-testid="button-nav-feed"
              >
                <Rss className="h-4 w-4" />
                <span className="hidden sm:inline">Feed</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!loading && user && user.userGroup !== "premium" && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 hidden sm:inline-flex"
                onClick={() => setLocation("/pricing")}
                data-testid="button-header-upgrade"
              >
                Upgrade
              </Button>
            )}
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
                        <span className="text-xs font-medium text-primary capitalize mt-0.5">
                          {user.userGroup === "freemium" ? "Free" : user.userGroup} plan
                        </span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setLocation("/profile")} data-testid="menu-item-profile">
                      <User className="h-4 w-4 mr-2" />
                      Profile settings
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLocation("/pricing")} data-testid="menu-item-pricing">
                      <CreditCard className="h-4 w-4 mr-2" />
                      Plans &amp; billing
                    </DropdownMenuItem>
                    {user.username && (
                      <DropdownMenuItem
                        onClick={() => setLocation(`/u/${user.username}`)}
                        data-testid="menu-item-public-profile"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View public profile
                      </DropdownMenuItem>
                    )}
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

function AppShell() {
  const [location] = useLocation();
  // Public branded map pages are meant to be shared standalone, with no
  // app chrome at all — not even the header.
  const isBrandedView = location.startsWith("/p/");

  return (
    <div className="min-h-screen bg-background">
      {!isBrandedView && <HeaderContent />}
      <Router />
      {!isBrandedView && <SiteFooter />}
      <Toaster />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthErrorBoundary>
        <AuthProvider>
          <TooltipProvider>
            <AppShell />
          </TooltipProvider>
        </AuthProvider>
      </AuthErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
