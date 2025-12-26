
/**
 * Processes an array of items with a dynamic concurrency controller.
 * Designed for ultra-smooth batch execution and silent recovery.
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
      .catch(err => {
        // Silent error logging - the system will handle retry at a higher level
        console.warn(`Node ${itemIndex} encountered a transient issue, shifting context...`);
      })
      .finally(async () => {
        activePromises.delete(promise);
        // Subtle pacing to prevent API thundering-herd effects
        if (delayMs > 0) {
             await new Promise(resolve => setTimeout(resolve, delayMs + (Math.random() * 200)));
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
 * Enhanced Silent Retry with Jitter.
 * Prevents 429/500 errors from breaking the user flow.
 */
export const retryWithBackoff = async <T>(
    asyncFn: () => Promise<T>,
    retries = 5, // Increased retries for "Super Smooth" experience
    delay = 1500,
    shouldRetry: (error: any) => boolean = (err) => {
        const status = err?.status;
        // Retry on rate limits, server overloads, and mysterious 404s
        return status === 429 || status >= 500 || status === 404 || !status;
    }
): Promise<T> => {
    try {
        return await asyncFn();
    } catch (error: any) {
        if (retries > 0 && shouldRetry(error)) {
            // Add jitter: random variation to prevent synchronized retries
            const jitter = Math.random() * 1000;
            const nextDelay = (error?.status === 429 ? delay * 4 : delay * 2) + jitter;
            
            console.debug(`[Resiliency Engine] Silent retry in ${Math.round(nextDelay)}ms...`);
            await new Promise(res => setTimeout(res, nextDelay));
            return retryWithBackoff(asyncFn, retries - 1, nextDelay, shouldRetry);
        } else {
            throw error;
        }
    }
};
