const path = require('path');
const fs = require('fs').promises;
const { randomUUID } = require('crypto');
const { execSync } = require('child_process');
const axios = require('axios');
const cron = require('node-cron');
const { get, run } = require('../lib/db-helpers');
const { fetchHabitsForDate } = require('../lib/schedule-store');
const {
    getNarratorById,
    getDefaultNarrator,
} = require('./narrator-service');

const projectRoot = path.join(__dirname, '..');
const TTS_WARMUP_ATTEMPTS = Number.parseInt(
    process.env.TTS_WARMUP_ATTEMPTS ?? '300',
    10,
);
const TTS_WARMUP_DELAY_MS = Number.parseInt(
    process.env.TTS_WARMUP_DELAY_MS ?? '1000',
    10,
);
const TTS_OUTPUT_DIR =
    process.env.TTS_VOICES_DIR ||
    path.join(
        process.env.USERPROFILE || process.env.HOME || '.',
        'Documents',
        'bark',
        'voices',
    );
const GENERATED_AUDIO_DIR =
    process.env.HABIT_AUDIO_OUTPUT_DIR ||
    path.join(projectRoot, 'audio', 'generated');
const AUDIO_GENERATION_TIMEZONE =
    process.env.AUDIO_GENERATION_TZ || undefined;

let nightlyCronTask = null;

const ensureDirectory = async (dir) => {
    await fs.mkdir(dir, { recursive: true });
};

const log = (...messages) => {
    console.log('[audio-generation]', ...messages);
};

const logError = (message, error) => {
    const details = error?.message ?? error;
    console.error('[audio-generation]', message, details);
    if (error?.stack) {
        console.error(error.stack);
    }
};

const sanitizeBaseUrl = (value) => value.replace(/\/$/, '');

const detectGatewayAddress = () => {
    try {
        const output = execSync("ip route | awk '/default/ {print $3}'", {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
        if (output) {
            const gateway = output.split(/\s+/)[0];
            if (gateway) {
                log(`Detected default gateway at ${gateway}`);
                return gateway;
            }
        }
    } catch (error) {
        log('Unable to detect gateway address via ip route; continuing with fallback.');
    }
    return null;
};

const resolveTtsBaseUrl = () => {
    const explicitUrl = process.env.TTS_SERVER_URL;
    const port = process.env.TTS_SERVER_PORT || '5000';

    if (explicitUrl) {
        const sanitized = sanitizeBaseUrl(explicitUrl);
        log(`Using TTS server URL from environment: ${sanitized}`);
        return sanitized;
    }

    const gateway = detectGatewayAddress();
    if (gateway) {
        const gatewayUrl = sanitizeBaseUrl(`http://${gateway}:${port}`);
        log(`Using gateway-based TTS server URL: ${gatewayUrl}`);
        return gatewayUrl;
    }

    const localUrl = sanitizeBaseUrl(`http://127.0.0.1:${port}`);
    log(`Falling back to localhost TTS server URL: ${localUrl}`);
    return localUrl;
};

const TTS_BASE_URL = resolveTtsBaseUrl();
const TTS_GENERATE_PATH = process.env.TTS_GENERATE_PATH || '/generate_audio';
const TTS_GENERATE_URL = `${TTS_BASE_URL}${
    TTS_GENERATE_PATH.startsWith('/') ? TTS_GENERATE_PATH : `/${TTS_GENERATE_PATH}`
}`;

const wait = (ms) =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

const normalizeDateInput = (dateInput) => {
    const date =
        dateInput instanceof Date
            ? new Date(dateInput)
            : dateInput
                ? new Date(dateInput)
                : new Date();

    if (Number.isNaN(date.valueOf())) {
        throw new Error('Invalid date for clip generation');
    }

    const isoDate = date.toISOString().split('T')[0];
    return { date, isoDate };
};

const getNarratorOrDefault = async (narratorId) => {
    if (narratorId) {
        const narrator = await getNarratorById(narratorId);
        if (!narrator) throw new Error('Narrator not found');
        log(`Using narrator #${narratorId} (${narrator.name}) requested by caller.`);
        return narrator;
    }
    const narrator = await getDefaultNarrator();
    if (!narrator) throw new Error('No default narrator configured');
    log(`Using default narrator #${narrator?.id} (${narrator?.name})`);
    return narrator;
};

const buildMessages = ({ narrator, habit, dayName, isoDate }) => {
    const scheduleSummary = habit.start_time && habit.end_time
        ? `${habit.start_time} - ${habit.end_time}`
        : 'No time provided';
    const stylePrompt = narrator.style_prompt
        ? `\n\nStyle guidance: ${narrator.style_prompt.trim()}`
        : '';

    /*
    const instructions = [
        `Craft a short spoken line for the upcoming habit below.`,
        `Date: ${isoDate} (${dayName})`,
        `Habit: ${habit.event}`,
        `Schedule: ${scheduleSummary}`,
        `Habit type: ${habit.type}`,
        `Goals:`,
        `- Encourage the user to engage with this habit.`,
        `- Use a warm second-person tone.`,
        `- Keep it to 1-2 sentences.`,
        `- Reference the habit or its timing explicitly.`,
        stylePrompt,
    ]
        .filter(Boolean)
        .join('\n');
    */

    const instructions = [
        `Habit: ${habit.event}`,
        stylePrompt,
    ]
        .filter(Boolean)
        .join('\n');

    log("Instructions for TTS script generation:", instructions.replace(/\n/g, ' | '));
    
    system_prompt = narrator.role_prompt + " When given a Task, you should respond with a sentence that directs someone to do that Task. For example: 'User': 'Work', 'Your response': 'It's time to get back to work.', but styled in a way that matches your given role."
    log("System Prompt:", narrator.role_prompt.replace(/\n/g, ' | '));

    return [
        { role: 'system', content: system_prompt },
        { role: 'user', content: instructions },
    ];
};

const generateScriptForHabit = async ({
    narrator,
    habit,
    dayName,
    isoDate,
}) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

    const messages = buildMessages({ narrator, habit, dayName, isoDate });
    log(
        `Requesting script for ${habit.type}#${habit.id} (${habit.event}) on ${isoDate} using narrator "${narrator.name}"`,
    );
    const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
            model: process.env.TTS_SCRIPT_MODEL || 'gpt-4o',
            messages,
            temperature:
                typeof narrator.temperature === 'number'
                    ? narrator.temperature
                    : 0.7,
        },
        {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
        },
    );

    const choice = response?.data?.choices?.[0]?.message?.content;
    if (!choice) throw new Error('No script returned from OpenAI');
    const trimmed = choice.trim();
    log(
        `Script generated for ${habit.type}#${habit.id}: ${Math.min(trimmed.length, 180)} chars (total ${trimmed.length})`,
    );
    log("Script:", trimmed.replace(/\n/g, ' | '));
    return trimmed;
};

