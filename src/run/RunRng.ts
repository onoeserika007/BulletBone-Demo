export class RunRng {
  private state = 1;

  public reset(seed: number): void {
    this.state = seed >>> 0 || 1;
  }

  public next(): number {
    this.state += 0x6d2b79f5;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  public sample<T>(items: readonly T[], count: number): T[] {
    const pool = [...items];
    const result: T[] = [];
    while (pool.length > 0 && result.length < count) {
      const index = Math.floor(this.next() * pool.length);
      result.push(pool.splice(index, 1)[0]);
    }
    return result;
  }
}

export const runRng = new RunRng();
