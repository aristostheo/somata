import { useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';
import { canonicalDestination } from './canonicalDestination';
/** Legacy visual-preview links now resolve to the same default app destinations. */
export function useTabAwareRouter() {
  const router = useRouter();
  return useMemo(() => ({
    ...router, push: ((href: Href, options?: Parameters<typeof router.push>[1]) => {
      const target = typeof href === 'string' ? canonicalDestination(href) : { ...href, pathname: canonicalDestination(href.pathname) };
      return router.push(target as Href, options);
    }) as typeof router.push
  }), [router]);
}
