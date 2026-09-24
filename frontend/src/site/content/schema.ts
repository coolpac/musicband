/**
 * Editor schema: every site section describes its own editable fields.
 * The admin "Сайт" mode renders forms generically from these descriptors,
 * so a section owns its content type, defaults and editor in ONE file
 * (see ./sections/*.ts) and the admin never hardcodes section shapes.
 *
 * `key` is a property name of the object the field list describes.
 */

interface FieldBase {
  key: string;
  label: string;
  /** Short helper shown under the control (recommended size, format, where it appears). */
  hint?: string;
}

export interface TextField extends FieldBase {
  kind: 'text' | 'url' | 'tel' | 'email';
  placeholder?: string;
  maxLength?: number;
}

export interface TextareaField extends FieldBase {
  kind: 'textarea';
  rows?: number;
  maxLength?: number;
  placeholder?: string;
}

/** Value: RemoteImage | null. null = use the image bundled with the site. */
export interface ImageField extends FieldBase {
  kind: 'image';
}

export interface ToggleField extends FieldBase {
  kind: 'toggle';
}

/** Value: string[] — one item per line in the editor (repertoire tracks, time slots). */
export interface StringListField extends FieldBase {
  kind: 'stringList';
  maxItems?: number;
  itemPlaceholder?: string;
}

/** Value: nested object. */
export interface GroupField extends FieldBase {
  kind: 'group';
  fields: Field[];
}

/** Value: array of objects. */
export interface ListField extends FieldBase {
  kind: 'list';
  itemLabel: string;
  /** Property of an item used as its collapsed title in the editor. */
  titleKey?: string;
  fields: Field[];
  minItems?: number;
  maxItems?: number;
}

export type Field =
  | TextField
  | TextareaField
  | ImageField
  | ToggleField
  | StringListField
  | GroupField
  | ListField;

export interface SectionSchema {
  /** Must equal the section's key in SiteContent. */
  id: string;
  /** Russian title shown in the admin section list. */
  title: string;
  description?: string;
  fields: Field[];
}
