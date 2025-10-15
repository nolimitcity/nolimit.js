const MAX_RETRIES = 4;
const RETRY_DELAY_MS = 250;

export async function fetchRetry(input, init) {
    let retryLeft = MAX_RETRIES;

    while (retryLeft > 0){
        try {
            return await fetch(input, init);
        }
        catch (err) {
            await sleep(RETRY_DELAY_MS)
        }
        finally {
            retryLeft -= 1;
        }
    }
    throw new Error("Failed to load flobby - max retries");
}

function sleep(delay){
    return new Promise((resolve) => setTimeout(resolve, delay));
}