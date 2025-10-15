const express = require('express');
const db = require('../database/database');

const router = express.Router();

// API endpoint to get visitors
router.get('/visitors', (req, res) => {
    db.all("SELECT * FROM visitors", [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ visitors: rows });
    });
});

// API endpoint to add a visitor
router.post('/visitors', (req, res) => {
    const name = req.body.name;
    if (!name) {
        res.status(400).json({ error: "Name is required" });
        return;
    }
    const stmt = db.prepare("INSERT INTO visitors (name) VALUES (?)");
    stmt.run(name, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: this.lastID });
    });
    stmt.finalize();
});

module.exports = router;