/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable no-inner-declarations */

export namespace promises {
  export function withAsyncBody<T, E = Error>(bodyFn: (resolve: (value: T) => unknown, reject: (error: E) => unknown) => Promise<unknown>): Promise<T> {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise<T>(async (resolve, reject) => {
      try {
        await bodyFn(resolve, reject);
      } catch (error: any) {
        reject(error);
      }
    });
  }
}

export default promises;
