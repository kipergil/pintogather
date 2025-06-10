import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus } from "lucide-react";

interface CreateMapFormData {
  name: string;
  description: string;
}

export function CreateMapForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState<CreateMapFormData>({
    name: "",
    description: "",
  });

  const createMapMutation = useMutation({
    mutationFn: async (data: CreateMapFormData) => {
      const response = await apiRequest("POST", "/api/maps", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Map collection created successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/maps"] });
      setLocation(`/map/${data.shareUrl}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create map collection",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Map collection name is required",
        variant: "destructive",
      });
      return;
    }
    createMapMutation.mutate(formData);
  };

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-xl font-semibold text-neutral-900 mb-6">Create New Map Collection</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mapName">Map Collection Name *</Label>
            <Input
              id="mapName"
              type="text"
              placeholder="Enter map collection name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="mapDescription">Description (Optional)</Label>
            <Textarea
              id="mapDescription"
              placeholder="Describe your map collection"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <Button 
            type="submit" 
            className="w-full"
            disabled={createMapMutation.isPending}
          >
            <Plus className="h-4 w-4 mr-2" />
            {createMapMutation.isPending ? "Creating..." : "Create Map Collection"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
