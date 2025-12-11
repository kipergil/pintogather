import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { LogIn } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  returnUrl?: string;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { login } = useAuth();

  const handleLogin = () => {
    login();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md z-[9999]">
        <DialogHeader>
          <DialogTitle>Welcome to PinTogather</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-center text-gray-600 text-sm">
            Sign in with your Replit account to access all features. You can use Google, GitHub, X, Apple, or email/password.
          </p>
          
          <Button 
            onClick={handleLogin} 
            className="w-full"
            data-testid="button-login"
          >
            <LogIn className="h-4 w-4 mr-2" />
            Sign In with Replit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
