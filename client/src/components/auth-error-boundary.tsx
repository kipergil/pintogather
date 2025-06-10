import { Component, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AuthErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if this is an authentication service error
    if (error.message.includes('Authentication service not available')) {
      return { hasError: true, error };
    }
    return { hasError: false, error: null };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    if (error.message.includes('Authentication service not available')) {
      console.warn('Authentication service unavailable - running in limited mode');
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertTitle className="text-orange-800">Authentication Service Unavailable</AlertTitle>
              <AlertDescription className="text-orange-700 mt-2">
                The authentication service is currently not configured. You can still use the app with limited functionality.
              </AlertDescription>
            </Alert>
            
            <div className="mt-4 space-y-3">
              <Button 
                onClick={() => window.location.reload()} 
                className="w-full"
                variant="outline"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry Connection
              </Button>
              
              <Button 
                onClick={() => this.setState({ hasError: false, error: null })}
                className="w-full"
              >
                Continue in Limited Mode
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}