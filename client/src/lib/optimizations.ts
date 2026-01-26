import { lazy, useMemo, useCallback, useRef, useEffect } from 'react';

// Code splitting for heavy components
export const LazyManuscriptEditor = lazy(
  () => import('../components/editor/ManuscriptEditor').then(m => ({ default: m.ManuscriptEditor }))
);

export const LazyChatPanel = lazy(
  () => import('../components/chat/ChatPanel').then(m => ({ default: m.ChatPanel }))
);

export const LazySourcesManager = lazy(
  () => import('../components/sources/SourcesManager').then(m => ({ default: m.SourcesManager }))
);

export const LazySummaryEditor = lazy(
  () => import('../components/summary/SummaryEditor').then(m => ({ default: m.SummaryEditor }))
);

// Memoized word count computation
export function useWordCount(content: string): number {
  return useMemo(() => {
    if (!content) return 0;
    return content
      .split(/\s+/)
      .filter(word => word.length > 0)
      .length;
  }, [content]);
}

// Debounced callback hook
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 1000
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);

  // Update callback ref on each render
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    }) as T,
    [delay]
  );
}

// Throttled callback hook
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  limit: number = 1000
): T {
  const lastRanRef = useRef<number>(0);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastRanRef.current >= limit) {
        lastRanRef.current = now;
        callbackRef.current(...args);
      }
    }) as T,
    [limit]
  );
}

// Hook for intersection observer (lazy loading)
export function useIntersectionObserver(
  ref: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
): boolean {
  const isIntersectingRef = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      isIntersectingRef.current = entry.isIntersecting;
    }, options);

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [ref, options.threshold, options.root, options.rootMargin]);

  return isIntersectingRef.current;
}

// Local storage hook with SSR safety
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const readValue = useCallback((): T => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  }, [key, initialValue]);

  const storedValue = useMemo(() => readValue(), [readValue]);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        const newValue = value instanceof Function ? value(readValue()) : value;
        window.localStorage.setItem(key, JSON.stringify(newValue));
        window.dispatchEvent(new Event('local-storage'));
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, readValue]
  );

  return [storedValue, setValue];
}

// Preload images
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

// Batch updates for performance
export function batchUpdates<T>(
  items: T[],
  processFn: (item: T) => void,
  batchSize: number = 10,
  delay: number = 0
): Promise<void> {
  return new Promise((resolve) => {
    let index = 0;

    function processBatch() {
      const end = Math.min(index + batchSize, items.length);

      for (; index < end; index++) {
        processFn(items[index]);
      }

      if (index < items.length) {
        setTimeout(processBatch, delay);
      } else {
        resolve();
      }
    }

    processBatch();
  });
}
