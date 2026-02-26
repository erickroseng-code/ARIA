'use client';

import { useEffect, useState, ReactNode } from 'react';

interface HydrationSafeWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Wrapper that prevents hydration mismatches by only rendering content on client
 * This is useful for components that depend on client-only values like:
 * - crypto.randomUUID()
 * - new Date()
 * - window/localStorage/sessionStorage
 * - Dynamic client state
 */
export function HydrationSafeWrapper({ children, fallback }: HydrationSafeWrapperProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return fallback || null;
  }

  return <>{children}</>;
}
