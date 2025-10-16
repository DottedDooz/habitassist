const path = require('path');
const fs = require('fs').promises;
const { all, get, run } = require('../lib/db-helpers');

const projectRoot = path.join(__dirname, '..');
const SAMPLE_DIRECTORY =
    process.env.NARRATOR_SAMPLE_DIR ||
    path.join(projectRoot, 'audio', 'narrator-samples');

const ensureSampleDirectory = async () => {
    await fs.mkdir(SAMPLE_DIRECTORY, { recursive: true });
};

const listNarrators = async () =>
    await all(
        `
        SELECT
            n.*,
            COUNT(c.id) AS clip_count,
            SUM(CASE WHEN c.status = 'ready' THEN 1 ELSE 0 END) AS ready_clip_count
        FROM narrators n
        LEFT JOIN habit_audio_clips c ON c.narrator_id = n.id
        GROUP BY n.id
        ORDER BY n.is_default DESC, lower(n.name)
    `,
    ).then((rows) =>
        rows.map((row) => ({
            ...row,
            clip_count: Number.parseInt(row.clip_count ?? 0, 10),
            ready_clip_count: Number.parseInt(row.ready_clip_count ?? 0, 10),
        })),
    );

const getNarratorById = async (id) =>
    await get('SELECT * FROM narrators WHERE id = ?', [id]);

const setDefaultNarrator = async (id) => {
    await run(
        `
        UPDATE narrators
        SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END,
            updated_at = CURRENT_TIMESTAMP
    `,
        [id],
    );
};

const ensureDefaultNarrator = async () => {
    const defaultNarrator = await get(
        'SELECT * FROM narrators WHERE is_default = 1 LIMIT 1',
    );
    if (!defaultNarrator) {
        const firstNarrator = await get(
            'SELECT * FROM narrators ORDER BY id LIMIT 1',
        );
        if (firstNarrator) {
            await setDefaultNarrator(firstNarrator.id);
        }
    }
};

const createNarrator = async ({
    name,
    role_prompt,
    style_prompt = null,
    voice = null,
    sample_path = null,
    temperature = 0.7,
    is_default = false,
}) => {
    if (!name || !role_prompt) {
        throw new Error('name and role_prompt are required');
    }

    const normalizedTemperature =
        typeof temperature === 'number' ? temperature : 0.7;

    const { id } = await run(
        `
        INSERT INTO narrators (name, role_prompt, style_prompt, voice, sample_path, temperature, is_default)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
        [
            name,
            role_prompt,
            style_prompt,
            voice,
            sample_path,
            normalizedTemperature,
            is_default ? 1 : 0,
        ],
    );

    if (is_default) {
        await setDefaultNarrator(id);
    } else {
        await ensureDefaultNarrator();
    }

    return await getNarratorById(id);
};

const updateNarrator = async (
    id,
    {
        name,
        role_prompt,
        style_prompt,
        voice,
        sample_path,
        temperature,
        is_default,
    },
) => {
    const narrator = await getNarratorById(id);
    if (!narrator) {
        throw new Error('Narrator not found');
    }

    const assigns = [];
    const params = [];

    const pushAssign = (column, value) => {
        assigns.push(`${column} = ?`);
        params.push(value);
    };

    if (name !== undefined) pushAssign('name', name);
    if (role_prompt !== undefined) pushAssign('role_prompt', role_prompt);
    if (style_prompt !== undefined) pushAssign('style_prompt', style_prompt);
    if (voice !== undefined) pushAssign('voice', voice);
    if (sample_path !== undefined) pushAssign('sample_path', sample_path);
    if (temperature !== undefined) {
        const normalizedTemp =
            typeof temperature === 'number'
                ? temperature
                : Number.parseFloat(temperature);
        pushAssign(
            'temperature',
            Number.isFinite(normalizedTemp) ? normalizedTemp : narrator.temperature,
        );
    }

    if (assigns.length) {
        assigns.push('updated_at = CURRENT_TIMESTAMP');
        const sql = `UPDATE narrators SET ${assigns.join(', ')} WHERE id = ?`;
        params.push(id);
        await run(sql, params);
    }

    if (is_default) {
        await setDefaultNarrator(id);
    } else if (is_default === false && narrator.is_default) {
        // Prevent removing the last default narrator without reassigning
        await setDefaultNarrator(id);
    }

    await ensureDefaultNarrator();
    return await getNarratorById(id);
};

const deleteNarrator = async (id) => {
    const narrator = await getNarratorById(id);
    if (!narrator) {
        throw new Error('Narrator not found');
    }

    await run('DELETE FROM narrators WHERE id = ?', [id]);
    await ensureDefaultNarrator();

    return narrator;
};

const listSamples = async () => {
    await ensureSampleDirectory();
    return await all(
        `
        SELECT *
        FROM narrator_samples
        ORDER BY created_at DESC, lower(label)
    `,
    );
};

const createSample = async ({ label, file_path }) => {
    if (!file_path) throw new Error('file_path is required');
    await ensureSampleDirectory();

    const relativePath = path.relative(projectRoot, file_path);
    const resolvedLabel = label || path.basename(file_path);

    const { id } = await run(
        `
        INSERT INTO narrator_samples (label, file_path)
        VALUES (?, ?)
    `,
        [resolvedLabel, relativePath],
    );

    return await get('SELECT * FROM narrator_samples WHERE id = ?', [id]);
};

const deleteSample = async (id, { removeFile = false } = {}) => {
    const sample = await get('SELECT * FROM narrator_samples WHERE id = ?', [id]);
    if (!sample) throw new Error('Sample not found');

    await run('DELETE FROM narrator_samples WHERE id = ?', [id]);

    if (removeFile && sample.file_path) {
        try {
            const absolutePath = path.join(projectRoot, sample.file_path);
            await fs.unlink(absolutePath);
        } catch (error) {
            console.warn('Failed to remove sample file:', error.message);
        }
    }

    return sample;
};

const getSampleById = async (id) =>
    await get('SELECT * FROM narrator_samples WHERE id = ?', [id]);

const getDefaultNarrator = async () =>
    await get('SELECT * FROM narrators WHERE is_default = 1 LIMIT 1');

module.exports = {
    SAMPLE_DIRECTORY,
    ensureSampleDirectory,
    listNarrators,
    getNarratorById,
    getDefaultNarrator,
    createNarrator,
    updateNarrator,
    deleteNarrator,
    setDefaultNarrator,
    listSamples,
    createSample,
    deleteSample,
    getSampleById,
};
