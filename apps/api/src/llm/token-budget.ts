/**
 * Global daily token ceiling for paid LLM providers (ADR-004 cost control). Per-user quotas wait for
 * accounts (ADR-007); this only stops a bug or a traffic spike from running up the bill.
 */
export class TokenBudget {
  private day = '';
  private used = 0;

  constructor(
    readonly limit: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Tokens used so far in the current UTC day. */
  get usedToday() {
    this.roll();
    return this.used;
  }

  get exhausted() {
    return this.limit > 0 && this.usedToday >= this.limit;
  }

  add(tokens: number) {
    this.roll();
    this.used += Math.max(0, tokens);
  }

  private roll() {
    const today = this.now().toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.used = 0;
    }
  }
}
