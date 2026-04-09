require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/wsd_annotations';

// Define the same schema used in server.js to access the collection
const annotationResultSchema = new mongoose.Schema({
    participantName: String,
    sanitizedName: String,
    timestamp: { type: Date, default: Date.now }
}, { strict: false });

const AnnotationResult = mongoose.model('AnnotationResult', annotationResultSchema);

async function exportResults() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB.');

        // Fetch all results as plain JavaScript objects
        const results = await AnnotationResult.find({}).lean();

        // Remove MongoDB-specific fields like _id and __v for a cleaner JSON export
        const cleanedResults = results.map(({ _id, __v, ...rest }) => rest);

        const outputPath = path.join(__dirname, './annotations/annotations_export.json');
        
        // Ensure the directory exists before writing the file
        const dirPath = path.dirname(outputPath);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        
        fs.writeFileSync(outputPath, JSON.stringify(cleanedResults, null, 2), 'utf-8');
        
        console.log(`Successfully exported ${cleanedResults.length} annotation results to annotations_export.json!`);
        process.exit(0);
    } catch (error) {
        console.error('Error exporting results:', error);
        process.exit(1);
    }
}

exportResults();