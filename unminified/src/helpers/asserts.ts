export default class Assert {
  static notTrue(condition: (() => boolean) | boolean, message: string | Error): boolean | Error {
    let error;
    if (message instanceof Error) error = message;
    else error = new Error(message);

    if (typeof condition === 'function') {
      if (!condition()) throw error;
    } else if (typeof condition === 'boolean') {
      if (!condition) throw error;
    }
    return true;
  }
}
