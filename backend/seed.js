require('dotenv').config();
const mongoose = require('mongoose');
const AnnotationSample = require('./models/AnnotationSample');
const rawData = require('./data/turkish_homonyms.json');

// Replace with your actual MongoDB connection string in your .env file
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/local_test';

async function seedDatabase() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB.');

    // Clear existing data to avoid duplicates if you run this multiple times
    await AnnotationSample.deleteMany({});
    console.log('Cleared existing samples.');

    // Clear tracking and result collections for a fresh deployment
    await mongoose.connection.collection('chunkcounts').deleteMany({});
    // await mongoose.connection.collection('usersessions').deleteMany({});
    // await mongoose.connection.collection('annotationresults').deleteMany({});
    console.log('Cleared old chunk counts. Kept existing user sessions and annotation results safe!');

    // Convert the JSON object into an array while preserving the original keys as 'sample_id'
    const samplesArray = Object.entries(rawData).map(([key, value]) => ({
        sample_id: key,
        ...value
    }));

    // Insert everything into the database
    await AnnotationSample.insertMany(samplesArray);
    
    console.log(`Successfully seeded ${samplesArray.length} samples into the database!`);
    process.exit(0);
  } catch (error) {
    console.error('Error seeding the database:', error);
    process.exit(1);
  }
}

seedDatabase();
