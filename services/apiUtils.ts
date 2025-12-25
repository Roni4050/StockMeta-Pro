
/**
 * Processes an array of items with a limited number of concurrent async operations.
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
    if (currentIndex >= items.length) {
      return;
    }

    const itemIndex = currentIndex++;
    const item = items[itemIndex];
    
    const promise = asyncFn(item)
      .then(result => {
        results[itemIndex] = result;
      })
      .catch(err => {
        console.error(`Error processing item ${itemIndex}:`, err);
      })
      .finally(async () => {
        activePromises.delete(promise);
        if (delayMs > 0) {
             await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        await queueNext();
      });
    
    activePromises.add(promise);
  };

  const initialPromises = [];
  const initialBatchCount = Math.min(limit, items.length);
  
  for (let i = 0; i < initialBatchCount; i++) {
      initialPromises.push(queueNext());
      if (initialBatchCount > 1 && delayMs > 0) {
           await new Promise(resolve => setTimeout(resolve, delayMs / initialBatchCount));
      }
  }
  
  await Promise.all(initialPromises);

  while (activePromises.size > 0) {
    await Promise.race(activePromises);
  }

  return results;
};

/**
 * Retries an async function with exponential backoff.
 */
export const retryWithBackoff = async <T>(
    asyncFn: () => Promise<T>,
    retries = 3,
    delay = 2000,
    shouldRetry: (error: any) => boolean = (err) => {
        // Retry on 429 (Rate limit) and 500+ (Server error)
        const status = err?.status;
        return status === 429 || status >= 500 || !status;
    }
): Promise<T> => {
    try {
        return await asyncFn();
    } catch (error: any) {
        if (retries > 0 && shouldRetry(error)) {
            const nextDelay = error?.status === 429 ? delay * 3 : delay * 2;
            console.warn(`Retry attempt triggered. Backing off for ${nextDelay}ms... (${retries} left)`);
            await new Promise(res => setTimeout(res, nextDelay));
            return retryWithBackoff(asyncFn, retries - 1, nextDelay, shouldRetry);
        } else {
            throw error;
        }
    }
};
