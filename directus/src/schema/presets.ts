import type { FieldDefinition, RelationDefinition } from "./types.js";

export function idField(): FieldDefinition {
  return {
    field: "id",
    type: "uuid",
    meta: { interface: "input", readonly: true, hidden: true, special: ["uuid"] },
    schema: { is_primary_key: true, has_auto_increment: false, is_nullable: false },
  };
}

export function dateCreatedField(): FieldDefinition {
  return {
    field: "date_created",
    type: "timestamp",
    meta: {
      special: ["date-created"],
      interface: "datetime",
      readonly: true,
      hidden: true,
      width: "half",
    },
    schema: { is_nullable: true },
  };
}

export interface M2OOptions {
  required?: boolean;
  nullable?: boolean;
  note?: string;
  template?: string;
  /** Alias field name to create on the related collection for the reverse O2M list. */
  oneField?: string;
  onDelete?: RelationDefinition["onDelete"];
}

/** A many-to-one field + its relation, e.g. `pins.map -> map_collections`. */
export function m2o(
  collection: string,
  field: string,
  relatedCollection: string,
  opts: M2OOptions = {},
): { field: FieldDefinition; relation: RelationDefinition } {
  return {
    field: {
      field,
      type: "uuid",
      meta: {
        interface: "select-dropdown-m2o",
        special: ["m2o"],
        required: opts.required ?? false,
        note: opts.note,
        width: "half",
        options: opts.template ? { template: opts.template } : undefined,
        display: "related-values",
      },
      schema: { is_nullable: opts.nullable ?? true },
    },
    relation: {
      collection,
      field,
      related_collection: relatedCollection,
      oneField: opts.oneField,
      onDelete: opts.onDelete ?? "SET NULL",
    },
  };
}

export function textField(
  field: string,
  opts: {
    required?: boolean;
    nullable?: boolean;
    note?: string;
    maxLength?: number;
    interface?: string;
    unique?: boolean;
    defaultValue?: string;
  } = {},
): FieldDefinition {
  return {
    field,
    type: "string",
    meta: {
      interface: opts.interface ?? "input",
      required: opts.required ?? false,
      note: opts.note,
      width: "full",
    },
    schema: {
      is_nullable: opts.nullable ?? !opts.required,
      max_length: opts.maxLength ?? 255,
      is_unique: opts.unique ?? false,
      default_value: opts.defaultValue ?? null,
    },
  };
}

export function richTextField(
  field: string,
  opts: { note?: string; nullable?: boolean } = {},
): FieldDefinition {
  return {
    field,
    type: "text",
    meta: { interface: "input-multiline", note: opts.note },
    schema: { is_nullable: opts.nullable ?? true },
  };
}

export function booleanField(field: string, defaultValue: boolean, note?: string): FieldDefinition {
  return {
    field,
    type: "boolean",
    meta: { interface: "boolean", note, width: "half" },
    schema: { default_value: defaultValue, is_nullable: false },
  };
}

export function decimalField(
  field: string,
  opts: { precision?: number; scale?: number; nullable?: boolean; note?: string } = {},
): FieldDefinition {
  return {
    field,
    type: "decimal",
    meta: { interface: "input", note: opts.note, width: "half" },
    schema: {
      is_nullable: opts.nullable ?? true,
      numeric_precision: opts.precision ?? 12,
      numeric_scale: opts.scale ?? 8,
    },
  };
}

export function dateField(
  field: string,
  opts: { nullable?: boolean; note?: string } = {},
): FieldDefinition {
  return {
    field,
    type: "timestamp",
    meta: { interface: "datetime", note: opts.note, width: "half" },
    schema: { is_nullable: opts.nullable ?? true },
  };
}

export function selectField(
  field: string,
  choices: readonly string[],
  opts: { defaultValue?: string; nullable?: boolean; note?: string } = {},
): FieldDefinition {
  return {
    field,
    type: "string",
    meta: {
      interface: "select-dropdown",
      options: { choices: choices.map((value) => ({ text: value, value })) },
      display: "labels",
      note: opts.note,
      width: "half",
    },
    schema: {
      default_value: opts.defaultValue ?? null,
      is_nullable: opts.nullable ?? true,
      max_length: 32,
    },
  };
}
