const express = require('express');
const cors = require('cors');
const multer = require('multer');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const officeParser = require('officeparser');
const XLSX = require('xlsx');
const mammoth = require('mammoth');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Determine base directory for writable paths (use /tmp in serverless environments)
const isServerless = process.env.VERCEL || process.env.NOW_BUILD_TRIGGER;
const baseWritableDir = isServerless ? '/tmp' : __dirname;

const UPLOADS_DIR = path.join(baseWritableDir, 'uploads');
const CACHE_DIR = path.join(baseWritableDir, 'cache');
const DATA_DIR = path.join(baseWritableDir, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const PRELOAD_DIR = path.join(__dirname, 'documents');

[UPLOADS_DIR, CACHE_DIR, DATA_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});
if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}
if (!fs.existsSync(PRELOAD_DIR)) {
    fs.mkdirSync(PRELOAD_DIR, { recursive: true });
}

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        // Keep original file name but ensure it's safe
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, safeName);
    }
});

const upload = multer({ storage });

// Load Configuration
let config = { apiKey: '' };
const configPath = path.join(DATA_DIR, 'config.json');
if (fs.existsSync(configPath)) {
    try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
        console.error('Error loading config:', e);
    }
}

// Load Chat History
let chats = [];
const chatsPath = path.join(DATA_DIR, 'chats.json');
if (fs.existsSync(chatsPath)) {
    try {
        chats = JSON.parse(fs.readFileSync(chatsPath, 'utf8'));
    } catch (e) {
        console.error('Error loading chats:', e);
    }
}

function saveConfig() {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

function saveChats() {
    fs.writeFileSync(chatsPath, JSON.stringify(chats, null, 2), 'utf8');
}

// Helper: Get API Key
function getApiKey() {
    return process.env.GEMINI_API_KEY || config.apiKey;
}

// Helper Parsers
function parseOfficeFile(filepath) {
    return new Promise((resolve, reject) => {
        officeParser.parse(filepath, (data, err) => {
            if (err) return reject(err);
            resolve(data);
        });
    });
}

async function parseWordFile(filepath) {
    try {
        const result = await mammoth.extractRawText({ path: filepath });
        if (result.value && result.value.trim()) {
            return result.value;
        }
        throw new Error('Mammoth returned empty text');
    } catch (err) {
        // Fallback to officeparser
        return parseOfficeFile(filepath);
    }
}

function parseExcelFile(filepath) {
    const workbook = XLSX.readFile(filepath);
    let textContent = '';
    for (const sheetName of workbook.SheetNames) {
        textContent += `--- Sheet: ${sheetName} ---\n`;
        const sheet = workbook.Sheets[sheetName];
        // Convert sheet to CSV
        const csv = XLSX.utils.sheet_to_csv(sheet);
        textContent += csv + '\n\n';
    }
    return textContent;
}

// Parse uploaded files and cache their text contents
async function parseAndCacheFile(filename) {
    const filepath = path.join(UPLOADS_DIR, filename);
    const cachepath = path.join(CACHE_DIR, `${filename}.txt`);
    const ext = path.extname(filename).toLowerCase();

    console.log(`Parsing file: ${filename} (${ext})`);

    let text = '';
    try {
        if (ext === '.txt' || ext === '.md' || ext === '.json') {
            text = fs.readFileSync(filepath, 'utf8');
        } else if (ext === '.docx') {
            text = await parseWordFile(filepath);
        } else if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') {
            text = parseExcelFile(filepath);
        } else if (ext === '.pptx') {
            text = await parseOfficeFile(filepath);
        } else {
            // General fallback for office formats
            text = await parseOfficeFile(filepath);
        }

        fs.writeFileSync(cachepath, text, 'utf8');
        console.log(`Successfully cached: ${filename} (${text.length} chars)`);
        return true;
    } catch (err) {
        console.error(`Failed to parse ${filename}:`, err);
        return false;
    }
}

