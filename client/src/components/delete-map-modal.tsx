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
import { AlertTriangle } from 'lucide-react';

interface DeleteMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  mapCollection: {
    id: string;
    name: string;
    description?: string;
    shareUrl: string;
    createdAt: string;
    pinCount?: number;
  };
  /** Whether this account's tier includes map archiving — hides the "Archive instead" option otherwise. */
  canArchive: boolean;
  onArchive: (mapId: string) => void;
  isArchiving: boolean;
}

export function DeleteMapModal({ isOpen, onClose, mapCollection, canArchive, onArchive, isArchiving }: DeleteMapModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMapMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      return apiRequest('DELETE', `/api/maps/${mapCollection.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/maps'] });
      toast({
        title: "Map deleted",
        description: "Your map and all its pins have been permanently deleted."
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete map.",
        variant: "destructive"
      });
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <DialogTitle>Delete "{mapCollection.name}"?</DialogTitle>
          </div>
          <DialogDescription>
            This permanently deletes the map and its {mapCollection.pinCount || 0} pins. This can't be undone.
            {canArchive && " If you just want it out of the way, archive it instead — nothing is lost and you can restore it anytime."}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {canArchive && (
            <Button
              variant="outline"
              onClick={() => {
                onArchive(mapCollection.id);
                onClose();
              }}
              disabled={isArchiving}
              data-testid="button-archive-instead"
            >
              {isArchiving ? 'Archiving...' : 'Archive instead'}
            </Button>
          )}
          <Button
            variant="destructive"
            onClick={() => deleteMapMutation.mutate()}
            disabled={deleteMapMutation.isPending}
            data-testid="button-confirm-delete-map"
          >
            {deleteMapMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
