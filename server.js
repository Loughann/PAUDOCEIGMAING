/* ==========================================================================
   Node.js Server Database for Flappy Canarinho
   Provides persistent server-side JSON database & static file serving.
   Runs on PORT 8080. No dependencies required (uses built-in http/fs/path).
   ========================================================================== */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8080;
const DB_FILE = path.join(__dirname, 'database.json');

// Initialize database file if it doesn't exist
if (!fs.existsSync(DB_FILE)) {
    const defaultDb = {
        registeredUsers: [],
        globalDeposits: [],
        globalWithdrawals: [],
        affiliateLogs: [],
        userBalances: {},
        userTransactions: {},
        userMatches: {},
        userWagered: {},
        userRollover: {},
        highScores: {},
        userRtpOverrides: {},
        settings: {
            flappy_rtp: "100",
            flappy_pipe_payout_pct: "20",
            flappy_difficulty_gap: "180",
            flappy_difficulty_speed: "150",
            flappy_inf_gap: "220",
            flappy_inf_speed: "140",
            flappy_inf_collision: "LENIENT",
            flappy_min_deposit: "10.00",
            flappy_min_withdraw: "20.00",
            flappy_rollover_mult: "0",
            flappy_ref_bonus_amount: "5.00",
            flappy_tier_1_val: "20.00",
            flappy_tier_1_pct: "10",
            flappy_tier_2_val: "50.00",
            flappy_tier_2_pct: "25",
            flappy_tier_3_val: "100.00",
            flappy_tier_3_pct: "50",
            flappy_gateway_pubkey: "",
            flappy_gateway_seckey: "",
            flappy_pixel_facebook_id: "",
            flappy_pixel_tiktok_id: ""
        }
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 2), 'utf8');
    console.log("Database file initialized:", DB_FILE);
}

function readDb() {
    try {
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        console.error("Error reading database.json:", e);
        return {};
    }
}

function writeDb(db) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
    } catch (e) {
        console.error("Error writing to database.json:", e);
    }
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    // CORS headers to prevent browser blocks
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // JSON response helper
    const sendJson = (statusCode, data) => {
        res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
    };

    // API: GET database
    if (pathname === '/api/db' && method === 'GET') {
        sendJson(200, readDb());
        return;
    }

    // API: POST sync database from client
    if (pathname === '/api/sync' && method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const clientDb = JSON.parse(body);
                if (clientDb && clientDb.registeredUsers && Array.isArray(clientDb.registeredUsers)) {
                    // Update server db with client data
                    const db = readDb();
                    db.registeredUsers = clientDb.registeredUsers;
                    db.globalDeposits = clientDb.globalDeposits;
                    db.globalWithdrawals = clientDb.globalWithdrawals;
                    db.affiliateLogs = clientDb.affiliateLogs;
                    db.userBalances = Object.assign(db.userBalances || {}, clientDb.userBalances);
                    db.userTransactions = Object.assign(db.userTransactions || {}, clientDb.userTransactions);
                    db.userMatches = Object.assign(db.userMatches || {}, clientDb.userMatches);
                    db.userWagered = Object.assign(db.userWagered || {}, clientDb.userWagered);
                    db.userRollover = Object.assign(db.userRollover || {}, clientDb.userRollover);
                    db.highScores = Object.assign(db.highScores || {}, clientDb.highScores);
                    db.userRtpOverrides = Object.assign(db.userRtpOverrides || {}, clientDb.userRtpOverrides);
                    db.settings = Object.assign(db.settings || {}, clientDb.settings);
                    
                    writeDb(db);
                    sendJson(200, { success: true });
                } else {
                    sendJson(400, { error: 'Invalid database payload' });
                }
            } catch (e) {
                console.error("Error during sync:", e);
                sendJson(400, { error: 'Malformed JSON' });
            }
        });
        return;
    }

    // Static files serving
    let filePath = '.' + pathname;
    if (filePath === './') {
        filePath = './index.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.wasm': 'application/wasm'
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';
    const safePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
    const finalPath = path.join(__dirname, safePath);

    fs.readFile(finalPath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`======================================================================`);
    console.log(`Flappy Canarinho Server Database running at: http://127.0.0.1:${PORT}/`);
    console.log(`Persistent file path: ${DB_FILE}`);
    console.log(`======================================================================`);
});
