'use client';
import React, { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export default function ReactQueryProvider({ children }: { children: ReactNode }) {
  // Create a new QueryClient instance on the client side to avoid
  // passing a class instance from a server component.
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
