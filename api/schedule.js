const express = require('express');
const db = require('../database/database');
const axios = require('axios'); // For making HTTP requests to OpenAI
const { spawn } = require('child_process');
const fs = require('fs').promises; // Use promises for async file operations
const path = require('path');
const router = express.Router();

require('dotenv').config();

// Existing endpoint to get default schedule
router.get('/schedule/default', (req, res) => {
    db.all("SELECT * FROM default_schedule ORDER BY start_time", [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ schedule: rows });
    });
});

// New endpoint to get day-specific schedule
router.get('/schedule/day-specific', (req, res) => {
    const currentDay = new Date().toLocaleString('en-us', { weekday: 'long' }); // e.g., "Monday"

    db.all("SELECT * FROM day_specific_schedule WHERE day_of_week = ? ORDER BY day_of_week, start_time", [currentDay], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ schedule: rows });
    });
});

// New endpoint to get both default and day-specific habits, prioritizing day-specific
router.get('/schedule/combined', (req, res) => {
    // First, get the current day to filter day-specific habits
    const currentDay = new Date().toLocaleString('en-us', { weekday: 'long' }); // e.g., "Monday"

    // Fetch day-specific habits for today and all default habits
    db.all("SELECT * FROM day_specific_schedule WHERE day_of_week = ? ORDER BY start_time", [currentDay], (err, daySpecificRows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        db.all("SELECT * FROM default_schedule ORDER BY start_time", [], (err, defaultRows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            // Combine the arrays, with day-specific habits first
            const combinedSchedule = [...daySpecificRows, ...defaultRows];

            // Sort by start_time to ensure habits are ordered chronologically
            combinedSchedule.sort((a, b) => {
                return a.start_time.localeCompare(b.start_time);
            });

            res.json({ schedule: combinedSchedule });
        });
    });
});

// Endpoint to add or update a default habit
router.post('/schedule/default', (req, res) => {
    const { id, event, start_time, end_time } = req.body;
    if (!event || !start_time || !end_time) {
        res.status(400).json({ error: "Event, start_time, and end_time are required" });
        return;
    }

    if (id) { // Update existing habit
        const stmt = db.prepare("UPDATE default_schedule SET event = ?, start_time = ?, end_time = ? WHERE id = ?");
        stmt.run(event, start_time, end_time, id, (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: "Habit updated successfully", id: id });
        });
        stmt.finalize();
    } else { // Create new habit
        const stmt = db.prepare("INSERT INTO default_schedule (event, start_time, end_time) VALUES (?, ?, ?)");
        stmt.run(event, start_time, end_time, function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id: this.lastID });
        });
        stmt.finalize();
    }
});

// Endpoint to add or update a day-specific habit
router.post('/schedule/day-specific', (req, res) => {
    const { id, event, day_of_week, start_time, end_time } = req.body;
    if (!event || !day_of_week || !start_time || !end_time) {
        res.status(400).json({ error: "Event, day_of_week, start_time, and end_time are required" });
        return;
    }

    if (id) { // Update existing day-specific habit
        const stmt = db.prepare("UPDATE day_specific_schedule SET event = ?, day_of_week = ?, start_time = ?, end_time = ? WHERE id = ?");
        stmt.run(event, day_of_week, start_time, end_time, id, (err) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: "Day-specific habit updated successfully", id: id });
        });
        stmt.finalize();
    } else { // Create new day-specific habit
        const stmt = db.prepare("INSERT INTO day_specific_schedule (event, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)");
        stmt.run(event, day_of_week, start_time, end_time, function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id: this.lastID });
        });
        stmt.finalize();
    }
});

// Endpoint to delete a habit (both default and day-specific)
router.delete('/schedule/:type/:id', (req, res) => {
    const { type, id } = req.params;
    let table = type === 'default' ? 'default_schedule' : 'day_specific_schedule';
    db.run(`DELETE FROM ${table} WHERE id = ?`, [id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: "Habit deleted successfully" });
    });
});


router.get('/completions', (req, res) => {
    db.all("SELECT * FROM habit_completions ORDER BY completion_date DESC", [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ completions: rows });
    });
});

// Add a new habit completion
router.post('/completions', (req, res) => {
    const { habit_id, habit_type, status, completion_date } = req.body;

    if (!habit_id || !habit_type || !status) {
        res.status(400).json({ error: "habit_id, habit_type, and status are required" });
        return;
    }

    // Validate habit_type and status
    if (!['default', 'day-specific'].includes(habit_type) || !['partially_completed', 'completed', 'perfectly_completed'].includes(status)) {
        res.status(400).json({ error: "Invalid habit_type or status" });
        return;
    }

    // Use provided completion_date or default to CURRENT_TIMESTAMP
    const stmt = db.prepare("INSERT INTO habit_completions (habit_id, habit_type, status, completion_date) VALUES (?, ?, ?, ?)");
    stmt.run(habit_id, habit_type, status, completion_date || null, (err) => { // null will use DEFAULT CURRENT_TIMESTAMP
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: this.lastID, message: "Habit completion recorded" });
    });
    stmt.finalize();
});

// Update a habit completion (e.g., change status)
router.put('/completions/:id', (req, res) => {
    const { id } = req.params;
    const { status, completion_date } = req.body;

    if (!status || !['partially_completed', 'completed', 'perfectly_completed'].includes(status)) {
        res.status(400).json({ error: "Valid status is required" });
        return;
    }

    const stmt = db.prepare("UPDATE habit_completions SET status = ?, completion_date = COALESCE(?, completion_date) WHERE id = ?");
    stmt.run(status, completion_date || null, id, (err) => { // COALESCE keeps existing date if not provided
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: "Habit completion updated" });
    });
    stmt.finalize();
});

