
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
