require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const AnnotationSample = require('./models/AnnotationSample');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/wsd_annotations';
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB.'))
    .catch(err => console.error('MongoDB connection error:', err));

// Define Models for Session and Result Tracking
const userSessionSchema = new mongoose.Schema({
    participantName: String,
    sanitizedName: { type: String, unique: true },
    age: String,
    educationDegree: String,
    shuffledWords: [Number],
    currentIndex: { type: Number, default: 0 }
});
const UserSession = mongoose.model('UserSession', userSessionSchema);

const chunkCountSchema = new mongoose.Schema({
    chunkIndex: { type: Number, required: true, unique: true },
    count: { type: Number, default: 0 }
});
const ChunkCount = mongoose.model('ChunkCount', chunkCountSchema);

const annotationResultSchema = new mongoose.Schema({
    participantName: String,
    sanitizedName: String,
    timestamp: { type: Date, default: Date.now }
}, { strict: false }); // strict: false allows dynamic annotationData fields
const AnnotationResult = mongoose.model('AnnotationResult', annotationResultSchema);

const sanitizeName = (name) => {
    if (!name) return 'results';
    const charMap = {
        'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u',
        'Ç': 'c', 'Ğ': 'g', 'İ': 'i', 'Ö': 'o', 'Ş': 's', 'Ü': 'u'
    };
    return name.replace(/[çğğıöşüÇĞİÖŞÜ]/g, match => charMap[match])
               .replace(/[^a-z0-9]/gi, '_')
               .toLowerCase();
};

// Endpoint to initialize session file
app.post('/api/init-session', async (req, res) => {
    try {
        const { participantName, age, educationDegree } = req.body;
        const sanitizedName = sanitizeName(participantName);
        
        let session = await UserSession.findOne({ sanitizedName });
        
        if (!session) {
            // --- NEW ASSIGNMENT LOGIC ---
            const TOTAL_CHUNKS = 200;      
            const CHUNKS_PER_USER = 50;    
            const MAX_ANNOTATIONS = 5;     

            // 1. Read global chunk counts
            const counts = await ChunkCount.find({});
            const countMap = {};
            counts.forEach(c => { countMap[c.chunkIndex] = c.count; });

            // 2. Filter chunks that haven't reached the max annotation limit yet
            let availableChunks = [];
            for (let i = 0; i < TOTAL_CHUNKS; i++) {
                const count = countMap[i] || 0;
                if (count < MAX_ANNOTATIONS) {
                    availableChunks.push({ index: i, count });
                }
            }

            // 3. Sort logic: Prioritize chunks with fewer annotations, then randomize
            availableChunks.sort((a, b) => {
                if (a.count !== b.count) return a.count - b.count;
                return Math.random() - 0.5; 
            });

            // 4. Select exactly 50 chunks for this specific user
            const selectedChunks = availableChunks.slice(0, CHUNKS_PER_USER);
            
            if (selectedChunks.length === 0) {
                 return res.status(400).json({ error: "No more tasks available. Dataset completed." });
            }

            // 5. Final shuffle
            selectedChunks.sort(() => Math.random() - 0.5);
            const shuffledWords = selectedChunks.map(c => c.index);

            // 6. Update and save the global chunk counts tracker
            const bulkOps = shuffledWords.map(idx => ({
                updateOne: {
                    filter: { chunkIndex: idx },
                    update: { $inc: { count: 1 } },
                    upsert: true
                }
            }));
            if (bulkOps.length > 0) {
                await ChunkCount.bulkWrite(bulkOps);
            }

            // 7. Save user session data
            session = await UserSession.create({
                participantName,
                sanitizedName,
                age,
                educationDegree,
                shuffledWords,
                currentIndex: 0
            });
            
            res.status(200).json({ message: "Session created successfully", currentIndex: 0, shuffledWords });
        } else {
            let currentIndex = session.currentIndex || 0;
            // Backwards compatibility: Fallback for older sessions that haven't explicitly saved their index yet
            if (currentIndex === 0) {
                const lastResult = await AnnotationResult.findOne({ sanitizedName }).sort({ timestamp: -1 });
                if (lastResult) return res.status(200).json({ message: "Session already exists", lastSampleId: lastResult.sample_id, shuffledWords: session.shuffledWords });
            }
            
            res.status(200).json({ message: "Session already exists", currentIndex, shuffledWords: session.shuffledWords });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Endpoint to initialize a test session with all samples sequentially (no shuffling)
app.post('/api/init-test-session', async (req, res) => {
    try {
        const { participantName, age, educationDegree } = req.body;
        const sanitizedName = sanitizeName(participantName);
        
        let session = await UserSession.findOne({ sanitizedName });
        
        if (!session) {
            const TOTAL_CHUNKS = 200;
            const sequentialWords = Array.from({ length: TOTAL_CHUNKS }, (_, i) => i);

            session = await UserSession.create({
                participantName,
                sanitizedName,
                age,
                educationDegree,
                shuffledWords: sequentialWords,
                currentIndex: 0
            });
            
            res.status(200).json({ message: "Test session created successfully", currentIndex: 0, shuffledWords: sequentialWords });
        } else {
            let currentIndex = session.currentIndex || 0;
            if (currentIndex === 0) {
                const lastResult = await AnnotationResult.findOne({ sanitizedName }).sort({ timestamp: -1 });
                if (lastResult) return res.status(200).json({ message: "File already exists", lastSampleId: lastResult.sample_id, shuffledWords: session.shuffledWords });
            }
            res.status(200).json({ message: "File already exists", currentIndex, shuffledWords: session.shuffledWords });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Endpoint to explicitly track the exact index location
app.post('/api/update-session-index', async (req, res) => {
    try {
        const { participantName, currentIndex } = req.body;
        const sanitizedName = sanitizeName(participantName);
        
        await UserSession.findOneAndUpdate(
            { sanitizedName },
            { $set: { currentIndex } }
        );
        
        res.status(200).send("Index updated");
    } catch (error) {
        console.error("Error updating index:", error);
        res.status(500).send("Error updating index");
    }
});

// Endpoint to save results
app.post('/api/save-annotation', async (req, res) => {
    try {
        const { participantName, ...annotationData } = req.body;
        const sanitizedName = sanitizeName(participantName);
        
        await AnnotationResult.findOneAndUpdate(
            { sanitizedName, sample_id: annotationData.sample_id },
            { 
                $set: { 
                    participantName,
                    sanitizedName,
                    ...annotationData 
                } 
            },
            { upsert: true, new: true }
        );
        
        res.status(200).send("Data saved successfully");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error saving data");
    }
});

// Endpoint to get all tasks
app.get('/api/tasks', async (req, res) => {
    try {
        // Fetch all samples previously seeded into MongoDB
        const tasks = await AnnotationSample.find({});
        
        // Map the array elements back into an object where the keys are the sample_id
        // The frontend expects this exact shape!
        const tasksObject = {};
        tasks.forEach(task => {
            tasksObject[task.sample_id] = task;
        });
        
        res.status(200).json(tasksObject);
    } catch (error) {
        console.error("Error reading tasks:", error);
        res.status(500).json({ error: "Internal Server Error: Could not fetch tasks." });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));