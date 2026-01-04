/**
 * Script to compare databases and show collections in each
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function checkDatabases() {
  try {
    // Connect to MongoDB (to admin database first)
    const mongoUri = 'mongodb://admin:admin@10.13.8.80:27017/admin?authSource=admin';
    console.log('Connecting to MongoDB...\n');
    await mongoose.connect(mongoUri);

    const db = mongoose.connection.db;
    const adminDb = db.admin();

    // List all databases
    const { databases } = await adminDb.listDatabases();

    console.log('═══════════════════════════════════════════════════════════');
    console.log('All Databases:');
    console.log('═══════════════════════════════════════════════════════════');
    databases.forEach(db => {
      console.log(`  • ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    });

    // Check dataq-analyzer collections
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('Collections in "dataq-analyzer" (CONFIGURED DATABASE):');
    console.log('═══════════════════════════════════════════════════════════');
    const dataqAnalyzerDb = mongoose.connection.client.db('dataq-analyzer');
    const collections1 = await dataqAnalyzerDb.listCollections().toArray();
    if (collections1.length === 0) {
      console.log('  (empty)');
    } else {
      for (const col of collections1) {
        const count = await dataqAnalyzerDb.collection(col.name).countDocuments();
        console.log(`  • ${col.name} (${count} documents)`);
      }
    }

    // Check dataq_analyzer collections
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('Collections in "dataq_analyzer" (underscore):');
    console.log('═══════════════════════════════════════════════════════════');
    const dataqAnalyzerUnderscoreDb = mongoose.connection.client.db('dataq_analyzer');
    const collections2 = await dataqAnalyzerUnderscoreDb.listCollections().toArray();
    if (collections2.length === 0) {
      console.log('  (empty)');
    } else {
      for (const col of collections2) {
        const count = await dataqAnalyzerUnderscoreDb.collection(col.name).countDocuments();
        console.log(`  • ${col.name} (${count} documents)`);
      }
    }

    // Check videox database
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('Collections in "videox":');
    console.log('═══════════════════════════════════════════════════════════');
    const videoxDb = mongoose.connection.client.db('videox');
    const collections3 = await videoxDb.listCollections().toArray();
    if (collections3.length === 0) {
      console.log('  (empty)');
    } else {
      for (const col of collections3) {
        const count = await videoxDb.collection(col.name).countDocuments();
        console.log(`  • ${col.name} (${count} documents)`);
      }
    }

    // Check which database has systemconfigs
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('System Configuration Location:');
    console.log('═══════════════════════════════════════════════════════════');

    const config1 = await dataqAnalyzerDb.collection('systemconfigs').findOne({ _id: 'system-config' });
    const config2 = await dataqAnalyzerUnderscoreDb.collection('systemconfigs').findOne({ _id: 'system-config' });

    if (config1) {
      console.log('  ✓ Found in "dataq-analyzer" (ACTIVE)');
      console.log(`    playback.enabled: ${config1.playback?.enabled}`);
      console.log(`    playback.type: ${config1.playback?.type}`);
      console.log(`    playback.serverUrl: ${config1.playback?.serverUrl}`);
    } else {
      console.log('  ✗ Not found in "dataq-analyzer"');
    }

    if (config2) {
      console.log('  • Found in "dataq_analyzer" (INACTIVE)');
      console.log(`    playback.enabled: ${config2.playback?.enabled}`);
      console.log(`    playback.type: ${config2.playback?.type}`);
      console.log(`    playback.serverUrl: ${config2.playback?.serverUrl}`);
    } else {
      console.log('  ✗ Not found in "dataq_analyzer"');
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('Recommendation:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  The backend is configured to use: dataq-analyzer (hyphen)');
    console.log('  .env file: MONGODB_URI=...dataq-analyzer...');

    if (collections1.length > 0 && collections2.length > 0) {
      console.log('\n  ⚠ WARNING: You have data in both databases!');
      console.log('  You should migrate data from "dataq_analyzer" to "dataq-analyzer"');
      console.log('  or drop the unused database to avoid confusion.');
    } else if (collections2.length > collections1.length) {
      console.log('\n  ⚠ WARNING: "dataq_analyzer" has more data than the configured database!');
      console.log('  You may need to update .env to use "dataq_analyzer" instead.');
    }

    console.log('═══════════════════════════════════════════════════════════\n');

    await mongoose.connection.close();

  } catch (error) {
    console.error('Error checking databases:', error);
    process.exit(1);
  }
}

checkDatabases();
