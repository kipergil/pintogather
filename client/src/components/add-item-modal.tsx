import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, apiUpload } from "@/lib/queryClient";
import { isUpgradeableError, upgradeToastAction } from "@/lib/upgradeToast";
import { useAuth } from "@/contexts/AuthContext";
import { ImageIcon, Link2, Loader2, Sparkles, X } from "lucide-react";
import type { ItemType } from "@shared/enums";

const PHOTO_MAX_BYTES = 5 * 1024 * 1024; // 5MB, matches the server-side limit
const PHOTO_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
const NOTE_MAX_LENGTH = 280;

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  mapCollection: {
    shareUrl: string;
    noteLabel?: string | null;
    notePrompt?: string | null;
    /** Only "link"/"recommendation" ever reach this modal — "location" items still go through AddPinModal. */
    itemType: Extract<ItemType, "link" | "recommendation">;
  };
}

interface ItemFormData {
  title: string;
  contributorName: string;
  url: string;
  note: string;
  photoUrl: string | null;
}

const emptyForm: ItemFormData = {
  title: "",
  contributorName: "",
  url: "",
  note: "",
  photoUrl: null,
};

function looksLikeUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Add-item form for "link"/"recommendation" collections — the non-map
 * counterpart to AddPinModal. A "link" item requires a URL (pasting one
 * auto-fetches a title/description/image via POST /api/link-preview, all
 * still editable after); a "recommendation" item needs only a title, with
 * everything else — including the URL, which still triggers the same
 * preview fetch — optional.
 */
