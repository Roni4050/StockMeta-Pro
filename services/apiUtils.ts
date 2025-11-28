

/**
 * Processes an array of items with a limited number of concurrent async operations.
 * @param items The array of items to process.
 * @param asyncFn The async function to apply to each item.
 * @param limit The concurrency limit.
 * @param delayMs Optional delay in milliseconds to wait between starting item processing (throttle).
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
      .finally(async () => {
        activePromises.delete(promise);
        // Throttle the start of the next item in the queue
        if (delayMs > 0) {
             await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        queueNext();
      });
    
    activePromises.add(promise);
  };

  // Start the initial batch.
  const initialPromises = [];
  for (let i = 0; i < Math.min(limit, items.length); i++) {
      initialPromises.push(queueNext());
      // Stagger the start of initial batch as well if needed
      if (limit > 1 && delayMs > 0) {
           await new Promise(resolve => setTimeout(resolve, delayMs));
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
 * @param asyncFn The async function to retry.
 * @param retries Maximum number of retries.
 * @param delay Initial delay in ms.
 * @param shouldRetry A function to determine if an error is retryable.
 */
export const retryWithBackoff = async <T>(
    asyncFn: () => Promise<T>,
    retries = 3,
    delay = 2000,
    shouldRetry: (error: any) => boolean = () => true
): Promise<T> => {
    try {
        return await asyncFn();
    } catch (error) {
        if (retries > 0 && shouldRetry(error)) {
            console.warn(`Attempt failed. Retrying in ${delay}ms... (${retries} retries left)`);
            await new Promise(res => setTimeout(res, delay));
            return retryWithBackoff(asyncFn, retries - 1, delay * 2, shouldRetry);
        } else {
            throw error;
        }
    }
};