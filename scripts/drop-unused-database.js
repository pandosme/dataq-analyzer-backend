/**
 * Script to drop the unused dataq_analyzer database
 * WARNING: This will permanently delete the database!
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function dropUnusedDatabase() {
  try {
    console.log('Connecting to MongoDB...\n');
    await mongoose.connect('mongodb://admin:admin@10.13.8.80:27017/admin?authSource=admin');

    const dataqAnalyzerUnderscoreDb = mongoose.connection.client.db('dataq_analyzer');

    // Show what will be deleted
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Database to be dropped: dataq_analyzer (underscore)');
    console.log('═══════════════════════════════════════════════════════════');

    const collections = await dataqAnalyzerUnderscoreDb.listCollections().toArray();
    if (collections.length === 0) {
      console.log('  Collections: (empty)');
    } else {
      console.log('  Collections:');
      for (const col of collections) {
        const count = await dataqAnalyzerUnderscoreDb.collection(col.name).countDocuments();
        console.log(`    • ${col.name} (${count} documents)`);
      }
    }

    console.log('\n⚠ WARNING: This action is PERMANENT and cannot be undone!');
    console.log('\nDropping database in 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Drop the database
    await dataqAnalyzerUnderscoreDb.dropDatabase();

    console.log('\n✓ Database "dataq_analyzer" has been dropped successfully');

    // Verify it's gone
    const adminDb = mongoose.connection.db.admin();
    const { databases } = await adminDb.listDatabases();
    const stillExists = databases.some(db => db.name === 'dataq_analyzer');

    if (!stillExists) {
      console.log('✓ Verified: Database no longer exists\n');
    } else {
      console.log('⚠ Warning: Database still appears in listing\n');
    }

    await mongoose.connection.close();

  } catch (error) {
    console.error('Error dropping database:', error);
    process.exit(1);
  }
}

dropUnusedDatabase();
