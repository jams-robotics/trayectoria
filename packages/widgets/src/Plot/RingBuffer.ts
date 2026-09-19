/**
 * Fixed-capacity circular buffer of samples for the live mode of `Plot` (docs/WIDGETS.md, Plot).
 * It lives in `widgets` because `sim-core` does not export one (ticket F2-01b).
 *
 * Each sample is a time in seconds plus one value per series. Once the buffer is full the
 * oldest sample is overwritten, so it holds at most the last `capacity` samples.
 */
export class RingBuffer {
  readonly capacity: number;
  readonly seriesCount: number;

  private readonly times_s: Float64Array;
  /** One column per series, each `capacity` long and indexed like `times_s`. */
  private readonly columns: readonly Float64Array[];
  private start = 0;
  private count = 0;
  /** Incremented on every mutation so a consumer can tell whether it must redraw. */
  private revisionCount = 0;

  constructor(capacity: number, seriesCount = 1) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError(`RingBuffer capacity must be a positive integer, got ${capacity}`);
    }
    if (!Number.isInteger(seriesCount) || seriesCount < 1) {
      throw new RangeError(`RingBuffer seriesCount must be a positive integer, got ${seriesCount}`);
    }
    this.capacity = capacity;
    this.seriesCount = seriesCount;
    this.times_s = new Float64Array(capacity);
    this.columns = Array.from({ length: seriesCount }, () => new Float64Array(capacity));
  }

  /** Number of samples currently held, at most `capacity`. */
  get length(): number {
    return this.count;
  }

  /** Mutation counter: changes whenever `push` or `clear` alters the contents. */
  get revision(): number {
    return this.revisionCount;
  }

  /** Time of the newest sample, or 0 while the buffer is empty. */
  get lastTime_s(): number {
    return this.count === 0 ? 0 : this.at(this.times_s, this.count - 1);
  }

  /** Appends a sample, overwriting the oldest one when the buffer is full. */
  push(t_s: number, values: readonly number[]): void {
    if (values.length !== this.seriesCount) {
      throw new RangeError(
        `RingBuffer expects ${this.seriesCount} values per sample, got ${values.length}`,
      );
    }
    const index = (this.start + this.count) % this.capacity;
    this.times_s[index] = t_s;
    this.columns.forEach((column, series) => {
      column[index] = values[series] ?? Number.NaN;
    });
    if (this.count < this.capacity) this.count += 1;
    else this.start = (this.start + 1) % this.capacity;
    this.revisionCount += 1;
  }

  /** Drops every sample; capacity and series count stay the same. */
  clear(): void {
    this.start = 0;
    this.count = 0;
    this.revisionCount += 1;
  }

  /**
   * Samples in insertion order as `[times_s, ...seriesValues]`, the layout uPlot expects.
   * With `sinceTime_s` only the samples at or after that time are returned (sliding window).
   */
  toArrays(sinceTime_s?: number): Float64Array[] {
    const from = sinceTime_s === undefined ? 0 : this.firstIndexAtOrAfter(sinceTime_s);
    const size = this.count - from;
    return [
      this.window(this.times_s, from, size),
      ...this.columns.map((column) => this.window(column, from, size)),
    ];
  }

  /** Copies `size` entries of `source`, starting `from` samples after the oldest one. */
  private window(source: Float64Array, from: number, size: number): Float64Array {
    const out = new Float64Array(size);
    for (let i = 0; i < size; i += 1) {
      out[i] = this.at(source, from + i);
    }
    return out;
  }

  /** Value of `source` at logical position `offset`, counted from the oldest sample. */
  private at(source: Float64Array, offset: number): number {
    return source[(this.start + offset) % this.capacity] ?? Number.NaN;
  }

  /**
   * Index (relative to the oldest sample) of the first sample with `t_s >= sinceTime_s`.
   * Binary search: times are pushed in order, so the window is found in O(log n) per frame.
   */
  private firstIndexAtOrAfter(sinceTime_s: number): number {
    let low = 0;
    let high = this.count;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (this.at(this.times_s, mid) < sinceTime_s) low = mid + 1;
      else high = mid;
    }
    return low;
  }
}
