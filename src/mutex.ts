import { Async } from './core';
import Semaphore from './semaphore';
import { ICancellationToken } from './cancellation';


export interface IMutex extends Async.IAbstractConcurrencyHandler {
  acquire(priority?: number): Promise<() => void>;
  runExclusive<T>(callback: () => T | Promise<T>, token: ICancellationToken): Promise<T>;
  runExclusive<T>(callback: () => T | Promise<T>, priority: number, token?: ICancellationToken): Promise<T>;
  whenUnlock(priority?: number): Promise<void>;
  cancel(): void;
}

export class Mutex implements IMutex {
  #semaphore: Semaphore = new Semaphore(1);

  public async acquire(priority: number = 0): Promise<() => void> {
    const [, releaser] = await this.#semaphore.acquire(1, priority);
    return releaser;
  }

  public runExclusive<T>(callback: () => T | Promise<T>, token?: ICancellationToken): Promise<T>;
  public runExclusive<T>(callback: () => T | Promise<T>, priority: number, token?: ICancellationToken): Promise<T>;
  public runExclusive<T>(callback: () => T | Promise<T>, priorityOrToken?: number | ICancellationToken, token?: ICancellationToken): Promise<T> {
    const cancellationToken = typeof priorityOrToken === 'number' ? token : priorityOrToken;
    const priorityValue = typeof priorityOrToken === 'number' ? priorityOrToken : 0;

    return this.#semaphore.runExclusive(() => callback(), {
      priority: priorityValue,
      token: cancellationToken,
    });
  }

  public whenUnlock(priority?: number): Promise<void> {
    return this.#semaphore.whenUnlock(1, priority);
  }

  public isLocked(): boolean {
    return this.#semaphore.isLocked();
  }

  public release(): void {
    if(this.#semaphore.isLocked()) {
      this.#semaphore.release();
    }
  }

  public cancel(): void {
    this.#semaphore.cancelPending();
  }
}

export default Mutex;