const ensureTtsServer = async () => {
    const attempts = Number.isFinite(TTS_WARMUP_ATTEMPTS)
        ? TTS_WARMUP_ATTEMPTS
        : 300;
    const delay = Number.isFinite(TTS_WARMUP_DELAY_MS)
        ? TTS_WARMUP_DELAY_MS
        : 1000;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            await axios.get(TTS_GENERATE_URL);
            if (attempt > 0) {
                log(`TTS server responded after ${attempt + 1} attempts`);
            }
            return;
        } catch (error) {
            logError(`TTS server check failed (attempt ${attempt + 1}/${attempts})`, error);
            if (attempt === attempts - 1) {
                throw new Error('TTS server failed to respond');
            }
            await wait(delay);
        }
    }
};

const waitForFile = async (filePath, timeoutMs = 150000, pollMs = 250) => {
    const maxChecks = Math.ceil(timeoutMs / pollMs);
    for (let i = 0; i < maxChecks; i += 1) {
        try {
            await fs.access(filePath);
            log(`Detected synthesized file at ${filePath}`);
            return;
        } catch (_err) {
            await wait(pollMs);
        }
    }
    throw new Error(`Timed out waiting for synthesized file: ${filePath}`);
};

const synthesizeAudio = async ({
    narrator,
    script,
    outputToken,
}) => {
    const params = new URLSearchParams();
    params.set('text', script);
    params.set('output', outputToken);
    if (narrator.voice) params.set('speaker', narrator.voice);
    if (narrator.sample_path) {
        const samplePath = path.isAbsolute(narrator.sample_path)
            ? narrator.sample_path
            : path.join(projectRoot, narrator.sample_path);
        params.set('sample', samplePath);
    }

    log(
        `Triggering TTS synthesis token=${outputToken} speaker=${narrator.voice ?? 'default'} sample=${narrator.sample_path ?? 'none'}`,
    );
    await axios.get(`${TTS_GENERATE_URL}?${params.toString()}`);

    const sourceFile = path.join(TTS_OUTPUT_DIR, `${outputToken}.wav`);
    await waitForFile(sourceFile);
    log(`TTS synthesis completed for token=${outputToken}`);
    return sourceFile;
};

const upsertClipRecord = async ({
    habit,
    isoDate,
    narrator,
    script,
    audioPath,
    status,
    errorMessage = null,
}) => {
    await run(
        `
        INSERT INTO habit_audio_clips
            (habit_id, habit_type, scheduled_date, narrator_id, script, audio_path, status, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(habit_id, habit_type, scheduled_date)
        DO UPDATE SET
            narrator_id = excluded.narrator_id,
            script = excluded.script,
            audio_path = excluded.audio_path,
            status = excluded.status,
            error_message = excluded.error_message,
            updated_at = CURRENT_TIMESTAMP
    `,
        [
            habit.id,
            habit.type,
            isoDate,
            narrator.id,
            script,
            audioPath,
            status,
            errorMessage,
        ],
    );
    log(
        `Clip record upserted ${habit.type}#${habit.id} ${isoDate} narrator=${narrator.id} status=${status}`,
    );
};

