const express = require('express');
const axios = require('axios');
const fs = require('fs').promises;
const { all, get, run } = require('../lib/db-helpers');
const {
    DAY_ORDER,
    VALID_HABIT_TYPES,
    VALID_COMPLETION_STATUSES,
    getCurrentDayName,
    resolveDayFilter,
    fetchDefaultSchedule,
    fetchDaySpecificSchedule,
    fetchCombinedScheduleForDay,
} = require('../lib/schedule-store');

const router = express.Router();

require('dotenv').config();

const handleUnexpectedError = (res, error, message = 'Internal server error') => {
    console.error(message, error);
    res.status(500).json({ error: message, details: error.message });
};

// --- Schedule endpoints ---------------------------------------------------
router.get('/schedule/default', async (_req, res) => {
    try {
        const schedule = await fetchDefaultSchedule();
        res.json({ schedule });
    } catch (error) {
        handleUnexpectedError(res, error, 'Failed to load default schedule');
    }
});

router.get('/schedule/day-specific', async (req, res) => {
    try {
        const dayFilter = resolveDayFilter(req.query.day);
        const schedule = await fetchDaySpecificSchedule(dayFilter);
        res.json({ schedule });
    } catch (error) {
        if (error.message === 'Invalid day parameter') {
            res.status(400).json({ error: error.message });
            return;
        }
        handleUnexpectedError(res, error, 'Failed to load day specific schedule');
    }
});

router.get('/schedule/combined', async (req, res) => {
    try {
        const resolvedDay =
            resolveDayFilter(req.query.day) ?? getCurrentDayName();
        const schedule = await fetchCombinedScheduleForDay(resolvedDay);
        res.json({ schedule });
    } catch (error) {
        if (error.message === 'Invalid day parameter') {
            res.status(400).json({ error: error.message });
            return;
        }
        handleUnexpectedError(res, error, 'Failed to load combined schedule');
    }
});

router.post('/schedule/default', async (req, res) => {
    const { id, event, start_time, end_time } = req.body;

    if (!event || !start_time || !end_time) {
        res
            .status(400)
            .json({ error: 'event, start_time, and end_time are required' });
        return;
    }

    try {
        if (id) {
            const { changes } = await run(
                'UPDATE default_schedule SET event = ?, start_time = ?, end_time = ? WHERE id = ?',
                [event, start_time, end_time, id],
            );
            if (!changes) {
                res.status(404).json({ error: 'Habit not found' });
                return;
            }
            res.json({ message: 'Habit updated successfully', id });
            return;
        }

        const { id: newId } = await run(
            'INSERT INTO default_schedule (event, start_time, end_time) VALUES (?, ?, ?)',
            [event, start_time, end_time],
        );
        res.status(201).json({ id: newId, message: 'Habit created successfully' });
    } catch (error) {
        handleUnexpectedError(res, error, 'Failed to save default habit');
    }
});

router.post('/schedule/day-specific', async (req, res) => {
    const { id, event, day_of_week, start_time, end_time } = req.body;

    if (!event || !day_of_week || !start_time || !end_time) {
        res.status(400).json({
            error: 'event, day_of_week, start_time, and end_time are required',
        });
        return;
    }

    const normalizedDay = (() => {
        try {
            return resolveDayFilter(day_of_week) ?? null;
        } catch (error) {
            return null;
        }
    })();

    if (!normalizedDay) {
        res.status(400).json({ error: 'Invalid day_of_week value' });
        return;
    }

    try {
        if (id) {
            const { changes } = await run(
                'UPDATE day_specific_schedule SET event = ?, day_of_week = ?, start_time = ?, end_time = ? WHERE id = ?',
                [event, normalizedDay, start_time, end_time, id],
            );
            if (!changes) {
                res.status(404).json({ error: 'Habit not found' });
                return;
            }
            res.json({ message: 'Day specific habit updated successfully', id });
            return;
        }

        const { id: newId } = await run(
            'INSERT INTO day_specific_schedule (event, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)',
            [event, normalizedDay, start_time, end_time],
        );
        res
            .status(201)
            .json({ id: newId, message: 'Day specific habit created successfully' });
    } catch (error) {
        handleUnexpectedError(res, error, 'Failed to save day specific habit');
    }
});

