const { all } = require('./db-helpers');

const DAY_ORDER = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
];

const VALID_HABIT_TYPES = ['default', 'day-specific'];
const VALID_COMPLETION_STATUSES = [
    'failed',
    'partially_completed',
    'completed',
    'perfectly_completed',
];

const getCurrentDayName = () =>
    new Date().toLocaleString('en-us', { weekday: 'long' });

const capitalize = (value) =>
    value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

const resolveDayFilter = (rawValue) => {
    if (rawValue === undefined || rawValue === null) return null;
    const normalized = String(rawValue).trim().toLowerCase();
    if (!normalized || normalized === 'all') return null;

    const dayToken = ['today', 'current'].includes(normalized)
        ? getCurrentDayName().toLowerCase()
        : normalized;

    if (!DAY_ORDER.includes(dayToken)) {
        throw new Error('Invalid day parameter');
    }

    return capitalize(dayToken);
};

const sortByStartTime = (items) =>
    [...items].sort((a, b) => a.start_time.localeCompare(b.start_time));

const sortDaySpecificSchedule = (items) =>
    [...items].sort((a, b) => {
        const dayDiff =
            DAY_ORDER.indexOf(a.day_of_week.toLowerCase()) -
            DAY_ORDER.indexOf(b.day_of_week.toLowerCase());
        if (dayDiff !== 0) return dayDiff;
        return a.start_time.localeCompare(b.start_time);
    });

const fetchDefaultSchedule = async () =>
    sortByStartTime(await all('SELECT * FROM default_schedule'));

const fetchDaySpecificSchedule = async (dayFilter = null) => {
    if (dayFilter) {
        return sortByStartTime(
            await all(
                'SELECT * FROM day_specific_schedule WHERE lower(day_of_week) = lower(?)',
                [dayFilter],
            ),
        );
    }

    return sortDaySpecificSchedule(
        await all('SELECT * FROM day_specific_schedule'),
    );
};

const fetchCombinedScheduleForDay = async (dayFilter) => {
    const [daySpecific, defaults] = await Promise.all([
        fetchDaySpecificSchedule(dayFilter),
        fetchDefaultSchedule(),
    ]);

    return sortByStartTime([
        ...daySpecific.map((habit) => ({ ...habit, type: 'day-specific' })),
        ...defaults.map((habit) => ({ ...habit, day_of_week: null, type: 'default' })),
    ]);
};

const fetchHabitsForDate = async (dateInput) => {
    const applicableDay =
        dateInput instanceof Date
            ? dateInput
            : dateInput
                ? new Date(dateInput)
                : new Date();

    if (Number.isNaN(applicableDay.valueOf())) {
        throw new Error('Invalid date provided for habit lookup');
    }

    const dayName = applicableDay.toLocaleString('en-us', { weekday: 'long' });

    const [defaultHabits, specificHabits] = await Promise.all([
        fetchDefaultSchedule().then((habits) =>
            habits.map((habit) => ({ ...habit, type: 'default' })),
        ),
        fetchDaySpecificSchedule(dayName).then((habits) =>
            habits.map((habit) => ({ ...habit, type: 'day-specific' })),
        ),
    ]);

    return {
        dayName,
        defaultHabits,
        specificHabits,
        allHabits: [...defaultHabits, ...specificHabits],
    };
};

module.exports = {
    DAY_ORDER,
    VALID_HABIT_TYPES,
    VALID_COMPLETION_STATUSES,
    getCurrentDayName,
    resolveDayFilter,
    sortByStartTime,
    sortDaySpecificSchedule,
    fetchDefaultSchedule,
    fetchDaySpecificSchedule,
    fetchCombinedScheduleForDay,
    fetchHabitsForDate,
};