// RAG Search / Context Assembly
function searchDocuments(query, maxChars = 400000) {
    const cacheFiles = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.txt'));
    if (cacheFiles.length === 0) {
        return { context: '', citations: [] };
    }

    // Load all files
    let allDocContents = [];
    let totalLength = 0;

    for (const file of cacheFiles) {
        const filepath = path.join(CACHE_DIR, file);
        const originalName = file.substring(0, file.length - 4); // Strip '.txt'
        const content = fs.readFileSync(filepath, 'utf8');
        allDocContents.push({ filename: originalName, content });
        totalLength += content.length;
    }

    // If total content size is small, return everything. No chunking needed!
    if (totalLength <= maxChars) {
        let context = '';
        let citations = [];
        for (const doc of allDocContents) {
            context += `--- File: ${doc.filename} ---\n${doc.content}\n\n`;
            citations.push(doc.filename);
        }
        return { context, citations };
    }

    // Tokenize query to score chunks
    const stopwords = new Set(['the', 'a', 'an', 'is', 'of', 'to', 'and', 'in', 'it', 'for', 'on', 'with', 'as', 'at', 'by', 'this', 'that', 'from', 'you', 'me', 'your', 'my']);
    const queryTerms = query.toLowerCase()
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .split(/\s+/)
        .filter(term => term && !stopwords.has(term));

    // Chunking files (approx 2000 chars per chunk, splitting by paragraph/newline)
    let chunks = [];
    for (const doc of allDocContents) {
        const paragraphs = doc.content.split(/\n\n+/);
        let currentChunk = '';
        
        for (let i = 0; i < paragraphs.length; i++) {
            const p = paragraphs[i].trim();
            if (!p) continue;
            
            if (currentChunk.length + p.length > 2000) {
                if (currentChunk) chunks.push({ filename: doc.filename, text: currentChunk });
                currentChunk = p;
            } else {
                currentChunk = currentChunk ? currentChunk + '\n\n' + p : p;
            }
        }
        if (currentChunk) {
            chunks.push({ filename: doc.filename, text: currentChunk });
        }
    }

    // Score chunks
    chunks.forEach(chunk => {
        let score = 0;
        const chunkTextLower = chunk.text.toLowerCase();

        // Exact phrase bonus
        if (chunkTextLower.includes(query.toLowerCase())) {
            score += 150;
        }

        queryTerms.forEach(term => {
            // Count occurrences
            const regex = new RegExp('\\b' + term + '\\b', 'g');
            const count = (chunkTextLower.match(regex) || []).length;
            score += count * 10;
            
            // Substring match bonus
            if (count === 0 && chunkTextLower.includes(term)) {
                score += 2;
            }
        });

        chunk.score = score;
    });

    // Sort chunks by score
    chunks.sort((a, b) => b.score - a.score);

    // Compile top chunks
    let context = '';
    let citationsSet = new Set();
    let accumulatedLength = 0;

    for (const chunk of chunks) {
        if (chunk.score <= 0) continue; // Skip completely irrelevant chunks
        if (accumulatedLength + chunk.text.length > maxChars) break;

        context += `--- File: ${chunk.filename} (Relevance Score: ${chunk.score}) ---\n${chunk.text}\n\n`;
        citationsSet.add(chunk.filename);
        accumulatedLength += chunk.text.length;
    }

    // If no chunks matched query words, fallback to first few chunks of all docs
    if (context === '') {
        for (const doc of allDocContents.slice(0, 3)) {
            const excerpt = doc.content.substring(0, 2000);
            context += `--- File: ${doc.filename} (Excerpt) ---\n${excerpt}\n\n`;
            citationsSet.add(doc.filename);
        }
    }

    return {
        context,
        citations: Array.from(citationsSet)
    };
}

// API: Config Key
app.get('/api/config', (req, res) => {
    res.json({ hasApiKey: !!getApiKey() });
});

app.post('/api/config', (req, res) => {
    const { apiKey } = req.body;
    if (apiKey) {
        config.apiKey = apiKey;
        saveConfig();
        res.json({ success: true, message: 'API key saved successfully.' });
    } else {
        res.status(400).json({ error: 'API key is required.' });
    }
});