export function AddItemModal({ isOpen, onClose, mapCollection }: AddItemModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const noteLabel = mapCollection.noteLabel || "Note";
  const notePrompt = mapCollection.notePrompt || null;
  const isLink = mapCollection.itemType === "link";

  const [formData, setFormData] = useState<ItemFormData>(emptyForm);
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const lastFetchedUrlRef = useRef<string | null>(null);
  const photoFileInputRef = useRef<HTMLInputElement>(null);

  const fetchPreview = async (url: string) => {
    if (!looksLikeUrl(url) || lastFetchedUrlRef.current === url) return;
    lastFetchedUrlRef.current = url;
    setIsFetchingPreview(true);
    setPreviewError(null);
    try {
      const response = await apiRequest("POST", "/api/link-preview", { url });
      const preview = (await response.json()) as { title: string | null; description: string | null; imageUrl: string | null };
      // Only fills fields the user hasn't already typed something into —
      // a paste-then-fetch shouldn't clobber edits made in the meantime.
      setFormData((prev) => ({
        ...prev,
        title: prev.title || preview.title || prev.title,
        note: prev.note || preview.description || prev.note,
        photoUrl: prev.photoUrl || preview.imageUrl,
      }));
    } catch (error: any) {
      setPreviewError(error.message || "Couldn't fetch a preview for that URL.");
    } finally {
      setIsFetchingPreview(false);
    }
  };

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > PHOTO_MAX_BYTES) {
      toast({ title: "File too large", description: "Please choose an image under 5MB.", variant: "destructive" });
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const response = await apiUpload("/api/uploads/pin-photo", file);
      const { url } = await response.json();
      setFormData((prev) => ({ ...prev, photoUrl: url }));
    } catch (error: any) {
      toast({ title: "Couldn't upload photo", description: error.message || "Please try again", variant: "destructive" });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const createItemMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", `/api/maps/${mapCollection.shareUrl}/pins`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Item added", description: "It's now live in this collection.", variant: "success" });
      queryClient.invalidateQueries({ queryKey: [`/api/maps/${mapCollection.shareUrl}`] });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't add item",
        description: error.message || "Please try again",
        variant: "destructive",
        action: isUpgradeableError(error) ? upgradeToastAction() : undefined,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast({ title: "Title required", description: "Please enter a title for this item", variant: "destructive" });
      return;
    }
    if (!user && !formData.contributorName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your name so we know who added this",
        variant: "destructive",
      });
      return;
    }
    if (isLink && !formData.url.trim()) {
      toast({ title: "URL required", description: "Please paste a link for this item", variant: "destructive" });
      return;
    }

    createItemMutation.mutate({
      userId: user?.id || null,
      title: formData.title.trim(),
      contributorName: user ? null : formData.contributorName.trim() || null,
      url: formData.url.trim() || null,
      note: formData.note.trim() || null,
      photoUrl: formData.photoUrl,
    });
  };

  const handleClose = () => {
    setFormData(emptyForm);
    setPreviewError(null);
    lastFetchedUrlRef.current = null;
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="inset-0 sm:inset-auto sm:left-[50%] sm:top-[50%] translate-x-0 sm:translate-x-[-50%] translate-y-0 sm:translate-y-[-50%] w-full h-full sm:h-auto max-w-full sm:max-w-lg max-h-full sm:max-h-[90vh] rounded-none sm:rounded-lg z-[9999] p-0 gap-0 flex flex-col overflow-hidden"
      >
        <DialogHeader className="px-6 pt-6 pb-4 min-w-0 shrink-0 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              {isLink ? <Link2 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            </div>
            Add {isLink ? "a link" : "a recommendation"}
          </DialogTitle>
          <DialogDescription>
            {isLink ? "Paste a URL — the title, description, and image fill in automatically." : "Tell people what you're recommending."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 min-w-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 min-w-0">
            <div className="space-y-2">
              <Label htmlFor="itemUrl">{isLink ? "URL" : "Link (optional)"}</Label>
              <div className="relative">
                <Input
                  id="itemUrl"
                  type="url"
                  placeholder="https://..."
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  onBlur={(e) => fetchPreview(e.target.value.trim())}
                  required={isLink}
                  data-testid="input-item-url"
                />
                {isFetchingPreview && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {previewError && <p className="text-xs text-destructive">{previewError}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="itemTitle">Title</Label>
              <Input
                id="itemTitle"
                type="text"
                placeholder={isLink ? "Title of the page" : "What are you recommending?"}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                data-testid="input-item-title"
              />
            </div>

            {!user && (
              <div className="space-y-2">
                <Label htmlFor="itemContributorName">Your name</Label>
                <Input
                  id="itemContributorName"
                  type="text"
                  placeholder="So the map owner knows who added this"
                  value={formData.contributorName}
                  onChange={(e) => setFormData({ ...formData, contributorName: e.target.value })}
                  required
                  data-testid="input-item-contributor-name"
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="itemNote">{noteLabel}</Label>
                <span className="text-xs text-muted-foreground">
                  {formData.note.length}/{NOTE_MAX_LENGTH}
                </span>
              </div>
              {notePrompt && <p className="text-xs text-muted-foreground -mt-1.5">{notePrompt}</p>}
              <Textarea
                id="itemNote"
                placeholder={notePrompt || (isLink ? "Why is this worth reading?" : "Why are you recommending this?")}
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value.slice(0, NOTE_MAX_LENGTH) })}
                rows={2}
                data-testid="input-item-note"
              />
            </div>

            <div className="space-y-2">
              <Label>Photo (optional)</Label>
              {formData.photoUrl ? (
                <div className="relative w-fit">
                  <img
                    src={formData.photoUrl}
                    alt="Item preview"
                    className="h-24 w-24 rounded-lg object-cover border border-border"
                    data-testid="img-item-photo-preview"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, photoUrl: null })}
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-foreground text-background flex items-center justify-center shadow"
                    aria-label="Remove photo"
                    data-testid="button-remove-item-photo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <input
                    ref={photoFileInputRef}
                    type="file"
                    accept={PHOTO_ACCEPT}
                    onChange={handlePhotoFileChange}
                    className="hidden"
                    data-testid="input-item-photo-file"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => photoFileInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                    data-testid="button-upload-item-photo"
                  >
                    {isUploadingPhoto ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <ImageIcon className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {isUploadingPhoto ? "Uploading..." : "Add a photo"}
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="px-6 py-4 border-t border-border shrink-0">
            <Button
              type="submit"
              className="w-full"
              disabled={createItemMutation.isPending || isUploadingPhoto || isFetchingPreview}
              data-testid="button-submit-add-item"
            >
              {createItemMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                `Add ${isLink ? "link" : "recommendation"}`
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
