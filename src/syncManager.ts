import { runCliCommand } from "./cli";
import { SYNC_INTERVAL } from "./config";

export function startAutoSync(context: any): void {
    const syncInterval = setInterval(async () => {
        try {
            await runCliCommand(['sync']);
        } catch (error) {
            console.error(`Failed to sync data: ${error}`);
        }
    }, SYNC_INTERVAL);

    context.subscriptions.push({
        dispose() {
            clearInterval(syncInterval);

            runCliCommand(['sync'])
            .then(() => console.log("Final sync completed successfully"))
            .catch((error) => console.error(`Final sync failed: ${error}`));
        }
    });
}
