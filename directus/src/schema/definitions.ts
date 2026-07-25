import {
  CURATED_CATEGORY,
  CURATED_CITY_BY_COUNTRY,
  CURATED_COUNTRY,
  INVITATION_STATUS,
  MAP_VIEWER_ROLE,
  PERMISSION,
  PIN_COLOR,
  PIN_ICON,
  USER_GROUP,
} from "../../../shared/enums.js";
import {
  booleanField,
  cascadingSelectField,
  dateCreatedField,
  dateField,
  decimalField,
  idField,
  integerField,
  m2o,
  richTextField,
  selectField,
  textField,
} from "./presets.js";
import type { CollectionDefinition, FieldDefinition } from "./types.js";

/**
 * Custom fields bolted onto the built-in `directus_users` collection. Not a
 * `CollectionDefinition` (directus_users already exists) — applied directly
 * by apply.ts as base fields on an existing collection.
 */
export const directusUsersCustomFields: FieldDefinition[] = [
  textField("clerk_user_id", { unique: true, nullable: true, note: "Clerk user id (external identity)." }),
  textField("avatar_url", { nullable: true, note: "OAuth avatar URL from Clerk." }),
  textField("full_name", { nullable: true }),
  textField("username", {
    unique: true,
    nullable: true,
    maxLength: 30,
    note: "Public profile handle, e.g. /u/<username>. Null until the user claims one.",
  }),
  richTextField("bio", { nullable: true, note: "Short bio shown on the public profile page." }),
  textField("twitter_handle", { nullable: true }),
  textField("instagram_handle", { nullable: true }),
  textField("linkedin_handle", { nullable: true }),
  selectField("user_group", USER_GROUP, { defaultValue: "freemium", nullable: false }),
  booleanField("is_admin", false, "Grants access to the admin panel."),
  textField("stripe_customer_id", {
    unique: true,
    nullable: true,
    note: "Stripe Customer id, set on first checkout.",
  }),
  textField("stripe_subscription_id", { nullable: true, note: "Stripe Subscription id for the current/most recent subscription." }),
  textField("stripe_subscription_status", {
    nullable: true,
    note: "Stripe subscription status (active/past_due/canceled/...) — user_group is the actual tier gate.",
  }),
  integerField("ai_suggestions_used_today", {
    defaultValue: 0,
    nullable: false,
    note: "AI venue-suggestion calls used on ai_suggestions_reset_at's date; rolls over to 0 on a new UTC day.",
  }),
  textField("ai_suggestions_reset_at", {
    nullable: true,
    maxLength: 10,
    note: "UTC date (YYYY-MM-DD) ai_suggestions_used_today was last reset for.",
  }),
];

const mapOwner = m2o("map_collections", "owner", "directus_users", {
  nullable: true,
  template: "{{first_name}} {{last_name}}",
  oneField: "owned_maps",
  onDelete: "SET NULL",
});

export const mapCollectionsCollection: CollectionDefinition = {
  collection: "map_collections",
  icon: "map",
  note: "A named, shareable container for pins.",
  displayTemplate: "{{name}}",
  fields: [
    idField(),
    textField("name", { required: true, unique: true }),
    richTextField("description", { nullable: true }),
    textField("share_url", { required: true, unique: true }),
    booleanField("is_public", false),
    selectField("default_permission", PERMISSION, { defaultValue: "readonly", nullable: false }),
    textField("note_label", {
      nullable: true,
      maxLength: 60,
      note: "Custom label for the pin note field, e.g. 'Favourite dish'. Falls back to \"Note\" when empty.",
    }),
    richTextField("note_prompt", {
      nullable: true,
      note: "Custom question/prompt shown under the note label, e.g. 'What should people order here?'.",
    }),
    textField("branding_logo_url", {
      nullable: true,
      maxLength: 500,
      note: "Optional custom logo shown instead of PinTogather branding on this map's public /p/:shareUrl page.",
    }),
    booleanField(
      "show_on_profile",
      false,
      "Whether this map appears on the owner's public profile page (/u/:username). Independent of is_public/default_permission, which govern anonymous edit access via the share link.",
    ),
    booleanField(
      "archived",
      false,
      "Soft-hide: excluded from the owner's home-page map list and public profile, but the map and its pins are untouched and still reachable via its share link. Basic/Premium only.",
    ),
    selectField("default_pin_color", PIN_COLOR, {
      nullable: true,
      note: "Default marker color for this map's pins (Basic/Premium only). Falls back to the app default (blue) when empty. A pin's own pin_color overrides this.",
    }),
    selectField("default_pin_icon", PIN_ICON, {
      nullable: true,
      note: "Default marker icon glyph for this map's pins (Basic/Premium only). Falls back to a plain pin when empty. A pin's own pin_icon overrides this.",
    }),
    booleanField(
      "curated",
      false,
      "Whether this map appears on the public /discover page. Admin-managed — set directly here in Directus, never through the app's own map forms.",
    ),
    selectField("curated_category", CURATED_CATEGORY, {
      nullable: true,
      note: "Discover-page theme category. Only meaningful when curated is true.",
    }),
    selectField("curated_country", CURATED_COUNTRY, {
      nullable: true,
      note: "Discover-page country. Set this before curated_city — curated_city's choices narrow to this country's cities.",
    }),
    cascadingSelectField("curated_city", CURATED_CITY_BY_COUNTRY, "curated_country", {
      nullable: true,
      note: "Discover-page city — choices narrow once curated_country is set above.",
    }),
    integerField("curated_order", {
      nullable: true,
      note: "Display order among curated maps; also determines which 3 freemium/anonymous visitors see on /discover. Lower shows first.",
    }),
    richTextField("curated_tagline", {
      nullable: true,
      note: "Short editorial blurb shown on the Discover card, distinct from this map's own owner-written description.",
    }),
    dateCreatedField(),
  ],
  relationFields: [mapOwner],
};