router.post('/analyze-day', async (req, res) => {
    const { date } = req.body; // Expect a date in YYYY-MM-DD format

    if (!date) {
        return res.status(400).json({ error: "Date is required in YYYY-MM-DD format" });
    }

    try {
        // Step 1: Fetch all habits for the day (default and day-specific)
        const dayOfWeek = new Date(date).toLocaleString('en-us', { weekday: 'long' });
        const defaultHabits = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM default_schedule", [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(row => ({ ...row, type: 'default' }))); // Add type explicitly
            });
        });

        const specificHabits = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM day_specific_schedule WHERE day_of_week = ?", [dayOfWeek], (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(row => ({ ...row, type: 'day-specific' }))); // Add type explicitly
            });
        });

        // Step 2: Fetch all completions for that day
        const completions = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM habit_completions WHERE DATE(completion_date) = ?", [date], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Step 3: Identify skipped tasks (habits without completions)
        const allHabits = [...defaultHabits, ...specificHabits];
        const completedHabitIds = new Set(completions.map(c => `${c.habit_id}-${c.habit_type}`));
        const skippedHabits = allHabits.filter(habit => {
            const habitKey = `${habit.id}-${habit.type}`; // Use the explicitly added type
            return !completedHabitIds.has(habitKey);
        });


        // Step 4: Create the prompt
        const prompt = createPrompt(dayOfWeek, allHabits, completions, skippedHabits);

        // Step 5: Send to OpenAI
        const openaiResponse = await queryOpenAI(prompt);
        const responseText = openaiResponse.data.choices[0].message.content;
        console.log("OpenAI Response has been generated");
        console.log(responseText);

        // Step 5: Start TTS server and generate audio
        const ttsServerPath = 'c:/Users/DottedAnt/Documents/bark/server_host.py';
        const pythonPath = 'C:/Users/DottedAnt/AppData/Local/Programs/Python/Python310/python.exe';
        const outputFileName = 'WorkSummary'; // You can make this dynamic if needed
        const audioFilePath = `C:/Users/DottedAnt/Documents/bark/voices/${outputFileName}.wav`;

        // Start the TTS server
        //const ttsProcess = spawn(pythonPath, [ttsServerPath]);
        // Wait for the server to start (adjust delay as needed)
        //await new Promise(resolve => setTimeout(resolve, 300000)); // 5-minute delay to ensure server starts

        // Check if the server is running (optional)
        let retries = 300;
        while (retries > 0) {
            try {
                await axios.get('http://127.0.0.1:5000/generate_audio');
                break;
            } catch (error) {
                retries--;
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            }
        }
        if (retries === 0) throw new Error('TTS server failed to start');
        console.log("TTS server is running");
        // Step 6: Send OpenAI response text to TTS server
        const encodedText = encodeURIComponent(responseText);
        const ttsUrl = `http://127.0.0.1:5000/generate_audio?text=${encodedText}&speaker=ranni_full&output=${outputFileName}`;
        
        await axios.get(ttsUrl);

        // Step 7: Read the generated audio file
        const audioBuffer = await fs.readFile(audioFilePath);

        // Step 8: Stop the TTS server to save resources
        //ttsProcess.kill('SIGTERM'); // Gracefully terminate the process

        // Step 9: Send response with audio data
        res.json({
            success: true,
            prompt: prompt,
            openaiResponse: responseText,
            date: date,
            completions: completions,
            skippedHabits: skippedHabits,
            audio: audioBuffer.toString('base64') // Send audio as base64 string
        });

    } catch (error) {
        console.error('Error analyzing day:', error);
        res.status(500).json({ error: 'Failed to analyze day', details: error.message });
    }
});

function createPrompt(dayOfWeek, allHabits, completions, skippedHabits) {
    let prompt = `Analyze the habit completion for ${dayOfWeek}:\n\n`;

    prompt += "Completed Habits:\n";
    completions.forEach(completion => {
        const habit = allHabits.find(h => h.id === completion.habit_id && h.type === completion.habit_type);
        if (habit) {
            prompt += `- ${habit.event} (${completion.habit_type}): ${completion.status} at ${habit.end_time}\n`;
        }
    });

    prompt += "\nSkipped Habits:\n";
    skippedHabits.forEach(habit => {
        prompt += `- ${habit.event} (${habit.type})\n`;
    });

    prompt += "\n";

    return prompt;
}

async function queryOpenAI(prompt) {
    const apiKey = process.env.OPENAI_API_KEY; // Store in environment variables
    if (!apiKey) throw new Error('OpenAI API key is not set');

    const model = "gpt-4o"; // Or "gpt-4" if you have access
    const messages = [
        { role: "system", content: "You play the role of Ranni the Witch, from the popular Elden Ring game. Respond with the same tone and mannerisms as this character, no need to be perfectly nice, rudeness is acceptable. When given a list of habit data, analyize it styled in a way that matches your given role. Keep your response concise!" },
        { role: "user", content: prompt }
    ];
    const temperature = 0.7; // Adjust for creativity vs. focus

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: model,
        messages: messages,
        temperature: temperature,
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        }
    });

    return response;
}

module.exports = router;