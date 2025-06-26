import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';

interface DeleteMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  mapCollection: {
    id: string;
    name: string;
    pinCount?: number;
  };
}

export function DeleteMapModal({ isOpen, onClose, mapCollection }: DeleteMapModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMapMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      return apiRequest(`/api/maps/${mapCollection.id}`, 'DELETE', { userId: user.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/maps'] });
      toast({
        title: "Map deleted",
        description: "Your map and all its pins have been permanently deleted."
      });
      onClose();
      setConfirmText('');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete map.",
        variant: "destructive"
      });
    }
  });

  const handleDelete = () => {
    if (confirmText === mapCollection.name) {
      deleteMapMutation.mutate();
    }
  };

  const handleClose = () => {
    onClose();
    setConfirmText('');
  };

  const isConfirmValid = confirmText === mapCollection.name;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <DialogTitle>Delete Map</DialogTitle>
          </div>
          <DialogDescription>
            This action cannot be undone. This will permanently delete your map
            "{mapCollection.name}" and remove all {mapCollection.pinCount || 0} pins.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">
              <strong>Warning:</strong> All data associated with this map will be permanently lost,
              including pins, sharing permissions, and invitations.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">
              Type the map name "<strong>{mapCollection.name}</strong>" to confirm deletion:
            </Label>
            <Input
              id="confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={mapCollection.name}
              className="font-mono"
            />
          </div>
        </div>

        <DialogFooter className="space-x-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isConfirmValid || deleteMapMutation.isPending}
          >
            {deleteMapMutation.isPending ? 'Deleting...' : 'Delete Map'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}