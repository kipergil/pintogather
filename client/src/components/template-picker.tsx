import { Briefcase, Compass, Heart, Plane, Sparkles, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { MAP_TEMPLATES, type MapTemplate } from "@shared/templates";

const TEMPLATE_ICONS: Record<MapTemplate["icon"], typeof Plane> = {
  plane: Plane,
  compass: Compass,
  heart: Heart,
  briefcase: Briefcase,
  users: Users,
};

interface TemplatePickerProps {
  onSelect: (template: MapTemplate | null) => void;
}

/**
 * Shown before the create-map form so a new map never starts as a blank
 * "name your map" field. Picking a template just prefills the form's
 * initial values (see map-form.tsx) — nothing is persisted until the form
 * itself is submitted, and every field stays editable afterward.
 */
export function TemplatePicker({ onSelect }: TemplatePickerProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">What are you mapping?</h2>
        <p className="text-sm text-muted-foreground">Start from a template, or build your own from scratch.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {MAP_TEMPLATES.map((template) => {
          const Icon = TEMPLATE_ICONS[template.icon];
          return (
            <Card
              key={template.id}
              className="border-border cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30"
              onClick={() => onSelect(template)}
              data-testid={`card-template-${template.id}`}
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
              <p className="text-xs text-muted-foreground mt-0.5">A blank map — set it up your own way.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
