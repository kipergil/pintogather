import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { Plus } from "lucide-react";

interface CreateMapFormData {
  name: string;
  description: string;
}

interface CreateMapFormProps {
  onCreated?: () => void;
}

export function CreateMapForm({ onCreated }: CreateMapFormProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [formData, setFormData] = useState<CreateMapFormData>({
    name: "",
    description: "",
  });

  const createMapMutation = useMutation({
    mutationFn: async (data: CreateMapFormData) => {
      const mapData = {
        ...data,
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
    createMapMutation.mutate(formData);
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
          autoFocus
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

      <Button
        type="submit"
        className="w-full"
        disabled={createMapMutation.isPending}
        data-testid="button-submit-create-map"
      >
        <Plus className="h-4 w-4 mr-2" />
        {createMapMutation.isPending ? "Creating..." : "Create map"}
      </Button>
    </form>
  );
}
