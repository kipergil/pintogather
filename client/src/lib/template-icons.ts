import { Briefcase, Compass, MapPin, Plane, Users } from "lucide-react";
import { PIN_ICON_COMPONENTS } from "@/components/pin-style-picker";
import type { TemplateIcon } from "@shared/enums";

/**
 * Card icon shown in the create-map template picker. TEMPLATE_ICON is a
 * superset of PIN_ICON (see shared/enums.ts) plus a few glyphs that read
 * better for a template category than an individual pin — reuses
 * PIN_ICON_COMPONENTS for the overlap rather than duplicating those mappings.
 */
export const TEMPLATE_ICON_COMPONENTS: Record<TemplateIcon, typeof MapPin> = {
  ...PIN_ICON_COMPONENTS,
  plane: Plane,
  compass: Compass,
  briefcase: Briefcase,
  users: Users,
};
