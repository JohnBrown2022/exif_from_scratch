import ui from '../../ui/ui.module.css';
import { Field } from '../../ui/Field';
import type { SettingsField } from '../../../core';

function shouldShowField(field: SettingsField, value: Record<string, unknown>): boolean {
  if (!field.showWhen) return true;
  return value[field.showWhen.key] === field.showWhen.equals;
}

function isFieldDisabled(field: SettingsField, value: Record<string, unknown>, disabled: boolean): boolean {
  if (disabled) return true;
  if (!field.disabledWhen) return false;
  return value[field.disabledWhen.key] === field.disabledWhen.equals;
}

function getString(value: Record<string, unknown>, key: string, fallback: string): string {
  const raw = value[key];
  return typeof raw === 'string' ? raw : fallback;
}

function getNumber(value: Record<string, unknown>, key: string, fallback: number): number {
  const raw = value[key];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback;
}

function getBoolean(value: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const raw = value[key];
  return typeof raw === 'boolean' ? raw : fallback;
}

type Props = {
  fields: SettingsField[];
  value: Record<string, unknown>;
  disabled?: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
};

export function SettingsFieldsForm({ fields, value, disabled = false, onPatch }: Props) {
  return (
    <>
      {fields.map((field) => {
        if (!shouldShowField(field, value)) return null;
        const fieldDisabled = isFieldDisabled(field, value, disabled);

        if (field.kind === 'slider') {
          const current = getNumber(value, field.key, field.default);
          return (
            <Field key={field.key} label={field.label} hint={field.hint}>
              <input
                className={ui.range}
                type="range"
                min={field.min}
                max={field.max}
                step={field.step}
                value={current}
                disabled={fieldDisabled}
                onChange={(e) => onPatch({ [field.key]: Number(e.target.value) })}
              />
            </Field>
          );
        }

        if (field.kind === 'toggle') {
          const current = getBoolean(value, field.key, field.default);
          return (
            <Field key={field.key} label={field.label} hint={field.hint}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={current}
                  disabled={fieldDisabled}
                  onChange={(e) => onPatch({ [field.key]: e.target.checked })}
                />
                <span>{current ? '开' : '关'}</span>
              </label>
            </Field>
          );
        }

        if (field.kind === 'select') {
          const current = getString(value, field.key, field.default);
          return (
            <Field key={field.key} label={field.label} hint={field.hint}>
              <select
                className={ui.control}
                value={current}
                disabled={fieldDisabled}
                onChange={(e) => onPatch({ [field.key]: e.target.value })}
              >
                {field.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>
          );
        }

        const current = getString(value, field.key, field.default);
        return (
          <Field key={field.key} label={field.label} hint={field.hint}>
            <input
              className={ui.control}
              type="text"
              value={current}
              disabled={fieldDisabled}
              placeholder={field.placeholder}
              onChange={(e) => onPatch({ [field.key]: e.target.value })}
            />
          </Field>
        );
      })}
    </>
  );
}

