import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogIn, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function Auth() {
  const { user, loading, login } = useAuth();
  const [, setLocation] = useLocation();
  
  const urlParams = new URLSearchParams(window.location.search);
  const returnUrl = urlParams.get('returnUrl');

  useEffect(() => {
    if (!loading && user) {
      if (returnUrl) {
        setLocation(returnUrl);
      } else {
        setLocation('/');
      }
    }
  }, [user, loading, returnUrl, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto p-4 py-8">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Welcome to PinTogather</CardTitle>
            <p className="text-gray-600">Join communities and pin your world together</p>
            {returnUrl && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Return to Community Map:</strong> After signing in, you'll be redirected back to the map you were viewing to pin with the community.
                </p>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-gray-600 text-sm">
              Sign in with your Replit account to access all features. You can use Google, GitHub, X, Apple, or email/password.
            </p>
            
            <Button 
              onClick={login} 
              className="w-full h-12 text-base"
              data-testid="button-login"
            >
              <LogIn className="h-5 w-5 mr-2" />
              Sign In with Replit
            </Button>
            
            <Link href="/">
              <Button type="button" variant="outline" className="w-full h-12 text-base">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