const removeExistingClipFile = async (habit, isoDate) => {
    const record = await get(
        `
        SELECT audio_path
        FROM habit_audio_clips
        WHERE habit_id = ? AND habit_type = ? AND scheduled_date = ?
    `,
        [habit.id, habit.type, isoDate],
    );

    if (record?.audio_path) {
        try {
            await fs.unlink(path.join(projectRoot, record.audio_path));
            log(
                `Removed previous audio file for ${habit.type}#${habit.id} (${isoDate})`,
            );
        } catch (error) {
            if (error.code !== 'ENOENT') {
                logError(
                    `Failed to delete previous audio file for ${habit.type}#${habit.id} (${isoDate})`,
                    error,
                );
            }
        }
    }
};

const generateClipForHabit = async ({
    habit,
    narrator,
    dayName,
    isoDate,
}) => {
    let script = '';
    try {
        log(
            `Starting generation for ${habit.type}#${habit.id} "${habit.event}" (${habit.start_time}-${habit.end_time}) on ${isoDate}`,
        );
        await removeExistingClipFile(habit, isoDate);

        script = await generateScriptForHabit({
            narrator,
            habit,
            dayName,
            isoDate,
        });

        await ensureTtsServer();

        const outputToken = `habit_${habit.type}_${habit.id}_${isoDate}_${randomUUID()}`;
        const sourceFile = await synthesizeAudio({
            narrator,
            script,
            outputToken,
        });

        const dailyDir = path.join(GENERATED_AUDIO_DIR, isoDate);
        await ensureDirectory(dailyDir);
        const destinationFileName = `${habit.type}-${habit.id}.wav`;
        const destinationPath = path.join(dailyDir, destinationFileName);

        await fs.copyFile(sourceFile, destinationPath);
        log(
            `Audio saved for ${habit.type}#${habit.id} to ${destinationPath}`,
        );

        const relativePath = path.relative(projectRoot, destinationPath);
        await upsertClipRecord({
            habit,
            isoDate,
            narrator,
            script,
            audioPath: relativePath,
            status: 'ready',
        });

        return {
            habitId: habit.id,
            habitType: habit.type,
            status: 'ready',
            audioPath: relativePath,
            script,
        };
    } catch (error) {
        logError(
            `Generation failed for ${habit.type}#${habit.id} on ${isoDate}`,
            error,
        );
        await upsertClipRecord({
            habit,
            isoDate,
            narrator,
            script,
            audioPath: '',
            status: 'failed',
            errorMessage: error.message,
        });
        return {
            habitId: habit.id,
            habitType: habit.type,
            status: 'failed',
            message: error.message,
        };
    }
};

const generateClipsForDate = async ({ date, narratorId } = {}) => {
    const { date: targetDate, isoDate } = normalizeDateInput(date);
    const narrator = await getNarratorOrDefault(narratorId);
    const { dayName, allHabits } = await fetchHabitsForDate(targetDate);

    if (!allHabits.length) {
        log(`No habits found for ${isoDate}; skipping generation.`);
        return {
            date: isoDate,
            narrator,
            summary: {
                total: 0,
                ready: 0,
                failed: 0,
            },
            clips: [],
        };
    }

    log(
        `Generating clips for ${allHabits.length} habit(s) on ${isoDate} (${dayName}) with narrator "${narrator.name}"`,
    );
    const clips = [];
    for (const habit of allHabits) {
        const clipResult = await generateClipForHabit({
            habit,
            narrator,
            dayName,
            isoDate,
        });
        clips.push(clipResult);
    }

    const summary = clips.reduce(
        (acc, clip) => {
            acc.total += 1;
            if (clip.status === 'ready') acc.ready += 1;
            else acc.failed += 1;
            return acc;
        },
        { total: 0, ready: 0, failed: 0 },
    );

    return {
        date: isoDate,
        narrator,
        summary,
        clips,
    };
};

const scheduleNightlyGeneration = ({ narratorId } = {}) => {
    if (nightlyCronTask) nightlyCronTask.stop();
    log('Configuring nightly audio generation task (1 AM schedule).');

    const cronOptions = {
        scheduled: true,
    };
    if (AUDIO_GENERATION_TIMEZONE) {
        cronOptions.timezone = AUDIO_GENERATION_TIMEZONE;
        log(`Cron timezone set to ${AUDIO_GENERATION_TIMEZONE}`);
    }

    nightlyCronTask = cron.schedule(
        '0 1 * * *',
        async () => {
            log('Nightly audio generation triggered.');
            try {
                const today = new Date();
                const isoDate = today.toISOString().split('T')[0];
                const result = await generateClipsForDate({
                    date: isoDate,
                    narratorId,
                });
                log(
                    `Nightly generation complete for ${isoDate}: ${result.summary.ready}/${result.summary.total} ready, ${result.summary.failed} failed.`,
                );
            } catch (error) {
                logError('Nightly audio generation failed', error);
            }
        },
        cronOptions,
    );

    return nightlyCronTask;
};

const getScheduledTask = () => nightlyCronTask;

module.exports = {
    generateClipsForDate,
    scheduleNightlyGeneration,
    getScheduledTask,
    GENERATED_AUDIO_DIR,
};
