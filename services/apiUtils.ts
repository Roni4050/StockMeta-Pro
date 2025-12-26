
/**
 * Processes an array of items with a turbo concurrency controller.
 * Designed for high-speed batch execution and zero-friction recovery.
 */
export const processWithConcurrency = async <T, R>(
  items: T[],
  asyncFn: (item: T) => Promise<R>,
  limit: number,
  delayMs: number = 0
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  const activePromises: Set<Promise<void>> = new Set();
  let currentIndex = 0;

  const queueNext = async (): Promise<void> => {
    if (currentIndex >= items.length) return;

    const itemIndex = currentIndex++;
    const item = items[itemIndex];
    
    const promise = asyncFn(item)
      .then(result => {
        results[itemIndex] = result;
      })
      .catch((err) => {
        console.error(`Node ${itemIndex} execution failed:`, err);
      })
      .finally(async () => {
        activePromises.delete(promise);
        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs / 2 + (Math.random() * delayMs / 2)));
        }
        await queueNext();
      });
    
    activePromises.add(promise);
  };

  const initialBatchCount = Math.min(limit, items.length);
  const initialPromises = [];
  
  for (let i = 0; i < initialBatchCount; i++) {
      initialPromises.push(queueNext());
  }
  
  await Promise.all(initialPromises);

  while (activePromises.size > 0) {
    await Promise.race(activePromises);
  }

  return results;
};

/**
 * Ultra-Silent Resiliency Engine.
 * Handles rate limits and server overloads entirely in the background.
 * Updated: 404 errors no longer trigger retries to prevent hangs on invalid model IDs.
 */
export const retryWithBackoff = async <T>(
    asyncFn: () => Promise<T>,
    retries = 3, // Reduced retries for faster failure feedback
    delay = 1000,
    shouldRetry: (error: any) => boolean = (err) => {
        const status = err?.status || err?.error?.code;
        
        // DO NOT RETRY:
        // 404: Model not found (invalid configuration)
        // 401/403: Auth issues
        // 400: Bad request
        if (status === 404 || status === 401 || status === 403 || status === 400) return false;
        
        // RETRY:
        // 429: Rate limited
        // 5xx: Server errors
        // No status: Likely network connection / fetch failure
        return status === 429 || status >= 500 || !status || err.message?.includes('fetch') || err.message?.includes('network');
    }
): Promise<T> => {
    try {
        return await asyncFn();
    } catch (error: any) {
        if (retries > 0 && shouldRetry(error)) {
            const jitter = Math.random() * 500;
            const nextDelay = (error?.status === 429 ? delay * 4 : delay * 2) + jitter;
            
            console.debug(`Retrying after error: ${error.message || 'Unknown'}. Attempts left: ${retries}`);
            await new Promise(res => setTimeout(res, nextDelay));
            return retryWithBackoff(asyncFn, retries - 1, nextDelay, shouldRetry);
        } else {
            throw error;
        }
    }
};
