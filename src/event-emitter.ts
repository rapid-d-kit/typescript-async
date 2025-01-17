import { IDisposable } from '@rapid-d-kit/disposable';
import { assertDefinedString } from '@rapid-d-kit/safe';
import type { Dict, LooseAutocomplete, FunctionArguments } from '@rapid-d-kit/types';

import { Exception } from './@internals/errors';


export type ListenerCallback<T> = (...args: T extends unknown[] ? T : [T]) => unknown;

export class WeakEventEmitter<T = Dict<any>> implements IDisposable {
  #disposed: boolean = false;
  readonly #listeners: Map<string, Set<ListenerCallback<T>>> = new Map();
  readonly #metadata: Map<string, Map<ListenerCallback<T>, { once: boolean }>> = new Map();

  public addListener<K extends keyof T>(
    event: LooseAutocomplete<K>,
    listener: ListenerCallback<T[K]>,
    options?: { once?: boolean } // eslint-disable-line comma-dangle
  ): void {
    this.#ensureNotDisposed();
    assertDefinedString(event);
    
    if(!this.#listeners.has(event)) {
      this.#listeners.set(event, new Set());
    }

    const listeners = this.#listeners.get(event) || new Set();
    listeners.add(listener as () => void);

    if(!this.#metadata.has(event)) {
      this.#metadata.set(event, new Map());
    }

    this.#metadata.get(event)!.set(listener as () => void, { once: options?.once ?? false });
  }

  public removeListener<K extends keyof T>(event: LooseAutocomplete<K>, listener: ListenerCallback<T[K]>): boolean {
    this.#ensureNotDisposed();
    assertDefinedString(event);

    if(!this.#listeners.has(event)) return false;
    const listeners = this.#listeners.get(event)!;

    if(!listeners.has(listener as () => void)) return false;

    listeners.delete(listener as () => void);

    if(!this.#metadata.has(event)) {
      this.#metadata.set(event, new Map());
    }

    this.#metadata.get(event)!.delete(listener as () => void);

    return true;
  }

  public removeAllListeners<K extends keyof T>(event?: LooseAutocomplete<K>): boolean {
    this.#ensureNotDisposed();
    
    if(!event) {
      this.#listeners.clear();
      this.#metadata.clear();
      return true;
    }

    assertDefinedString(event);
    if(!this.#listeners.has(event)) return false;

    if(!this.#metadata.has(event)) {
      this.#metadata.set(event, new Map());
    }

    for(const listener of this.#listeners.get(event)!) {
      this.#metadata.get(event)!.delete(listener as () => void);
    }

    this.#listeners.delete(event);
    return true;
  }

  public listenersCount<K extends keyof T>(event?: LooseAutocomplete<K>): number {
    if(this.#disposed) return -1;

    if(!event) {
      let count = 0;

      for(const listenerSet of this.#listeners.values()) {
        count += listenerSet.size;
      }

      return count;
    }

    assertDefinedString(event);

    if(!this.#listeners.has(event)) return 0;
    return this.#listeners.get(event)!.size;
  }

  public emit<K extends keyof T>(
    event: LooseAutocomplete<K>,
    ...args: FunctionArguments<ListenerCallback<T[K]>> // eslint-disable-line comma-dangle
  ): boolean {
    this.#ensureNotDisposed();

    assertDefinedString(event);
    if(!this.#listeners.has(event)) return false;

    if(!this.#metadata.has(event)) {
      this.#metadata.set(event, new Map());
    }

    for(const listener of this.#listeners.get(event)!) {
      try {
        const metadata = this.#metadata.get(event)!.get(listener) || { once: false };
        
        if(metadata.once) {
          this.#metadata.get(event)!.delete(listener);
          this.#listeners.get(event)!.delete(listener);
        }

        listener(...args as unknown as any);
      } catch { continue; }
    }

    return true;
  }

  public fire<K extends keyof T>(event?: LooseAutocomplete<K>, args?: FunctionArguments<ListenerCallback<T[K]>>): boolean {
    this.#ensureNotDisposed();

    if(!event) {
      for(const [eventName, listenerSet] of this.#listeners.entries()) {
        if(!this.#metadata.has(eventName)) {
          this.#metadata.set(eventName, new Map());
        }

        for(const listener of listenerSet.values()) {
          try {
            const metadata = this.#metadata.get(eventName)!.get(listener) || { once: false };

            if(metadata.once) {
              this.#metadata.get(eventName)!.delete(listener);
              this.#listeners.get(eventName)!.delete(listener);
            }

            listener(...(args || []) as any);
          } catch { continue; }
        }
      }

      return true;
    }

    assertDefinedString(event);
    if(!this.#listeners.has(event)) return false;

    if(!this.#metadata.has(event)) {
      this.#metadata.set(event, new Map());
    }

    for(const listener of this.#listeners.get(event)!) {
      try {
        const metadata = this.#metadata.get(event)!.get(listener) || { once: false };
        
        if(metadata.once) {
          this.#metadata.get(event)!.delete(listener);
          this.#listeners.get(event)!.delete(listener);
        }

        listener(...args as unknown as any);
      } catch { continue; }
    }

    return true;
  }

  public dispose(): void {
    if(this.#disposed) return;

    this.#listeners.clear();
    this.#metadata.clear();
    
    this.#disposed = true;
  }

  #ensureNotDisposed(): void {
    if(this.#disposed) {
      throw new Exception('WeakEventListener is already disposed', 'ERR_RESOURCE_DISPOSED');
    }
  }
}
