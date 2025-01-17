import { assert } from '@rapid-d-kit/safe';
import { Iterable } from '@rapid-d-kit/iterator';

import { Async } from './core';
import promises from './promises';
import { Exception } from './@internals/errors';
import { CancellationToken, ICancellationToken } from './cancellation';


export interface ISemaphore extends Async.IAbstractConcurrencyHandler {
  acquire(weight?: number, priority?: number): Promise<readonly [number, () => void]>;
  runExclusive<T>(callback: (value: number) => Promise<T> | T, _: { weight?: number; priority?: number; token?: ICancellationToken }): Promise<T>;
  whenUnlock(weight?: number, priority?: number): Promise<void>;
  getValue(): number;
  setValue(value: number): void;
  release(weight?: number): void;
  cancelPending(): void;
}


type Entry = {
  resolve(value: [number, () => void]): void;
  reject(reason?: unknown): void;
  weight: number;
  priority: number;
};

type Waiter = {
  resolve(): void;
  priority: number;
};

export class Semaphore implements ISemaphore {
  #value: number;
  #queue: Entry[];
  #weightedWaiters: Waiter[][];

  public constructor(_value: number) {
    this.#value = _value;
    this.#queue = [];
    this.#weightedWaiters = [];
  }

  public acquire(weight: number = 1, priority: number = 0): Promise<[number, () => void]> {
    assert(typeof weight === 'number' && Number.isInteger(weight) && weight > 0);

    return new Promise((resolve, reject) => {
      const task: Entry = {
        resolve, reject,
        weight, priority,
      };

      const i = Iterable.findLastIndex(this.#queue, other => priority <= other.priority);

      if(i === -1 && weight <= this.#value) {
        this.#dispatch(task);
      } else {
        this.#queue.splice(i + 1, 0, task);
      }
    });
  }

  public runExclusive<T>(callback: (value: number) => T | Promise<T>, { weight = 1, priority = 0, token = CancellationToken.None }: { weight?: number; priority?: number; token?: ICancellationToken } = {}): Promise<T> {
    return promises.withAsyncBody(async (resolve, reject) => {
      if(token.isCancellationRequested) {
        reject(new Exception('Async execution of semaphore method was cancelled by token', 'ERR_TOKEN_CANCELLED'));
        return;
      }

      token.onCancellationRequested(() => {
        reject(new Exception('Async execution of semaphore method was cancelled by token', 'ERR_TOKEN_CANCELLED'));
      });

      const [value, release] = await this.acquire(weight, priority);

      try {
        const result = await callback(value);

        if(token.isCancellationRequested) {
          reject(new Exception('Async execution of semaphore method was cancelled by token', 'ERR_TOKEN_CANCELLED'));
          return;
        }

        resolve(result);
      } catch (err: any) {
        reject(err);
      } finally {
        release();
      }
    });
  }

  public whenUnlock(weight: number = 1, priority: number = 0): Promise<void> {
    assert(typeof weight === 'number' && Number.isInteger(weight) && weight > 0);

    if(this.#couldLockImmediately(weight, priority))
      return Promise.resolve();

    return new Promise(resolve => {
      if(!this.#weightedWaiters[weight - 1]) {
        this.#weightedWaiters[weight - 1] = [];
      }

      _insertSorted(this.#weightedWaiters[weight - 1], { resolve, priority });
    });
  }

  public isLocked(): boolean {
    return this.#value <= 0;
  }

  public getValue(): number {
    return this.#value;
  }

  public setValue(value: number): void {
    this.#value = value;
    this.#flushQueue();
  }

  public release(weight: number = 1): void {
    this.#DoRelease(weight);
  }

  public cancelPending(reason?: any): void {
    for(let i = 0; i < this.#queue.length; i++) {
      this.#queue[i].reject(reason);
    }

    this.#queue = [];
  }

  #dispatch(entry: Entry): void {
    const prev = this.#value;
    this.#value -= entry.weight;

    entry.resolve([prev, this.#releaser(entry.weight)]);
  }

  #releaser(weight: number): () => void {
    let called = false;

    return () => {
      if(called) return;
      called = true;

      this.#DoRelease(weight);
    };
  }

  #DoRelease(weight: number = 1): void {
    assert(typeof weight === 'number' && Number.isInteger(weight) && weight > 0);

    this.#value += weight;
    this.#flushQueue();
  }

  #flushQueue(): void {
    this.#drainUnlockWaiters();

    while(this.#queue.length > 0 && this.#queue[0].weight <= this.#value) {
      this.#dispatch(this.#queue.shift()!);
      this.#drainUnlockWaiters();
    }
  }

  #drainUnlockWaiters(): void {
    if(this.#queue.length === 0) {
      for(let weight = this.#value; weight > 0; weight--) {
        const waiters = this.#weightedWaiters[weight - 1];
        if(!waiters) continue;

        waiters.forEach(item => item.resolve());
        this.#weightedWaiters[weight - 1] = [];
      }
    } else {
      const pp = this.#queue[0].priority;

      for(let weight = this.#value; weight > 0; weight--) {
        const waiters = this.#weightedWaiters[weight - 1];
        if(!waiters) continue;

        const index = waiters.findIndex(item => item.priority <= pp);

        (index === -1 ? waiters : waiters.splice(0, index))
          .forEach(item => item.resolve());
      }
    }
  }

  #couldLockImmediately(weight: number, priority: number): boolean {
    return (
      this.#queue.length === 0 || this.#queue[0].priority < priority
    ) && weight <= this.#value;
  }
}

function _insertSorted<T extends { priority: number }>(arr: T[], value: T): void {
  const index = Iterable.findLastIndex(arr, other => value.priority <= other.priority);
  arr.splice(index + 1, 0, value);
}

export default Semaphore;
