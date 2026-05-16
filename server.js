// server.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

// --- CONFIGURATION ---
const ADMIN_PASSWORD = "admin"; // Change this to your preferred password
const SECRET_TOKEN = "alphestra-secret-token"; // Used to verify logged-in state

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- DATABASE SETUP ---
const db = new sqlite3.Database('./gym_database.sqlite', (err) => {
    if (err) console.error(err.message);
    else console.log('Connected to SQLite database.');
});

db.run(`CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    signup_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`);

// --- PUBLIC ROUTES ---
// 1. Save new lead from the main website
app.post('/api/join', (req, res) => {
    const { name, email, phone } = req.body;
    if (!name || !email || !phone) return res.status(400).json({ error: 'Missing fields' });

    db.run(`INSERT INTO leads (name, email, phone) VALUES (?, ?, ?)`, [name, email, phone], function (err) {
        if (err) return res.status(500).json({ error: 'Database Error' });
        res.status(200).json({ message: 'Success' });
    });
});


// --- ADMIN API ROUTES ---
// 2. Login Route
app.post('/api/login', (req, res) => {
    if (req.body.password === ADMIN_PASSWORD) {
        res.json({ token: SECRET_TOKEN }); // Send secret token if password matches
    } else {
        res.status(401).json({ error: "Invalid password" });
    }
});

// Middleware to check if user is logged in
const requireAuth = (req, res, next) => {
    const token = req.headers.authorization;
    if (token === SECRET_TOKEN) next();
    else res.status(403).json({ error: "Unauthorized access." });
};

// 3. Get all leads (Protected)
app.get('/api/leads', requireAuth, (req, res) => {
    db.all(`SELECT * FROM leads ORDER BY signup_date DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 4. Delete a lead (Protected)
app.delete('/api/leads/:id', requireAuth, (req, res) => {
    db.run(`DELETE FROM leads WHERE id = ?`, req.params.id, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Lead deleted successfully" });
    });
});

// 5. Export Data to CSV (Protected via URL parameter)
app.get('/api/export', (req, res) => {
    if (req.query.token !== SECRET_TOKEN) return res.status(403).send("Unauthorized");

    db.all(`SELECT * FROM leads ORDER BY signup_date DESC`, [], (err, rows) => {
        if (err) return res.status(500).send("Database Error");

        // Create CSV format
        let csv = "ID,Name,Email,Phone,Signup Date\n";
        rows.forEach(row => {
            csv += `${row.id},"${row.name}","${row.email}","${row.phone}","${row.signup_date}"\n`;
        });

        // Tell browser to download it as a file
        res.header('Content-Type', 'text/csv');
        res.attachment('alphestra_leads.csv');
        return res.send(csv);
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});