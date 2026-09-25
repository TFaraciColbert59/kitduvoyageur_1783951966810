import { notFound } from 'next/navigation';

export default function ApercuPreparationPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <div className="p-8 text-center">
      <h1 className="text-xl font-bold">Aperçu Préparation (Dev Sandbox)</h1>
      <p className="text-sm opacity-70">Réservé au développement local.</p>
    </div>
  );
}
