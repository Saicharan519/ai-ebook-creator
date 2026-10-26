import { createApp } from "./app";
import { prisma } from "./lib/db";
import { env } from "./lib/env";
import { createLlmProvider } from "./lib/llm";
import { logger } from "./lib/logger";
import { PgBossMemoryQueue } from "./modules/memory/memory-queue";

const llm = createLlmProvider();

// Story Memory needs a model; without one the app still works, just without memory
const memoryQueue = llm
  ? await PgBossMemoryQueue.start({
      connectionString: env.DATABASE_URL,
      llm,
      debounceSeconds: env.MEMORY_DEBOUNCE_SECONDS,
    })
  : undefined;

const server = createApp({ llm, memoryQueue }).listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${env.PORT}`);
});

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close(async () => {
    await memoryQueue?.stop();
    await prisma.$disconnect();
    process.exit(0);
  });
  // Don't hang forever if connections refuse to close
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
