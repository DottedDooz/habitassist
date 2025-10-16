const express = require('express');
const path = require('path');
const multer = require('multer');
const {
    SAMPLE_DIRECTORY,
    ensureSampleDirectory,
    listNarrators,
    getNarratorById,
    createNarrator,
    updateNarrator,
    deleteNarrator,
    setDefaultNarrator,
    listSamples,
    createSample,
    deleteSample,
} = require('../services/narrator-service');
const {
    generateClipsForDate,
} = require('../services/audio-generation-service');

const router = express.Router();
const log = (...messages) => console.log('[narrators-api]', ...messages);
const logError = (message, error) =>
    console.error('[narrators-api]', message, error?.message ?? error);

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        ensureSampleDirectory()
            .then(() => cb(null, SAMPLE_DIRECTORY))
            .catch((error) => cb(error));
    },
    filename: (_req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e6)}${path.extname(
            file.originalname || '',
        )}`;
        cb(null, uniqueName);
    },
});

const upload = multer({ storage });

const parseBoolean = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
        if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
    }
    return undefined;
};

const handleUnexpectedError = (res, error, message = 'Internal server error') => {
    console.error(message, error);
    res.status(500).json({ error: message, details: error.message });
};

router.get('/narrators', async (_req, res) => {
    try {
        log('Fetching narrator list');
        const narrators = await listNarrators();
        res.json({ narrators });
    } catch (error) {
        logError('Failed to load narrators', error);
        handleUnexpectedError(res, error, 'Failed to load narrators');
    }
});

router.get('/narrators/:id', async (req, res) => {
    try {
        const id = Number.parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            res.status(400).json({ error: 'Invalid narrator id' });
            return;
        }
        const narrator = await getNarratorById(id);
        if (!narrator) {
            res.status(404).json({ error: 'Narrator not found' });
            return;
        }
        log(`Fetched narrator #${id}`);
        res.json({ narrator });
    } catch (error) {
        logError(`Failed to load narrator ${req.params.id}`, error);
        handleUnexpectedError(res, error, 'Failed to load narrator');
    }
});

router.post('/narrators', async (req, res) => {
    try {
        const payload = {
            name: req.body.name,
            role_prompt: req.body.role_prompt,
            style_prompt: req.body.style_prompt,
            voice: req.body.voice,
            sample_path: req.body.sample_path,
            temperature:
                req.body.temperature === undefined
                    ? undefined
            : Number.parseFloat(req.body.temperature),
            is_default: parseBoolean(req.body.is_default),
        };
        const narrator = await createNarrator(payload);
        log(`Created narrator #${narrator.id} (${narrator.name})`);
        res.status(201).json({ narrator });
    } catch (error) {
        logError('Failed to create narrator', error);
        if (error.message === 'name and role_prompt are required') {
            res.status(400).json({ error: error.message });
            return;
        }
        handleUnexpectedError(res, error, 'Failed to create narrator');
    }
});

router.put('/narrators/:id', async (req, res) => {
    try {
        const id = Number.parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            res.status(400).json({ error: 'Invalid narrator id' });
            return;
        }

        const payload = {
            name: req.body.name,
            role_prompt: req.body.role_prompt,
            style_prompt: req.body.style_prompt,
            voice: req.body.voice,
            sample_path: req.body.sample_path,
            temperature:
                req.body.temperature === undefined
                    ? undefined
            : Number.parseFloat(req.body.temperature),
            is_default: parseBoolean(req.body.is_default),
        };

        const narrator = await updateNarrator(id, payload);
        log(`Updated narrator #${id}`);
        res.json({ narrator });
    } catch (error) {
        logError(`Failed to update narrator ${req.params.id}`, error);
        if (error.message === 'Narrator not found') {
            res.status(404).json({ error: error.message });
            return;
        }
        handleUnexpectedError(res, error, 'Failed to update narrator');
    }
});

router.delete('/narrators/:id', async (req, res) => {
    try {
        const id = Number.parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            res.status(400).json({ error: 'Invalid narrator id' });
            return;
        }
        const narrator = await deleteNarrator(id);
        log(`Deleted narrator #${id}`);
        res.json({ narrator });
    } catch (error) {
        logError(`Failed to delete narrator ${req.params.id}`, error);
        if (error.message === 'Narrator not found') {
            res.status(404).json({ error: error.message });
            return;
        }
        handleUnexpectedError(res, error, 'Failed to delete narrator');
    }
});

router.post('/narrators/:id/default', async (req, res) => {
    try {
        const id = Number.parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            res.status(400).json({ error: 'Invalid narrator id' });
            return;
        }
        const narrator = await getNarratorById(id);
        if (!narrator) {
            res.status(404).json({ error: 'Narrator not found' });
            return;
        }
        await setDefaultNarrator(id);
        const updated = await getNarratorById(id);
        log(`Set narrator #${id} as default`);
        res.json({ narrator: updated });
    } catch (error) {
        logError(`Failed to set default narrator ${req.params.id}`, error);
        handleUnexpectedError(res, error, 'Failed to set default narrator');
    }
});

router.post('/narrators/:id/generate', async (req, res) => {
    try {
        const id = Number.parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            res.status(400).json({ error: 'Invalid narrator id' });
            return;
        }
        const narrator = await getNarratorById(id);
        if (!narrator) {
            res.status(404).json({ error: 'Narrator not found' });
            return;
        }

        const result = await generateClipsForDate({
            date: req.body.date,
            narratorId: id,
        });
        log(
            `Manual generation triggered for narrator #${id} on ${req.body.date ?? 'today'}: ${result.summary.ready}/${result.summary.total} ready`,
        );
        res.json(result);
    } catch (error) {
        logError(`Failed to generate clips for narrator ${req.params.id}`, error);
        handleUnexpectedError(res, error, 'Failed to generate audio clips');
    }
});

router.get('/narrator-samples', async (_req, res) => {
    try {
        log('Fetching narrator samples');
        const samples = await listSamples();
        res.json({ samples, directory: SAMPLE_DIRECTORY });
    } catch (error) {
        logError('Failed to load narrator samples', error);
        handleUnexpectedError(res, error, 'Failed to load narrator samples');
    }
});

router.post(
    '/narrator-samples',
    upload.single('sample'),
    async (req, res) => {
        try {
            if (!req.file) {
                res.status(400).json({ error: 'No sample file provided' });
                return;
            }
            const saved = await createSample({
                label: req.body.label,
                file_path: req.file.path,
            });
            log(`Uploaded narrator sample #${saved.id} (${saved.file_path})`);
            res.status(201).json({ sample: saved });
        } catch (error) {
            logError('Failed to upload narrator sample', error);
            handleUnexpectedError(res, error, 'Failed to upload narrator sample');
        }
    },
);

router.delete('/narrator-samples/:id', async (req, res) => {
    try {
        const id = Number.parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            res.status(400).json({ error: 'Invalid sample id' });
            return;
        }
        const removeFile = parseBoolean(req.query.removeFile);
        const sample = await deleteSample(id, { removeFile });
        log(`Deleted narrator sample #${id} removeFile=${Boolean(removeFile)}`);
        res.json({ sample });
    } catch (error) {
        logError(`Failed to delete narrator sample ${req.params.id}`, error);
        if (error.message === 'Sample not found') {
            res.status(404).json({ error: error.message });
            return;
        }
        handleUnexpectedError(res, error, 'Failed to delete narrator sample');
    }
});

module.exports = router;
