export class RateLimitedError extends Error {
  retryAfterMs: number;
  constructor(retryAfterMs: number, message = "Rate limited") {
    super(message);
    this.name = "RateLimitedError";
    this.retryAfterMs = retryAfterMs;
  }
}

export class QuotaExhaustedError extends Error {
  constructor(message = "Quota exhausted") {
    super(message);
    this.name = "QuotaExhaustedError";
  }
}

export class ChapterFailedError extends Error {
  constructor(message = "Chapter failed") {
    super(message);
    this.name = "ChapterFailedError";
  }
}
