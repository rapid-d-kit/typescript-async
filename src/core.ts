/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable no-inner-declarations */

import { EventLoop } from '@ts-overflow/async/event-loop';


export namespace Async {
  export function delay(timeout: number = 750): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, timeout));
  }

  export function resolveNextTick(): Promise<void> {
    return new Promise(resolve => EventLoop.immediate(resolve));
  }

  export function rejectNextTick(reason?: unknown): Promise<never> {
    return new Promise((_, reject) => EventLoop.immediate(reject, reason));
  }

  export function wrapRejectionOnNextTick(reject: (reason?: unknown) => unknown, reason?: unknown): void {
    EventLoop.immediate(reject, reason);
  }

  export function wrapResolveOnNextTick(resolve: (value?: any) => unknown, value?: unknown): void {
    EventLoop.immediate(resolve, value);
  }

  export interface IAbstractConcurrencyHandler {
    acquire(...args: unknown[]): Promise<unknown>;
    release(): void;
    isLocked(): boolean;
    whenUnlock(...args: unknown[]): Promise<void>;
  }
}
