'use client';

import React from 'react';
import CountryPageClient from './CountryPageClient';

interface PageProps {
  params: Promise<{ code: string }>;
}

export default function CountryPage({ params }: PageProps) {
  const { code } = React.use(params);
  return <CountryPageClient code={code} />;
}
