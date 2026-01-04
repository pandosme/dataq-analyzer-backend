import mongoose from 'mongoose';

const mqttConfigSchema = new mongoose.Schema(
  {
    // Singleton pattern - only one config document should exist
    _id: {
      type: String,
      default: 'mqtt-config',
    },
    brokerUrl: {
      type: String,
      required: true,
      default: 'mqtt://localhost:1883',
    },
    host: {
      type: String,
      required: true,
      default: 'localhost',
    },
    port: {
      type: Number,
      required: true,
      default: 1883,
    },
    protocol: {
      type: String,
      enum: ['mqtt', 'mqtts', 'ws', 'wss'],
      default: 'mqtt',
    },
    username: {
      type: String,
      default: '',
    },
    password: {
      type: String,
      default: '',
    },
    useTls: {
      type: Boolean,
      default: false,
    },
    topicPrefix: {
      type: String,
      default: 'dataq/#',
    },
  },
  {
    timestamps: true,
  }
);

const MqttConfig = mongoose.model('MqttConfig', mqttConfigSchema);

export default MqttConfig;
