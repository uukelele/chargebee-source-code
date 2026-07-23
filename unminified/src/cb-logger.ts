import Helpers from './helpers';

export class CbLogger {
  private readonly session: string;

  constructor() {
    try {
      // @ts-ignore
      this.session = crypto.randomUUID();
    } catch (e) {
      this.session = 'no-session-id';
    }
  }

  private dataWithSource(data, source) {
    if (!data) {
      return;
    }

    const result = {};

    for (const [key, value] of Object.entries(data)) {
      result[`${source}_${key}`] = value;
    }

    return result;
  }

  public info(source: string, event: string, message: string, direct: boolean = false, data?: object): Promise<any> {
    const payload = {
      type: 'info',
      session_id: this.session,
      name: `${source} - ${event}`,
      message: message,
      meta: {
        name: `${source}: ${event}`,
        message: message,
        ...this.dataWithSource(data, source),
      },
    };

    return new Promise((resolve, reject) => {
      if (direct) {
        Helpers.sendKVL(payload);
      }

      resolve(null);
    });
  }
}
