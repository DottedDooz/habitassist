const express = require('express');
const path = require('path');
const { get, all } = require('../lib/db-helpers');
const { VALID_HABIT_TYPES } = require('../lib/schedule-store');

const router = express.Router();
const projectRoot = path.join(__dirname, '..');

const VALID_TYPE_SET = new Set(VALID_HABIT_TYPES);

const normalizeHabitType = (rawType) => {
    if (!rawType) return null;
    const normalized = String(rawType).trim().toLowerCase();
    if (normalized === 'default' || normalized === 'defaults') return 'default';
    if (normalized === 'day-specific' || normalized === 'day_specific' || normalized === 'dayspecific') {
        return 'day-specific';
    }
    return null;
};

const toIsoDate = (rawDate) => {
    if (!rawDate) {
        return new Date().toISOString().split('T')[0];
    }
    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.valueOf())) {
        throw new Error('Invalid date format; expected YYYY-MM-DD');
    }
    return parsed.toISOString().split('T')[0];
};

const resolveClipRecord = async ({ habitType, habitId, isoDate }) =>
    await get(
        `
        SELECT *
        FROM habit_audio_clips
        WHERE habit_id = ? AND habit_type = ? AND scheduled_date = ?
    `,
        [habitId, habitType, isoDate],
    );

const handleUnexpectedError = (res, error, message = 'Internal server error') => {
    console.error(message, error);
    res.status(500).json({ error: message, details: error.message });
};

router.get('/audio/habit/:habitType/:habitId', async (req, res) => {
    try {
        const habitType = normalizeHabitType(req.params.habitType);
        if (!habitType || !VALID_TYPE_SET.has(habitType)) {
            res.status(400).json({ error: 'Invalid habit type' });
            return;
        }

        const habitId = Number.parseInt(req.params.habitId, 10);
        if (Number.isNaN(habitId)) {
            res.status(400).json({ error: 'Invalid habit id' });
            return;
        }

        const isoDate = toIsoDate(req.query.date);
        const clip = await resolveClipRecord({ habitType, habitId, isoDate });

        if (!clip) {
            res.status(404).json({ error: 'Audio clip not found for the given habit/date' });
            return;
        }

        if (clip.status !== 'ready') {
            res.status(409).json({
                error: `Clip status is '${clip.status}', cannot stream audio`,
                status: clip.status,
                message: clip.error_message,
            });
            return;
        }

        if (!clip.audio_path) {
            res.status(404).json({ error: 'No audio file stored for this clip' });
            return;
        }

        const absolutePath = path.isAbsolute(clip.audio_path)
            ? clip.audio_path
            : path.join(projectRoot, clip.audio_path);

        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Cache-Control', 'no-store');
        res.sendFile(absolutePath, (error) => {
            if (error) {
                console.error('Failed to send audio file:', error);
                if (!res.headersSent) {
                    res.status(error.statusCode ?? 500).json({ error: 'Failed to read audio file' });
                }
            }
        });
    } catch (error) {
        if (error.message.startsWith('Invalid date')) {
            res.status(400).json({ error: error.message });
            return;
        }
        handleUnexpectedError(res, error, 'Failed to stream habit audio');
    }
});

router.get('/audio/clips', async (req, res) => {
    try {
        const isoDate = toIsoDate(req.query.date);

        const clips = await all(
            `
            SELECT
                c.*,
                ds.event AS default_event,
                ss.event AS specific_event
            FROM habit_audio_clips c
            LEFT JOIN default_schedule ds
                ON c.habit_type = 'default' AND c.habit_id = ds.id
            LEFT JOIN day_specific_schedule ss
                ON c.habit_type = 'day-specific' AND c.habit_id = ss.id
            WHERE c.scheduled_date = ?
            ORDER BY c.habit_type, c.habit_id
        `,
            [isoDate],
        );

        const serialized = clips.map((clip) => ({
            id: clip.id,
            habit_id: clip.habit_id,
            habit_type: clip.habit_type,
            scheduled_date: clip.scheduled_date,
            narrator_id: clip.narrator_id,
            script: clip.script,
            audio_path: clip.audio_path,
            status: clip.status,
            error_message: clip.error_message,
            created_at: clip.created_at,
            updated_at: clip.updated_at,
            event:
                clip.habit_type === 'default'
                    ? clip.default_event
                    : clip.specific_event,
        }));

        res.json({ date: isoDate, clips: serialized });
    } catch (error) {
        if (error.message.startsWith('Invalid date')) {
            res.status(400).json({ error: error.message });
            return;
        }
        handleUnexpectedError(res, error, 'Failed to load audio clips');
    }
});

router.get('/audio', (_req, res) => {
    res.status(410).json({
        error: 'Legacy audio endpoint is no longer supported. Use /api/audio/habit/:habitType/:habitId instead.',
    });
});

module.exports = router;
