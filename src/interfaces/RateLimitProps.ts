export interface RateLimitProps {
  /**
   * The DynamoDB table identifier
   */
  table: string;

  /**
   * The counter limit, approximately how many calls can be made in counterExpireMinutes
   */
  limit?: number;

  /**
   * How often the suspicious count need to be increased
   */
  suspiciousRate?: number;

  /**
   * ttl for a specific key in minutes
   */
  counterExpireMinutes?: number;

  /**
   * After how many request should the local counter start counting.
   * This value is usually set to normal number of calls, set to 0 if you want to ignore it
   */
  localCountStart?: number;

  /**
   * For how much seconds the Counter should be based on the centralized db.
   * The time is measured based on the process start time
   */
  dbOnlySeconds?: number;
}
