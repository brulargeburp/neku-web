
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

// --- Web Bluetooth API type placeholders ---
// In a real project, these types would be provided by the TypeScript compiler environment.
// These are minimal definitions to resolve type errors in this application.

declare global {
  interface BluetoothRemoteGATTServer {
      connect(): Promise<BluetoothRemoteGATTServer>;
      disconnect(): void;
      getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>;
  }

  interface BluetoothRemoteGATTService {
      getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>;
  }

  interface BluetoothRemoteGATTCharacteristic extends EventTarget {
      value?: DataView;
      startNotifications(): Promise<void>;
      writeValue(value: BufferSource): Promise<void>;
      addEventListener(type: 'characteristicvaluechanged', listener: (this: this, ev: Event) => any, useCapture?: boolean): void;
  }

  interface BluetoothDevice extends EventTarget {
      gatt?: BluetoothRemoteGATTServer;
      addEventListener(type: 'gattserverdisconnected', listener: (this: this, ev: Event) => any, useCapture?: boolean): void;
      removeEventListener(type: 'gattserverdisconnected', listener: (this: this, ev: Event) => any, useCapture?: boolean): void;
  }

  interface Navigator {
      bluetooth: {
          requestDevice(options: any): Promise<BluetoothDevice>;
      };
  }
}