router.delete('/schedule/:type/:id', async (req, res) => {
    const { type, id } = req.params;

    if (!['default', 'day-specific'].includes(type)) {
        res.status(400).json({ error: 'Invalid habit type' });
        return;
    }

    const table =
        type === 'default' ? 'default_schedule' : 'day_specific_schedule';

    try {
        const { changes } = await run(`DELETE FROM ${table} WHERE id = ?`, [id]);
        if (!changes) {
            res.status(404).json({ error: 'Habit not found' });
            return;
        }
        res.json({ message: 'Habit deleted successfully' });
    } catch (error) {
        handleUnexpectedError(res, error, 'Failed to delete habit');
    }
});

// --- Completion endpoints -------------------------------------------------
const parsePaginationInt = (value, { defaultValue = 0, min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return defaultValue;
    return Math.min(Math.max(parsed, min), max);
};

const DEFAULT_COMPLETION_LIMIT = 25;
const MAX_COMPLETION_LIMIT = 500;

router.get('/completions', async (req, res) => {
    try {
        const limit = parsePaginationInt(req.query.limit, {
            defaultValue: DEFAULT_COMPLETION_LIMIT,
            min: 1,
            max: MAX_COMPLETION_LIMIT,
        });
        const offset = parsePaginationInt(req.query.offset, {
            defaultValue: 0,
            min: 0,
        });

        const completions = await all(
            'SELECT * FROM habit_completions ORDER BY completion_date DESC LIMIT ? OFFSET ?',
            [limit, offset],
        );
        const { total = 0 } =
            (await get('SELECT COUNT(*) as total FROM habit_completions')) || {};
        const nextOffset = offset + completions.length;
        const hasMore = nextOffset < total;

        res.json({
            completions,
            total,
            limit,
            offset,
            nextOffset,
            hasMore,
        });
    } catch (error) {
        handleUnexpectedError(res, error, 'Failed to load completions');
    }
});

router.post('/completions', async (req, res) => {
    const { habit_id, habit_type, status, completion_date } = req.body;

    if (!habit_id || !habit_type || !status) {
        res
            .status(400)
            .json({ error: 'habit_id, habit_type, and status are required' });
        return;
    }

    if (
        !VALID_HABIT_TYPES.includes(habit_type) ||
        !VALID_COMPLETION_STATUSES.includes(status)
    ) {
        res.status(400).json({ error: 'Invalid habit_type or status' });
        return;
    }

    try {
        const { id } = await run(
            'INSERT INTO habit_completions (habit_id, habit_type, status, completion_date) VALUES (?, ?, ?, ?)',
            [habit_id, habit_type, status, completion_date || null],
        );
        res
            .status(201)
            .json({ id, message: 'Habit completion recorded successfully' });
    } catch (error) {
        handleUnexpectedError(res, error, 'Failed to record completion');
    }
});

router.put('/completions/:id', async (req, res) => {
    const { id } = req.params;
    const { status, completion_date } = req.body;

    if (!status || !VALID_COMPLETION_STATUSES.includes(status)) {
        res.status(400).json({ error: 'Valid status is required' });
        return;
    }

    try {
        const { changes } = await run(
            'UPDATE habit_completions SET status = ?, completion_date = COALESCE(?, completion_date) WHERE id = ?',
            [status, completion_date || null, id],
        );
        if (!changes) {
            res.status(404).json({ error: 'Completion not found' });
            return;
        }
        res.json({ message: 'Habit completion updated successfully' });
    } catch (error) {
        handleUnexpectedError(res, error, 'Failed to update completion');
    }
});

router.delete('/completions/:id', async (req, res) => {
    try {
        const { changes } = await run('DELETE FROM habit_completions WHERE id = ?', [
            req.params.id,
        ]);
        if (!changes) {
            res.status(404).json({ error: 'Completion not found' });
            return;
        }
        res.json({ message: 'Habit completion deleted successfully' });
    } catch (error) {
        handleUnexpectedError(res, error, 'Failed to delete completion');
    }
});

// --- Day analysis ---------------------------------------------------------
router.post('/analyze-day', async (req, res) => {
    const { date } = req.body;

    if (!date) {
        res.status(400).json({ error: 'Date is required in YYYY-MM-DD format' });
        return;
    }

    try {
        const dayOfWeek = new Date(date).toLocaleString('en-us', {
            weekday: 'long',
        });

        const [defaultHabits, specificHabits, completions] = await Promise.all([
            fetchDefaultSchedule().then((habits) =>
                habits.map((habit) => ({ ...habit, type: 'default' })),
            ),
            fetchDaySpecificSchedule(dayOfWeek).then((habits) =>
                habits.map((habit) => ({ ...habit, type: 'day-specific' })),
            ),
            all(
                'SELECT * FROM habit_completions WHERE DATE(completion_date) = ?',
                [date],
            ),
        ]);

        const allHabits = [...defaultHabits, ...specificHabits];
        const completedHabitIds = new Set(
            completions.map((completion) => `${completion.habit_id}-${completion.habit_type}`),
        );
        const skippedHabits = allHabits.filter((habit) => {
            const habitKey = `${habit.id}-${habit.type}`;
            return !completedHabitIds.has(habitKey);
        });

        const prompt = createPrompt(dayOfWeek, allHabits, completions, skippedHabits);
        const openaiResponse = await queryOpenAI(prompt);
        const responseText = openaiResponse.data.choices[0].message.content;

        const outputFileName = 'WorkSummary';
        const audioFilePath = `C:/Users/DottedAnt/Documents/bark/voices/${outputFileName}.wav`;

        let retries = 300;
        while (retries > 0) {
            try {
                await axios.get('http://127.0.0.1:5000/generate_audio');
                break;
            } catch (error) {
                retries -= 1;
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }

        if (retries === 0) throw new Error('TTS server failed to start');

        const encodedText = encodeURIComponent(responseText);
        const ttsUrl = `http://127.0.0.1:5000/generate_audio?text=${encodedText}&speaker=ranni_full&output=${outputFileName}`;
        await axios.get(ttsUrl);

        const audioBuffer = await fs.readFile(audioFilePath);

        res.json({
            success: true,
            prompt,
            openaiResponse: responseText,
            date,
            completions,
            skippedHabits,
            audio: audioBuffer.toString('base64'),
        });
    } catch (error) {
        handleUnexpectedError(res, error, 'Failed to analyze day');
    }
});

function createPrompt(dayOfWeek, allHabits, completions, skippedHabits) {
    let prompt = `Analyze the habit completion for ${dayOfWeek}:\n\n`;

    prompt += 'Completed Habits:\n';
    completions.forEach((completion) => {
        const habit = allHabits.find(
            (item) =>
                item.id === completion.habit_id && item.type === completion.habit_type,
        );
        if (habit) {
            prompt += `- ${habit.event} (${completion.habit_type}): ${completion.status} at ${habit.end_time}\n`;
        }
    });

    prompt += '\nSkipped Habits:\n';
    skippedHabits.forEach((habit) => {
        prompt += `- ${habit.event} (${habit.type})\n`;
    });

    prompt += '\n';

    return prompt;
}

async function queryOpenAI(prompt) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OpenAI API key is not set');

    const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content:
                        'You play the role of Ranni the Witch, from the popular Elden Ring game. Respond with the same tone and mannerisms as this character, no need to be perfectly nice, rudeness is acceptable. When given a list of habit data, analyize it styled in a way that matches your given role. Keep your response concise!',
                },
                { role: 'user', content: prompt },
            ],
            temperature: 0.7,
        },
        {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
        },
    );

    return response;
}

module.exports = router;
