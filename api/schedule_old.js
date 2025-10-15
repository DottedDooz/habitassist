const express = require('express');
const db = require('../database/database');

const router = express.Router();

// API endpoint to get the schedule
router.get('/schedule_old', (req, res) => {
    db.all("SELECT * FROM default_schedule ORDER BY start_time", [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ schedule: rows });
    });
});

// API endpoint to add an event to the schedule
router.post('/schedule_old', (req, res) => {
    const { event, start_time, end_time } = req.body;
    if (!event || !start_time || !end_time) {
        res.status(400).json({ error: "Event, start_time, and end_time are required" });
        return;
    }
    const stmt = db.prepare("INSERT INTO default_schedule (event, start_time, end_time) VALUES (?, ?, ?)");
    stmt.run(event, start_time, end_time, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: this.lastID });
    });
    stmt.finalize();
});

module.exports = router;