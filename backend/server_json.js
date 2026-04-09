const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Ensure the annotations directory exists
const annotationsDir = path.join(__dirname, 'annotations');
if (!fs.existsSync(annotationsDir)) {
    fs.mkdirSync(annotationsDir);
}

// Ensure the global chunk tracker exists
const chunkCountsFile = path.join(__dirname, 'chunk_counts.json');
if (!fs.existsSync(chunkCountsFile)) {
    // Initialize an empty object to track global chunk assignments
    fs.writeFileSync(chunkCountsFile, JSON.stringify({}));
}

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
app.post('/api/init-session', (req, res) => {
    const { participantName, age, educationDegree } = req.body;
    
    const sanitizedName = sanitizeName(participantName);
    const filePath = path.join(annotationsDir, `${sanitizedName}.json`);
    
    if (!fs.existsSync(filePath)) {
        // --- NEW ASSIGNMENT LOGIC ---
        // 1. Read global chunk counts
        let chunkCounts = {};
        try {
            chunkCounts = JSON.parse(fs.readFileSync(chunkCountsFile, 'utf8'));
        } catch (e) {
            console.error("Error reading chunk counts", e);
        }

        const TOTAL_CHUNKS = 200;      // Total homonym words available
        const CHUNKS_PER_USER = 50;    // Number of chunks given to each annotator
        const MAX_ANNOTATIONS = 5;     // Target number of annotations per chunk

        // 2. Filter chunks that haven't reached the max annotation limit yet
        let availableChunks = [];
        for (let i = 0; i < TOTAL_CHUNKS; i++) {
            const count = chunkCounts[i] || 0;
            if (count < MAX_ANNOTATIONS) {
                availableChunks.push({ index: i, count });
            }
        }

        // 3. Sort logic: Prioritize chunks with fewer annotations, then randomize
        availableChunks.sort((a, b) => {
            if (a.count !== b.count) return a.count - b.count; // Ascending by count
            return Math.random() - 0.5; // Randomize ties to break alphabetical order
        });

        // 4. Select exactly 50 chunks for this specific user
        const selectedChunks = availableChunks.slice(0, CHUNKS_PER_USER);
        
        if (selectedChunks.length === 0) {
             return res.status(400).json({ error: "No more tasks available. Dataset completed." });
        }

        // 5. Final shuffle: Randomize the user's 50 chunks so they appear in a random order
        selectedChunks.sort(() => Math.random() - 0.5);
        
        // Save these 50 indices into the shuffledWords array
        const shuffledWords = selectedChunks.map(c => c.index);

        // 6. Update and save the global chunk counts tracker
        shuffledWords.forEach(idx => {
            chunkCounts[idx] = (chunkCounts[idx] || 0) + 1;
        });
        fs.writeFileSync(chunkCountsFile, JSON.stringify(chunkCounts, null, 2));

        // 7. Save user session data
        const initialData = [{
            participantName,
            age,
            educationDegree,
            shuffledWords // This now holds an array of 50 randomly assigned chunk indices
        }];
        
        fs.writeFile(filePath, JSON.stringify(initialData, null, 2), (err) => {
            if (err) return res.status(500).json({ error: "Error creating file" });
            res.status(200).json({ message: "File created successfully", lastSampleId: null, shuffledWords });
        });
    } else {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) return res.status(500).json({ error: "Error reading file" });
            
            let json = [];
            try { json = JSON.parse(data); } catch (e) {}
            
            let lastSampleId = null;
            let shuffledWords = [];
            if (json.length > 0) {
                // Return the existing 50 chunks if the user reconnects/refreshes
                shuffledWords = json[0].shuffledWords || [];
            }
            if (json.length > 1) {
                lastSampleId = json[json.length - 1].sample_id;
            }
            res.status(200).json({ message: "File already exists", lastSampleId, shuffledWords });
        });
    }
});

// Endpoint to initialize a test session with all samples sequentially (no shuffling)
app.post('/api/init-test-session', (req, res) => {
    const { participantName, age, educationDegree } = req.body;
    
    const sanitizedName = sanitizeName(participantName);
    const filePath = path.join(annotationsDir, `${sanitizedName}.json`);
    
    if (!fs.existsSync(filePath)) {
        const TOTAL_CHUNKS = 200;
        const sequentialWords = Array.from({ length: TOTAL_CHUNKS }, (_, i) => i);

        const initialData = [{
            participantName,
            age,
            educationDegree,
            shuffledWords: sequentialWords
        }];
        
        fs.writeFile(filePath, JSON.stringify(initialData, null, 2), (err) => {
            if (err) return res.status(500).json({ error: "Error creating test file" });
            res.status(200).json({ message: "Test session created successfully", lastSampleId: null, shuffledWords: sequentialWords });
        });
    } else {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) return res.status(500).json({ error: "Error reading file" });
            
            let json = [];
            try { json = JSON.parse(data); } catch (e) {}
            
            let lastSampleId = null;
            let shuffledWords = [];
            if (json.length > 0) {
                shuffledWords = json[0].shuffledWords || [];
            }
            if (json.length > 1) {
                lastSampleId = json[json.length - 1].sample_id;
            }
            res.status(200).json({ message: "File already exists", lastSampleId, shuffledWords });
        });
    }
});

// Endpoint to save results
app.post('/api/save-annotation', (req, res) => {
    const { participantName, ...annotationData } = req.body;
    
    // We append the result to a local JSON file
    // In a real study, use a database like MongoDB or PostgreSQL
    const sanitizedName = sanitizeName(participantName);
    const filePath = path.join(annotationsDir, `${sanitizedName}.json`);
    
    fs.readFile(filePath, (err, data) => {
        let json = [];
        if (!err) {
            try { json = JSON.parse(data); } catch (e) {}
        }
        json.push({
            ...annotationData,
            timestamp: new Date().toISOString()
        });
        
        fs.writeFile(filePath, JSON.stringify(json, null, 2), (err) => {
            if (err) return res.status(500).send("Error saving data");
            res.status(200).send("Data saved successfully");
        });
    });
});

// Endpoint to get all tasks
app.get('/api/tasks', (req, res) => {
    const dataPath = path.join(__dirname, 'data', 'turkish_homonyms.json');
    fs.readFile(dataPath, 'utf8', (err, data) => {
        if (err) {
            console.error("Error reading tasks file:", err);
            return res.status(500).json({ error: "Internal Server Error: Could not read tasks data." });
        }
        res.status(200).json(JSON.parse(data));
    });
});

app.listen(5000, () => console.log('Server running on port 5000'));