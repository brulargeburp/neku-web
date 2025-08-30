
/**
 * Neku-Nami Control Panel Firmware (Current-Based)
 * 
 * This firmware communicates with the Neku-Nami web application. It manages
 * three circuit breakers (1 main, 2 loads), reads sensor data (current/amperage), 
 * and uses a dynamic auto-trip threshold based on current that can be configured 
 * in real-time from the web app.
 * 
 * --- Web App Communication Protocol ---
 * 
 * Note on Admin Mode: The "Admin Mode" password lock is a client-side safety 
 * feature implemented purely within the web application. It prevents the app 
 * from sending 'Set Min/Max Current' commands unless unlocked. The firmware 
 * itself does not have an admin state and will process these commands at any 
 * time if they are received.
 *
 * ---> Outgoing Data Packet to Web App (17 bytes) --->
 * Byte 0:    Status Mask (Bit 0: Overall, Bit 1: Load 1, Bit 2: Load 2)
 * Bytes 1-4:   System Current (float in Amperes)
 * Bytes 5-8:   Total Load Current (float in Amperes, placeholder)
 * Bytes 9-12:  Load 1 Current (float in Amperes)
 * Bytes 13-16: Load 2 Current (float in Amperes, placeholder)
 *
 * <--- Incoming Command Packets from Web App <---
 * 1. Toggle State (3 bytes):
 *    Byte 0: Command Type (0x01)
 *    Byte 1: Breaker Index (0-2)
 *    Byte 2: New State (0=OFF, 1=ON)
 * 
 * 2. Set Max Current (6 bytes):
 *    Byte 0: Command Type (0x02)
 *    Byte 1: Breaker Index (1-2)
 *    Bytes 2-5: Max Current (float in Amperes)
 * 
 * 3. Set Min Current (6 bytes):
 *    Byte 0: Command Type (0x03)
 *    Byte 1: Breaker Index (1-2)
 *    Bytes 2-5: Min Current (float in Amperes)
 */

// --- Pin Definitions (assuming ammeters like ACS712) ---
const int dcLoad_currentSensorPin = A0;
const int dcSystem_currentSensorPin = A1;
const int transistorPinLoad1 = 2;
const int transistorPinOverall = 3;
const int transistorPinLoad2 = 4;

// --- Command Definitions ---
const uint8_t CMD_TOGGLE_STATE = 0x01;
const uint8_t CMD_SET_MAX_CURRENT = 0x02;
const uint8_t CMD_SET_MIN_CURRENT = 0x03;

// --- State Management ---
bool breakerIsOn[3] = {false, false, false};
float maxCurrents[3] = {0.0, 5.0, 5.0}; // Default max current for Loads 1 & 2 is 5.0A
float minCurrents[3] = {0.0, 0.1, 0.1}; // Default min current for Loads 1 & 2 is 0.1A

// --- Calibration Values (example for ACS712-20A) ---
// VCC/2 offset, i.e., 2.5V for 0A on a 5V Arduino
const float sensorOffset = 2.5; 
// Sensitivity, e.g., 100mV/A for ACS712-20A
const float sensorSensitivity = 0.100; 

// --- Communication Timing ---
unsigned long lastSendTime = 0;
const long sendInterval = 100;

void setup() {
  Serial.begin(9600);
  pinMode(transistorPinLoad1, OUTPUT);
  pinMode(transistorPinOverall, OUTPUT);
  pinMode(transistorPinLoad2, OUTPUT);
  // Initialize all circuits to OFF state (HIGH for PNP transistors)
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
  // Simple conversion from analog reading to current for a sensor like ACS712
  int sensorValue = analogRead(pin);
  float voltage = (sensorValue / 1024.0) * 5.0; // Convert reading to voltage
  float current = (voltage - sensorOffset) / sensorSensitivity;
  return abs(current); // Use absolute value for AC or bidirectional DC
}

void handleSerialCommands() {
  if (Serial.available() > 0) {
    uint8_t commandType = Serial.read();

    if (commandType == CMD_TOGGLE_STATE && Serial.available() >= 2) {
      uint8_t payload[2];
      Serial.readBytes(payload, 2);
      int breakerIndex = payload[0];
      bool newState = (payload[1] == 1);
      setBreakerState(breakerIndex, newState);
    } 
    else if (commandType == CMD_SET_MAX_CURRENT && Serial.available() >= 5) {
      uint8_t payload[5];
      Serial.readBytes(payload, 5);
      int breakerIndex = payload[0];

      if (breakerIndex > 0 && breakerIndex < 3) {
        union { float f; uint8_t bytes[4]; } converter;
        memcpy(converter.bytes, &payload[1], 4);
        maxCurrents[breakerIndex] = converter.f;
      }
    }
    else if (commandType == CMD_SET_MIN_CURRENT && Serial.available() >= 5) {
      uint8_t payload[5];
      Serial.readBytes(payload, 5);
      int breakerIndex = payload[0];

      if (breakerIndex > 0 && breakerIndex < 3) {
        union { float f; uint8_t bytes[4]; } converter;
        memcpy(converter.bytes, &payload[1], 4);
        minCurrents[breakerIndex] = converter.f;
      }
    }
  }
}

void updateBreakerLogic() {
  float dcLoad_current = readCurrent(dcLoad_currentSensorPin);

  // Auto-trip logic for "Load 1"
  if (breakerIsOn[1]) {
    // Overload Trip: current is too high.
    if (dcLoad_current >= maxCurrents[1]) {
      setBreakerState(1, false);
    }
    // Underload/Short-Circuit Trip: current is too low (but not zero).
    else if (dcLoad_current > 0 && dcLoad_current < minCurrents[1]) {
      setBreakerState(1, false);
    }
  }
  // This logic could be expanded for other loads if they get physical sensors.
}

void setBreakerState(int index, bool isOn) {
  if (index < 0 || index > 2) return;

  if (index == 0) { // Overall breaker logic
    breakerIsOn[0] = isOn;
    digitalWrite(transistorPinOverall, isOn ? LOW : HIGH);
    // If the main breaker is turned off, all sub-breakers are also turned off.
    if (!isOn) {
      for (int i = 1; i < 3; i++) {
        setBreakerState(i, false);
      }
    }
  } else { // Individual load breaker logic
    // A load breaker cannot be turned on if the main breaker is off.
    if (isOn && !breakerIsOn[0]) {
      return; 
    }
    breakerIsOn[index] = isOn;
    int pin = 0;
    if (index == 1) pin = transistorPinLoad1;
    if (index == 2) pin = transistorPinLoad2;
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

  uint8_t packet[17];
  packet[0] = statusMask;
  
  union {
    float f;
    uint8_t bytes[4];
  } converter;

  converter.f = systemCurrent;
  memcpy(&packet[1], converter.bytes, 4);

  converter.f = load1Current; // Placeholders use Load 1's current
  memcpy(&packet[5], converter.bytes, 4);  // Total Load Current
  memcpy(&packet[9], converter.bytes, 4);  // Load 1 Current
  memcpy(&packet[13], converter.bytes, 4); // Load 2 Current

  Serial.write(packet, sizeof(packet));
}
