import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useMapTemplates } from "@/hooks/useMapTemplates";
import { TEMPLATE_ICON_COMPONENTS } from "@/lib/template-icons";
import type { MapTemplate } from "@shared/schema";

interface TemplatePickerProps {
  onSelect: (template: MapTemplate | null) => void;
}

/**
 * Shown before the create-map form so a new map never starts as a blank
 * "name your map" field. Picking a template just prefills the form's
 * initial values (see map-form.tsx) — nothing is persisted until the form
 * itself is submitted, and every field stays editable afterward. Templates
 * are authored in Directus (see GET /api/map-templates), not hardcoded here.
 */
export function TemplatePicker({ onSelect }: TemplatePickerProps) {
  const { data: templates, isLoading } = useMapTemplates();

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">What are you mapping?</h2>
        <p className="text-sm text-muted-foreground">Start blank, or use one of the templates below as a starting point.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card
          className="border-dashed border-border cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30"
          onClick={() => onSelect(null)}
          data-testid="card-template-scratch"
        >
          <CardContent className="p-4 flex gap-3">
            <div className="h-9 w-9 shrink-0 rounded-lg bg-muted flex items-center justify-center">
              <Sparkles className="h-4.5 w-4.5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <div className="font-medium text-foreground">Start from scratch</div>
              <p className="text-xs text-muted-foreground mt-0.5">Start from scratch — set it up your own way.</p>
            </div>
          </CardContent>
        </Card>

        {isLoading
          ? [...Array(4)].map((_, i) => (
              <Card key={i} className="border-border">
                <CardContent className="p-4 flex gap-3 animate-pulse">
                  <div className="h-9 w-9 shrink-0 rounded-lg bg-muted" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-2/3" />
                    <div className="h-3 bg-muted rounded w-full" />
                  </div>
                </CardContent>
              </Card>
            ))
          : templates?.map((template) => {
              const Icon = TEMPLATE_ICON_COMPONENTS[template.icon];
              return (
                <Card
                  key={template.id}
                  className="border-border cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30"
                  onClick={() => onSelect(template)}
                  data-testid={`card-template-${template.key}`}
                >
                  <CardContent className="p-4 flex gap-3">
                    <div className="h-9 w-9 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-foreground">{template.label}</div>
                      <p className="text-xs text-muted-foreground mt-0.5">{template.tagline}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </div>
    </div>
  );
}
