import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronDown, MessageSquareText, Plus, Save } from "lucide-react";

interface MapDetailsFormData {
  name: string;
  description: string;
  noteLabel: string;
  notePrompt: string;
}

interface CreateMapFormProps {
  onCreated?: () => void;
  /** When set, the form edits this existing map instead of creating a new one. */
  mapId?: string;
  initialValues?: Partial<MapDetailsFormData>;
}

export function CreateMapForm({ onCreated, mapId, initialValues }: CreateMapFormProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isEditing = !!mapId;

  const [formData, setFormData] = useState<MapDetailsFormData>({
    name: initialValues?.name ?? "",
    description: initialValues?.description ?? "",
    noteLabel: initialValues?.noteLabel ?? "",
    notePrompt: initialValues?.notePrompt ?? "",
  });
  const [showNoteCustomization, setShowNoteCustomization] = useState(
    !!(initialValues?.noteLabel || initialValues?.notePrompt),
  );

  const createMapMutation = useMutation({
    mutationFn: async (data: MapDetailsFormData) => {
      const mapData = {
        name: data.name,
        description: data.description,
        noteLabel: data.noteLabel.trim() || null,
        notePrompt: data.notePrompt.trim() || null,
        ownerId: user?.id || null,
      };
      const response = await apiRequest("POST", "/api/maps", mapData);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Map created",
        description: `"${data.name}" is ready — start adding pins.`,
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/maps", user?.id] });
      onCreated?.();
      setLocation(`/map/${data.shareUrl}`);
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't create map",
        description: error.message || "Failed to create map collection",
        variant: "destructive",
      });
    },
  });

  const updateMapMutation = useMutation({
    mutationFn: async (data: MapDetailsFormData) => {
      const mapData = {
        name: data.name,
        description: data.description,
        noteLabel: data.noteLabel.trim() || null,
        notePrompt: data.notePrompt.trim() || null,
      };
      const response = await apiRequest("PUT", `/api/maps/${mapId}/details`, mapData);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Map updated",
        description: "Your changes have been saved.",
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
      queryClient.invalidateQueries({ queryKey: [`/api/maps/${data.shareUrl}`] });
      onCreated?.();
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't save changes",
        description: error.message || "Failed to update map",
        variant: "destructive",
      });
    },
  });

  const mutation = isEditing ? updateMapMutation : createMapMutation;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({
        title: "Name required",
        description: "Give your map a name to continue",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="mapName">Map name *</Label>
        <Input
          id="mapName"
          type="text"
          placeholder="e.g. Our favourite coffee spots"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          data-testid="input-map-name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="mapDescription">Description (optional)</Label>
        <Textarea
          id="mapDescription"
          placeholder="What brings this community together?"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
          data-testid="input-map-description"
        />
      </div>

      <Collapsible open={showNoteCustomization} onOpenChange={setShowNoteCustomization}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-1"
            data-testid="button-toggle-note-customization"
          >
            <span className="flex items-center gap-1.5">
              <MessageSquareText className="h-3.5 w-3.5" />
              Customize the pin note question
              <span className="text-xs font-normal text-muted-foreground/70">optional</span>
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${showNoteCustomization ? "rotate-180" : ""}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-3">
          <p className="text-xs text-muted-foreground -mt-1">
            Ask contributors something specific instead of a generic "Note" — e.g. "Favourite dish" with the
            prompt "What should people order here?"
          </p>
          <div className="space-y-2">
            <Label htmlFor="noteLabel">Note field label</Label>
            <Input
              id="noteLabel"
              type="text"
              placeholder="Note"
              value={formData.noteLabel}
              onChange={(e) => setFormData({ ...formData, noteLabel: e.target.value })}
              maxLength={60}
              data-testid="input-note-label"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notePrompt">Note prompt</Label>
            <Textarea
              id="notePrompt"
              placeholder="What makes this place worth pinning?"
              value={formData.notePrompt}
              onChange={(e) => setFormData({ ...formData, notePrompt: e.target.value })}
              rows={2}
              data-testid="input-note-prompt"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-submit-map-form">
        {isEditing ? (
          <>
            <Save className="h-4 w-4 mr-2" />
            {mutation.isPending ? "Saving..." : "Save changes"}
          </>
        ) : (
          <>
            <Plus className="h-4 w-4 mr-2" />
            {mutation.isPending ? "Creating..." : "Create map"}
          </>
        )}
      </Button>
    </form>
  );
}
