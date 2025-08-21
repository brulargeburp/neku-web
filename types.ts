
export interface Breaker {
  id: string;
  name: string;
  isOn: boolean;
  voltage1Label: string;
  voltage2Label: string;
  voltage1: number;
  voltage2: number;
  isOverall: boolean;
}

// --- Web Serial API type placeholders ---
// These are minimal definitions to resolve type errors in this application,
// as the official types might not be included in all default tsconfig setups.

declare global {
  interface SerialPort extends EventTarget {
    open(options: SerialOptions): Promise<void>;
    close(): Promise<void>;
    readonly readable: ReadableStream<Uint8Array> | null;
    readonly writable: WritableStream<Uint8Array> | null;
    addEventListener(type: 'disconnect', listener: (this: this, ev: Event) => any, useCapture?: boolean): void;
    removeEventListener(type: 'disconnect', listener: (this: this, ev: Event) => any, useCapture?: boolean): void;
  }

  interface SerialOptions {
    baudRate: number;
    dataBits?: 7 | 8;
    stopBits?: 1 | 2;
    parity?: 'none' | 'even' | 'odd';
    bufferSize?: number;
    flowControl?: 'none' | 'hardware';
  }

  interface Navigator {
    serial: {
      requestPort(options?: any): Promise<SerialPort>;
      getPorts(): Promise<SerialPort[]>;
    };
  }
}