// API: List Files in Knowledge Base
app.get('/api/files', (req, res) => {
    if (!fs.existsSync(UPLOADS_DIR)) {
        return res.json([]);
    }
    const files = fs.readdirSync(UPLOADS_DIR);
    const fileList = files.map(filename => {
        const stats = fs.statSync(path.join(UPLOADS_DIR, filename));
        const cached = fs.existsSync(path.join(CACHE_DIR, `${filename}.txt`));
        return {
            filename,
            size: stats.size,
            uploadedAt: stats.mtime,
            cached
        };
    });
    res.json(fileList);
});

// API: Upload Files
app.post('/api/upload', upload.array('files'), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded.' });
    }

    const results = [];
    for (const file of req.files) {
        const success = await parseAndCacheFile(file.filename);
        results.push({ filename: file.originalname, success });
    }

    res.json({ message: 'Upload and parsing complete.', results });
});

// API: Parse File Temporarily (does not add to persistent knowledge base)
app.post('/api/parse-temp', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    const filename = req.file.filename;
    const filepath = path.join(UPLOADS_DIR, filename);
    const ext = path.extname(filename).toLowerCase();

    console.log(`Parsing temp file: ${filename} (${ext})`);

    try {
        let text = '';
        if (ext === '.txt' || ext === '.md' || ext === '.json') {
            text = fs.readFileSync(filepath, 'utf8');
        } else if (ext === '.docx') {
            text = await parseWordFile(filepath);
        } else if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') {
            text = parseExcelFile(filepath);
        } else if (ext === '.pptx') {
            text = await parseOfficeFile(filepath);
        } else {
            text = await parseOfficeFile(filepath);
        }

        // Clean up uploaded file immediately
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }

        res.json({ filename: req.file.originalname, text });
    } catch (err) {
        console.error(`Failed to parse temp file ${filename}:`, err);
        // Clean up on error
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }
        res.status(500).json({ error: 'Failed to parse file: ' + err.message });
    }
});

// API: Delete File
app.delete('/api/files/:filename', (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(UPLOADS_DIR, filename);
    const cachepath = path.join(CACHE_DIR, `${filename}.txt`);

    let deleted = false;
    if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        deleted = true;
    }
    if (fs.existsSync(cachepath)) {
        fs.unlinkSync(cachepath);
        deleted = true;
    }

    if (deleted) {
        res.json({ message: `File ${filename} deleted successfully.` });
    } else {
        res.status(404).json({ error: `File ${filename} not found.` });
    }
});

// API: Get Chats History
app.get('/api/history', (req, res) => {
    res.json(chats);
});

// API: Save/Update Chat Session
app.post('/api/history', (req, res) => {
    const { id, title, messages } = req.body;
    if (!id) return res.status(400).json({ error: 'Chat session ID is required.' });

    const existingIdx = chats.findIndex(c => c.id === id);
    const lastModified = new Date();

    if (existingIdx >= 0) {
        chats[existingIdx].messages = messages || chats[existingIdx].messages;
        chats[existingIdx].title = title || chats[existingIdx].title;
        chats[existingIdx].lastModified = lastModified;
    } else {
        chats.unshift({
            id,
            title: title || 'New Chat',
            messages: messages || [],
            createdAt: lastModified,
            lastModified
        });
    }

    saveChats();
    res.json(chats.find(c => c.id === id));
});

// API: Delete Chat Session
app.delete('/api/history/:id', (req, res) => {
    const id = req.params.id;
    const initialLen = chats.length;
    chats = chats.filter(c => c.id !== id);
    if (chats.length < initialLen) {
        saveChats();
        res.json({ message: `Chat ${id} deleted.` });
    } else {
        res.status(404).json({ error: `Chat ${id} not found.` });
    }
});

