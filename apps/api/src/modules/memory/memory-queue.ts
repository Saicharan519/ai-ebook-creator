import { PgBoss } from "pg-boss";
import type { LlmProvider } from "../../lib/llm";
import { logger } from "../../lib/logger";
import { processChapterMemory } from "./pipeline";

/** Schedules Story Memory updates. The routes only see this interface. */
export interface MemoryQueue {
  /** Debounced: a burst of saves to one chapter becomes a single job */
  enqueueChapter(chapterId: string): Promise<void>;
}

/** For tests, and for servers without AI configured. */
export const noopMemoryQueue: MemoryQueue = { enqueueChapter: async () => {} };

const QUEUE = "chapter-memory";

/**
 * A job queue stored in Postgres (pg-boss), so there's no Redis to host.
 * Jobs survive restarts and failed jobs are retried with backoff. The worker
 * runs inside the API process, which suits a single small server.
 */
export class PgBossMemoryQueue implements MemoryQueue {
  private constructor(
    private readonly boss: PgBoss,
    private readonly debounceSeconds: number,
  ) {}

  static async start(options: {
    connectionString: string;
    llm: LlmProvider;
    debounceSeconds: number;
  }): Promise<PgBossMemoryQueue> {
    const boss = new PgBoss(options.connectionString);
    boss.on("error", (error) => logger.error({ err: error }, "Job queue error"));
    await boss.start();
    await boss.createQueue(QUEUE);

    await boss.work<{ chapterId: string }>(QUEUE, async ([job]) => {
      if (!job) return;
      const started = Date.now();
      const result = await processChapterMemory(options.llm, job.data.chapterId);
      logger.info(
        { chapterId: job.data.chapterId, result, ms: Date.now() - started },
        "Story Memory updated",
      );
    });

    return new PgBossMemoryQueue(boss, options.debounceSeconds);
  }

  async enqueueChapter(chapterId: string) {
    await this.boss.sendDebounced(
      QUEUE,
      { chapterId },
      { retryLimit: 3, retryBackoff: true },
      this.debounceSeconds,
      chapterId,
    );
  }

  async stop() {
    await this.boss.stop();
  }
}
