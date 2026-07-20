export interface PermissionRule {
  collection: string;
  action: "create" | "read" | "update" | "delete";
  filter?: Record<string, unknown>;
  fields?: string[];
}

export interface PolicyDefinition {
  name: string;
  icon: string;
  description: string;
  adminAccess: boolean;
  appAccess: boolean;
  /** When set, a matching Role is created and linked to this Policy. */
  role?: { icon: string };
  rules: PermissionRule[];
}
