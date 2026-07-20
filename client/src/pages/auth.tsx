import { useEffect } from "react";
import { SignIn } from "@clerk/clerk-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function Auth() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  const urlParams = new URLSearchParams(window.location.search);
  const returnUrl = urlParams.get("returnUrl");

  useEffect(() => {
    if (!loading && user) {
      setLocation(returnUrl || "/");
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
        {returnUrl && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Return to Community Map:</strong> After signing in, you'll be redirected back to the
              map you were viewing to pin with the community.
            </p>
          </div>
        )}

        <div className="flex justify-center">
          <SignIn
            routing="hash"
            signUpUrl={`/auth${returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ""}`}
            fallbackRedirectUrl={returnUrl || "/"}
          />
        </div>

        <Link href="/">
          <Button type="button" variant="outline" className="w-full h-12 text-base mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
