const express = require('express');
const db = require('../database/database');
const path = require('path');

const router = express.Router();

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min; // The maximum is inclusive and the minimum is inclusive
  }

// API endpoint to get visitors
router.get('/audio/:audio_event', (req, res) => {
    const audio_event = req.params.audio_event;
    db.all("SELECT count,dir FROM event_audio WHERE event = ?", [audio_event], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (row.length == 0) {
            res.status(400).json({ error: "No Audio was found for Event:"+audio_event });
            return;
        }
        const randomInt = getRandomInt(1, row[0].count);
        const filePath = path.join(__dirname, "../audio/"+row[0].dir+"_"+randomInt+".wav");
        res.sendFile(filePath);
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