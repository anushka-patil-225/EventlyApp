import { LessThan } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { Event } from "../entities/Event";
import SeatService from "../services/seatService";

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const seatService = new SeatService();

async function cleanupExpiredEvents(): Promise<void> {
  const eventRepo = AppDataSource.getRepository(Event);
  const now = new Date();
  const expiredEvents = await eventRepo.find({
    where: { time: LessThan(now) },
    select: ["id"],
  });

  for (const event of expiredEvents) {
    try {
      await seatService.cleanupEvent(event.id);
    } catch (err) {
      console.error(
        "[eventCleanupScheduler] Failed to cleanup seats for event " +
          event.id +
          ":",
        err
      );
    }
  }
}

function resolveInterval(): number {
  const envValue = process.env.EVENT_CLEANUP_INTERVAL_MS;
  if (!envValue) return DEFAULT_INTERVAL_MS;

  const parsed = Number(envValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(
      "[eventCleanupScheduler] Invalid EVENT_CLEANUP_INTERVAL_MS='" +
        envValue +
        "', falling back to default (" +
        DEFAULT_INTERVAL_MS +
        "ms)"
    );
    return DEFAULT_INTERVAL_MS;
  }

  return parsed;
}

export function startEventCleanupScheduler(): NodeJS.Timeout {
  const intervalMs = resolveInterval();
  console.log(
    "[eventCleanupScheduler] Starting cleanup job, interval " + intervalMs + "ms"
  );

  cleanupExpiredEvents().catch((err) =>
    console.error("[eventCleanupScheduler] Initial cleanup failed:", err)
  );

  return setInterval(() => {
    cleanupExpiredEvents().catch((err) =>
      console.error("[eventCleanupScheduler] Scheduled cleanup failed:", err)
    );
  }, intervalMs);
}
