'use client';

import { useEffect, useState } from 'react';
import { hasNativeDatePicker, presentNativeDate } from '@/lib/native/ui';

interface NativeDateFieldProps {
  id: string;
  title: string;
  value: string;
  onChange: (date: string) => void;
  className?: string;
  required?: boolean;
}

/** One visible control: a real SwiftUI DatePicker on updated iOS shells,
 * the browser/Android OS date field in all other environments. */
export default function NativeDateField({ id, title, value, onChange, className, required }: NativeDateFieldProps) {
  const [nativeReady, setNativeReady] = useState(false);

  useEffect(() => {
    let active = true;
    void hasNativeDatePicker().then((ready) => {
      if (active) setNativeReady(ready);
    });
    return () => { active = false; };
  }, []);

  async function chooseDate() {
    const chosen = await presentNativeDate(title, value);
    if (chosen === undefined) {
      // An older shell or temporary native bridge failure: restore HTML date input.
      setNativeReady(false);
    } else if (chosen !== null) {
      onChange(chosen);
    }
  }

  if (nativeReady) {
    return (
      <button
        id={id}
        type="button"
        onClick={() => { void chooseDate(); }}
        className={className}
        aria-label={required ? `${title} (obligatoire)` : title}
        data-testid="lkdv-native-date"
      >
        {value || 'Choisir une date'}
      </button>
    );
  }

  return (
    <input
      id={id}
      type="date"
      value={value}
      required={required}
      onChange={(event) => onChange(event.target.value)}
      className={className}
      data-testid="lkdv-web-date"
    />
  );
}
