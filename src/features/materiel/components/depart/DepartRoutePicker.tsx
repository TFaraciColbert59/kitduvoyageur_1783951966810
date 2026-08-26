'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface DepartRoutePickerProps {
  routes: { id: number; name: string }[];
}

/** Sélecteur de randonnée du prochain départ : menu déroulant vers le préparateur. */
export function DepartRoutePicker({ routes }: DepartRoutePickerProps) {
  const router = useRouter();
  const [value, setValue] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setValue(id);
    if (id) {
      window.location.href = `/materiel/depart/none?route=${id}`;
    }
  };

  if (routes.length === 0) {
    return (
      <button
        type="button"
        onClick={() => router.push('/explorer')}
        className="glass-capsule-btn primary w-full justify-center"
      >
        <span>Choisir ma randonnée</span>
      </button>
    );
  }

  return (
    <div className="w-full">
      <select
        value={value}
        onChange={handleChange}
        aria-label="Choisir la randonnée à préparer"
        className="w-full h-11 rounded-xl bg-white/85 backdrop-blur-sm border border-white/80 text-sm font-semibold text-[#17402C] px-3  outline-none cursor-pointer focus:border-sage-500 focus:ring-2 focus:ring-sage-500/25 transition-all"
      >
        <option value="" disabled>
          Choisir ma randonnée…
        </option>
        {routes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <p className="mt-1.5 text-[11px] text-[#5A7064]">
        Sélectionnez une randonnée pour lancer sa préparation.
      </p>
    </div>
  );
}