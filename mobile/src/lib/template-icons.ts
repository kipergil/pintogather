import { PIN_ICON_IONICON, type IoniconsName } from "./pin-styles";
import type { TemplateIcon } from "../../../shared/enums";

/**
 * Card icon shown in the create-map template picker. TEMPLATE_ICON is a
 * superset of PIN_ICON (see shared/enums.ts) plus a few glyphs that read
 * better for a template category than an individual pin — reuses
 * PIN_ICON_IONICON for the overlap rather than duplicating those mappings.
 */
export const TEMPLATE_ICON_IONICON: Record<TemplateIcon, IoniconsName> = {
  ...PIN_ICON_IONICON,
  plane: "airplane-outline",
  compass: "compass-outline",
  briefcase: "briefcase-outline",
  users: "people-outline",
};
