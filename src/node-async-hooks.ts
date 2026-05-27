export class AsyncLocalStorage<T = unknown> {
  private store: T | undefined;

  getStore() {
    return this.store;
  }

  run<R, Args extends unknown[]>(store: T, callback: (...args: Args) => R, ...args: Args): R {
    const previous = this.store;
    this.store = store;
    try {
      return callback(...args);
    } finally {
      this.store = previous;
    }
  }

  enterWith(store: T) {
    this.store = store;
  }
}
