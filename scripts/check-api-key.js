#!/usr/bin/env node

/**
 * Check and update VideoX API key in MongoDB
 */

import mongoose from 'mongoose';

const SystemConfigSchema = new mongoose.Schema({
  _id: String,
  appName: String,
}, { strict: false });

const SystemConfig = mongoose.model('SystemConfig', SystemConfigSchema);

async function main() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://admin:admin@10.13.8.80:27017/dataq-analyzer?authSource=admin');
    console.log('Connected to MongoDB');

    // Get current config
    const config = await SystemConfig.findById('system-config');

    if (config) {
      console.log('\nCurrent VideoX configuration:');
      console.log('  serverUrl:', config.playback?.serverUrl);
      console.log('  apiKey:', config.playback?.apiKey || '(empty)');
      console.log('  apiKey length:', config.playback?.apiKey?.length || 0);

      // Update with the correct API key (the original one that works)
      const newApiKey = 'i6OWUunLmtjCiX3VYI9e8z1YYKVnoL4UYGpImVqYnHU';

      if (config.playback?.apiKey !== newApiKey) {
        console.log('\nUpdating configuration...');

        // Set the entire playback object at once
        config.playback = {
          enabled: true,
          type: 'VideoX',
          serverUrl: 'http://10.13.8.2:3002',
          apiKey: newApiKey,
          preTime: config.playback?.preTime || 2,
          postTime: config.playback?.postTime || 2,
        };

        config.markModified('playback');
        await config.save();
        console.log('✓ Configuration updated successfully!');

        // Verify
        const updated = await SystemConfig.findById('system-config');
        console.log('\nVerified configuration:');
        console.log('  playback.enabled:', updated.playback?.enabled);
        console.log('  playback.apiKey:', updated.playback?.apiKey ? '(set)' : '(not set)');
      } else {
        console.log('\n✓ API key is already set correctly');
      }
    } else {
      console.log('No config found!');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
