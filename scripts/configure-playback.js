/**
 * Script to configure video playback settings in the database
 * This ensures playback.enabled is properly set to true
 */

import mongoose from 'mongoose';
import SystemConfig from '../src/models/SystemConfig.js';
import dotenv from 'dotenv';

dotenv.config();

async function configurePlayback() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://admin:admin@10.13.8.80:27017/dataq_analyzer?authSource=admin';

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Check if config exists
    let config = await SystemConfig.findById('system-config');

    if (config) {
      console.log('Found existing config:');
      console.log('  playback.enabled:', config.playback?.enabled);
      console.log('  playback.type:', config.playback?.type);
      console.log('  playback.serverUrl:', config.playback?.serverUrl);
      console.log('  playback.apiKey:', config.playback?.apiKey ? '(set)' : '(not set)');

      // Update the config
      console.log('\nUpdating configuration...');
      config.playback = {
        enabled: true,
        type: 'VideoX',
        serverUrl: 'http://10.13.8.2:3002',
        apiKey: config.playback?.apiKey || '', // Preserve existing API key if set
        preTime: config.playback?.preTime || 2,
        postTime: config.playback?.postTime || 2,
      };

      await config.save();
      console.log('Configuration updated successfully!');
    } else {
      console.log('No config found, creating new one...');

      config = new SystemConfig({
        _id: 'system-config',
        appName: 'DataQ-Management',
        playback: {
          enabled: true,
          type: 'VideoX',
          serverUrl: 'http://10.13.8.2:3002',
          apiKey: '',
          preTime: 2,
          postTime: 2,
        },
      });

      await config.save();
      console.log('Configuration created successfully!');
    }

    // Verify the saved configuration
    const savedConfig = await SystemConfig.findById('system-config').lean();
    console.log('\nVerified saved configuration:');
    console.log('  playback.enabled:', savedConfig.playback?.enabled);
    console.log('  playback.type:', savedConfig.playback?.type);
    console.log('  playback.serverUrl:', savedConfig.playback?.serverUrl);
    console.log('  playback.apiKey:', savedConfig.playback?.apiKey ? '(set)' : '(not set)');
    console.log('  playback.preTime:', savedConfig.playback?.preTime);
    console.log('  playback.postTime:', savedConfig.playback?.postTime);

    if (savedConfig.playback?.enabled === true) {
      console.log('\n✓ SUCCESS: playback.enabled is now TRUE');
    } else {
      console.log('\n✗ ERROR: playback.enabled is still FALSE');
    }

    await mongoose.connection.close();
    console.log('\nDatabase connection closed');

  } catch (error) {
    console.error('Error configuring playback:', error);
    process.exit(1);
  }
}

configurePlayback();