// API: Chat Query
app.post('/api/chat', async (req, res) => {
    const { message, chatId, attachments } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'Message is required.' });
    }

    const apiKey = getApiKey();
    if (!apiKey) {
        return res.status(400).json({ error: 'Gemini API Key is not configured. Please go to the Profile tab to add it.' });
    }

    // Retrieve context from knowledge base
    let { context, citations } = searchDocuments(message);

    // Incorporate temporary attachments sent with this specific message
    let finalCitations = [...citations];
    if (attachments && attachments.length > 0) {
        context += `\n--- Temporary Question Attachments ---\n`;
        attachments.forEach(att => {
            context += `[File: ${att.filename}]\n${att.text}\n\n`;
            if (!finalCitations.includes(att.filename)) {
                finalCitations.push(att.filename);
            }
        });
    }

    // Get chat session from history for context if available
    let conversationContext = '';
    if (chatId) {
        const chatSession = chats.find(c => c.id === chatId);
        if (chatSession && chatSession.messages && chatSession.messages.length > 0) {
            // Use the last 6 messages as chat history context
            const recentMessages = chatSession.messages.slice(-6);
            conversationContext = recentMessages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
        }
    }

    // Build API Prompt (Strictly no external knowledge)
    const systemInstruction = `You are Nova (v4.2), a friendly and precise AI Assistant. Your goal is to answer the user's questions based ONLY on the provided DOCUMENT CONTEXT.
- Keep your answers highly accurate, professional, and directly related to the documents.
- Answer the user's questions ONLY based on the provided DOCUMENT CONTEXT. If the answer cannot be found in the provided DOCUMENT CONTEXT, state clearly and politely: "I cannot find the answer in the uploaded documents."
- Under no circumstances should you use any external, general, or training data to synthesize answers if it is not supported by the document context.
- Always include a list of cited filenames at the very end of your response under a "Sources:" heading if you retrieved information from them. Format it as:
  
  Sources:
  - filename.docx
  - data.xlsx
`;

    const fullPrompt = `${systemInstruction}

DOCUMENT CONTEXT:
${context || 'No documents in knowledge repository.'}

CONVERSATION HISTORY:
${conversationContext || 'No previous messages.'}

USER QUESTION:
${message}

Response:`;

    console.log(`Sending prompt to Gemini API... (Prompt length: ${fullPrompt.length})`);
    
    // Call Gemini API via fetch
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: fullPrompt
                            }
                        ]
                    }
                ]
            })
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Gemini API returned status ${response.status}: ${errBody}`);
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
            const replyText = data.candidates[0].content.parts[0].text;
            res.json({
                response: replyText,
                citations: finalCitations
            });
        } else {
            throw new Error('Unexpected Gemini API response structure: ' + JSON.stringify(data));
        }
    } catch (err) {
        console.error('Gemini API Error:', err);
        res.status(500).json({ error: 'Failed to generate response from AI model. Details: ' + err.message });
    }
});

// Serve static frontend files
app.use(express.static(PUBLIC_DIR));

// Fallback for frontend SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

async function preloadDocuments() {
    console.log(`Checking for preloaded documents in: ${PRELOAD_DIR}`);
    if (!fs.existsSync(PRELOAD_DIR)) {
        return;
    }
    try {
        const files = fs.readdirSync(PRELOAD_DIR);
        console.log(`Found ${files.length} preloaded files to process.`);
        for (const file of files) {
            if (file.startsWith('.')) continue; // skip hidden files
            
            const srcPath = path.join(PRELOAD_DIR, file);
            const destPath = path.join(UPLOADS_DIR, file);
            
            // Check if file is already copied or if sizes differ
            if (!fs.existsSync(destPath) || fs.statSync(srcPath).size !== fs.statSync(destPath).size) {
                console.log(`Copying preloaded file to uploads: ${file}`);
                fs.copyFileSync(srcPath, destPath);
            }
            
            // Parse and cache
            await parseAndCacheFile(file);
        }
    } catch (err) {
        console.error('Error preloading documents:', err);
    }
}

// Start Server
app.listen(PORT, async () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    // Process committed knowledge repository files on startup
    await preloadDocuments();
});
