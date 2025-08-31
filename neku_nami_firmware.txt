
/**
 * Neku-Nami Control Panel Firmware (Current-Based, Text Protocol)
 * 
 * This firmware communicates with the Neku-Nami web application using a
 * human-readable, text-based protocol. It manages three circuit breakers, 
 * reads sensor data, and supports real-time configuration of trip thresholds.
 * 
 * --- Web App Communication Protocol (Text-based) ---
 * 
 * ---> Outgoing Data Packet to Web App --->
 * A single string line ending in a newline character ('\n').
 * Format: "statusMask|systemCurrent|totalLoadCurrent|load1Current|load2Current"
 * Example: "3|1.25|0.80|0.80|0.00"
 *
 * <--- Incoming Command Packets from Web App <---
 * Commands are simple strings ending in a newline character ('\n').
 * 1. Toggle State: "T,breakerIndex,newState" 
 *    (e.g., "T,1,1" to turn Load 1 ON)
 * 2. Set Max Current: "M,breakerIndex,maxCurrent"
 *    (e.g., "M,1,4.5" to set Load 1 max current to 4.5A)
 * 3. Set Min Current: "m,breakerIndex,minCurrent"
 *    (e.g., "m,1,0.2" to set Load 1 min current to 0.2A)
 */

// --- Pin Definitions (assuming ammeters like ACS712) ---
const int dcLoad_currentSensorPin = A0;
const int dcSystem_currentSensorPin = A1;
const int transistorPinLoad1 = 2;
const int transistorPinOverall = 3;
const int transistorPinLoad2 = 4;

// --- State Management ---
bool breakerIsOn[3] = {false, false, false};
float maxCurrents[3] = {0.0, 5.0, 5.0}; // Default max current for Loads 1 & 2 is 5.0A
float minCurrents[3] = {0.0, 0.1, 0.1}; // Default min current for Loads 1 & 2 is 0.1A

// --- Calibration Values (example for ACS712-20A) ---
const float sensorOffset = 2.5; 
const float sensorSensitivity = 0.100;

// --- Communication Timing ---
unsigned long lastSendTime = 0;
const long sendInterval = 100;

void setup() {
  Serial.begin(9600);
  pinMode(transistorPinLoad1, OUTPUT);
  pinMode(transistorPinOverall, OUTPUT);
  pinMode(transistorPinLoad2, OUTPUT);
  digitalWrite(transistorPinLoad1, HIGH);
  digitalWrite(transistorPinOverall, HIGH);
  digitalWrite(transistorPinLoad2, HIGH);
}

void loop() {
  handleSerialCommands();
  updateBreakerLogic();

  if (millis() - lastSendTime >= sendInterval) {
    sendDataPacket();
    lastSendTime = millis();
  }
}

float readCurrent(int pin) {
  int sensorValue = analogRead(pin);
  float voltage = (sensorValue / 1024.0) * 5.0;
  float current = (voltage - sensorOffset) / sensorSensitivity;
  return abs(current);
}

void handleSerialCommands() {
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n');
    command.trim();

    if (command.length() == 0) return;

    char commandType = command.charAt(0);
    String payload = command.substring(2);
    
    int firstComma = payload.indexOf(',');
    if (firstComma == -1) return;

    int breakerIndex = payload.substring(0, firstComma).toInt();
    String valueStr = payload.substring(firstComma + 1);

    if (commandType == 'T') {
      bool newState = (valueStr.toInt() == 1);
      setBreakerState(breakerIndex, newState);
    } else if (commandType == 'M') {
      float newMax = valueStr.toFloat();
      if (breakerIndex > 0 && breakerIndex < 3) {
        maxCurrents[breakerIndex] = newMax;
      }
    } else if (commandType == 'm') {
      float newMin = valueStr.toFloat();
       if (breakerIndex > 0 && breakerIndex < 3) {
        minCurrents[breakerIndex] = newMin;
      }
    }
  }
}

void updateBreakerLogic() {
  float dcLoad_current = readCurrent(dcLoad_currentSensorPin);
  if (breakerIsOn[1]) {
    if (dcLoad_current >= maxCurrents[1] || (dcLoad_current > 0 && dcLoad_current < minCurrents[1])) {
      setBreakerState(1, false);
    }
  }
}

void setBreakerState(int index, bool isOn) {
  if (index < 0 || index > 2) return;

  if (index == 0) {
    breakerIsOn[0] = isOn;
    digitalWrite(transistorPinOverall, isOn ? LOW : HIGH);
    if (!isOn) {
      for (int i = 1; i < 3; i++) {
        setBreakerState(i, false);
      }
    }
  } else {
    if (isOn && !breakerIsOn[0]) {
      return; 
    }
    breakerIsOn[index] = isOn;
    int pin = (index == 1) ? transistorPinLoad1 : transistorPinLoad2;
    digitalWrite(pin, isOn ? LOW : HIGH);
  }
}

void sendDataPacket() {
  uint8_t statusMask = 0;
  for (int i = 0; i < 3; i++) {
    if (breakerIsOn[i]) {
      statusMask |= (1 << i);
    }
  }
  
  float systemCurrent = readCurrent(dcSystem_currentSensorPin);
  float load1Current = readCurrent(dcLoad_currentSensorPin);
  float load2Current = 0.0; // Placeholder for future sensor
  float totalLoadCurrent = load1Current + load2Current;
  
  String dataPacket = "";
  dataPacket += String(statusMask);
  dataPacket += "|";
  dataPacket += String(systemCurrent, 2); // Format to 2 decimal places
  dataPacket += "|";
  dataPacket += String(totalLoadCurrent, 2);
  dataPacket += "|";
  dataPacket += String(load1Current, 2);
  dataPacket += "|";
  dataPacket += String(load2Current, 2);

  Serial.println(dataPacket);
}
