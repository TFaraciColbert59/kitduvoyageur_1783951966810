'use client';

import { useEffect, useState } from 'react';
import { hasNativeChoices, presentNativeChoices, type NativeChoice } from '@/lib/native/ui';

type NativeSelectProps = {
  id: string;
  label: string;
  options: NativeChoice[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
};

/** Only one visible control: SwiftUI searchable list on capable iOS,
 * accessible HTML select everywhere else. Business state stays in Next.js. */
export default function NativeSelect({ id, label, options, value, onChange, className, disabled, required }: NativeSelectProps) {
  const [nativeReady, setNativeReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    void hasNativeChoices().then((ready) => {
      if (mounted) setNativeReady(ready);
    });
    return () => { mounted = false; };
  }, []);

  const selected = options.find((option) => option.id === value);
  async function choose() {
    const result = await presentNativeChoices({ title: label, options, selectedId: value });
    if (result === undefined) {
      setNativeReady(false);
    } else if (result !== null) {
      onChange(result);
    }
  }

  if (nativeReady && options.length > 0) {
    return (
      <button
        type="button"
        id={id}
        aria-label={required ? `${label} (obligatoire)` : label}
        aria-haspopup="dialog"
        disabled={disabled}
        className={className}
        onClick={() => { void choose(); }}
        data-testid="lkdv-native-select"
      >
        {selected?.title ?? 'Choisir'}
      </button>
    );
  }

  return (
    <select
      id={id}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      disabled={disabled}
      required={required}
      data-testid="lkdv-web-select"
    >
      {options.map(({ id: optionId, title }) => (
        <option key={optionId} value={optionId}>{title}</option>
      ))}
    </select>
  );
}
