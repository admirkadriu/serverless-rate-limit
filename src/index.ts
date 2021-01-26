import NodeCache from 'node-cache';

import CounterProvider from './counterProvider';
import { RateLimitProps } from './interfaces/RateLimitProps';

const localCountCache = new NodeCache();
const localBlockedCache = new NodeCache();

const defaultSettings = {
  table: 'dynamoDbTable',
  counterExpireMinutes: 1,
  limit: 150,
  suspiciousRate: 5,
  localCountStart: 10,
  dbOnlySeconds: 60,
};

export default class RateLimit {
  private readonly counterProvider: CounterProvider;

  private readonly limit: number;

  private readonly suspiciousRate: number;

  private readonly localCountStart: number;

  private readonly dbOnlySeconds: number;

  constructor(props: RateLimitProps) {
    const values = { ...defaultSettings, ...props };

    this.counterProvider = new CounterProvider(values.table, values.counterExpireMinutes);
    this.limit = values.limit;
    this.suspiciousRate = values.suspiciousRate;
    this.localCountStart = values.localCountStart;
    this.dbOnlySeconds = values.dbOnlySeconds;
  }

  /**
   * Increments the counters and returns true if the limit is reached
   * @param id: The counter identifier
   */
  async isLimitReached(
    id: string,
  ): Promise<boolean> {
    const blockedUser = localBlockedCache.get<boolean>(id);

    if (blockedUser) {
      return true;
    }

    if (process.uptime() <= this.dbOnlySeconds) {
      const counterItem = await this.counterProvider.increment(id);

      if (
        counterItem.count + counterItem.suspiciousCount * this.suspiciousRate
        >= this.limit
      ) {
        const ttl = counterItem.exptime - Math.round(new Date().getTime() / 1000);

        localBlockedCache.set(id, true, ttl);

        return true;
      }
    } else {
      const keyCount = localCountCache.get<number>(id) || 0;

      localCountCache.set(id, keyCount + 1, 60);

      if (keyCount >= this.localCountStart) {
        let counterItem;

        if (keyCount % this.suspiciousRate === 0) {
          counterItem = await this.counterProvider.incrementSuspicious(id);
        } else {
          counterItem = await this.counterProvider.get(id);
        }

        if (
          counterItem.count + counterItem.suspiciousCount * this.suspiciousRate
          >= this.limit
        ) {
          const ttl = counterItem.exptime - Math.round(new Date().getTime() / 1000);

          localBlockedCache.set(id, true, ttl);

          return true;
        }
      }
    }

    return false;
  }
}