const pinMap = m2o("pins", "map", "map_collections", {
  required: true,
  nullable: false,
  template: "{{name}}",
  oneField: "pins",
  onDelete: "CASCADE",
});
const pinUser = m2o("pins", "user", "directus_users", {
  nullable: true,
  template: "{{first_name}} {{last_name}}",
  oneField: "pins",
  onDelete: "SET NULL",
});

export const pinsCollection: CollectionDefinition = {
  collection: "pins",
  icon: "location_on",
  note: "A single geographic marker with contributor metadata, belonging to one map.",
  displayTemplate: "{{user_name}}",
  fields: [
    idField(),
    textField("user_name", { required: true }),
    decimalField("latitude", { precision: 10, scale: 8, nullable: false }),
    decimalField("longitude", { precision: 11, scale: 8, nullable: false }),
    textField("address", { nullable: true }),
    textField("city", { nullable: true }),
    textField("state", { nullable: true }),
    textField("town", { nullable: true }),
    textField("borough", { nullable: true }),
    textField("postcode", { nullable: true }),
    textField("country", { nullable: true }),
    textField("twitter_handle", { nullable: true }),
    textField("instagram_handle", { nullable: true }),
    textField("linkedin_handle", { nullable: true }),
    richTextField("note", { nullable: true }),
    textField("google_maps_url", {
      nullable: true,
      maxLength: 2048,
      note: "Link to this venue on Google Maps, captured at import/creation time.",
    }),
    booleanField("approved", true, "Pins added by anyone other than the map owner start unapproved and are hidden until the owner approves them."),
    selectField("pin_color", PIN_COLOR, {
      nullable: true,
      note: "Per-pin marker color override (Basic/Premium map owners only). Overrides the map's default_pin_color when set.",
    }),
    selectField("pin_icon", PIN_ICON, {
      nullable: true,
      note: "Per-pin marker icon glyph override (Basic/Premium map owners only). Overrides the map's default_pin_icon when set.",
    }),
    dateCreatedField(),
  ],
  relationFields: [pinMap, pinUser],
};

const viewerMap = m2o("map_viewers", "map", "map_collections", {
  required: true,
  nullable: false,
  template: "{{name}}",
  oneField: "viewers",
  onDelete: "CASCADE",
});
const viewerUser = m2o("map_viewers", "user", "directus_users", {
  required: true,
  nullable: false,
  template: "{{first_name}} {{last_name}}",
  oneField: "map_viewer_entries",
  onDelete: "CASCADE",
});

export const mapViewersCollection: CollectionDefinition = {
  collection: "map_viewers",
  icon: "group",
  note: "Grants one user a role/permission on one map. Unique per (map, user).",
  displayTemplate: "{{role}} — {{permission}}",
  fields: [
    idField(),
    selectField("role", MAP_VIEWER_ROLE, { defaultValue: "viewer", nullable: false }),
    selectField("permission", PERMISSION, { defaultValue: "readonly", nullable: false }),
    dateCreatedField(),
  ],
  relationFields: [viewerMap, viewerUser],
};

const invitationMap = m2o("map_invitations", "map", "map_collections", {
  required: true,
  nullable: false,
  template: "{{name}}",
  oneField: "invitations",
  onDelete: "CASCADE",
});
const invitationInvitedBy = m2o("map_invitations", "invited_by", "directus_users", {
  nullable: true,
  template: "{{first_name}} {{last_name}}",
  onDelete: "SET NULL",
});

export const mapInvitationsCollection: CollectionDefinition = {
  collection: "map_invitations",
  icon: "mail",
  note: "A pending email invitation to view/edit a map.",
  displayTemplate: "{{email}} — {{status}}",
  fields: [
    idField(),
    textField("email", { required: true }),
    selectField("permission", PERMISSION, { defaultValue: "readonly", nullable: false }),
    selectField("status", INVITATION_STATUS, { defaultValue: "pending", nullable: false }),
    textField("token", { required: true, unique: true }),
    dateField("expires_at", { nullable: false }),
    dateCreatedField(),
  ],
  relationFields: [invitationMap, invitationInvitedBy],
};

export const allCollections: CollectionDefinition[] = [
  mapCollectionsCollection,
  pinsCollection,
  mapViewersCollection,
  mapInvitationsCollection,
];
