const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database/db.sqlite');

// Initialize the database
db.serialize(() => {

    // Create default_schedule table
    db.run("CREATE TABLE IF NOT EXISTS default_schedule (id INTEGER PRIMARY KEY AUTOINCREMENT, event TEXT, start_time TEXT, end_time TEXT)", (err) => {
        if (err) {
            console.error("Error creating default_schedule table:", err);
            return;
        }

        // Check if the default_schedule table is empty
        db.get("SELECT COUNT(*) as count FROM default_schedule", (err, row) => {
            if (err) {
                console.error("Error querying default_schedule table:", err);
                return;
            }

            if (row.count === 0) {
                // Insert default schedule entries if the table is empty
                const stmt = db.prepare("INSERT INTO default_schedule (event, start_time, end_time) VALUES (?, ?, ?)");
                const defaultEvents = [
                    { event: "Sleep", start_time: "00:00", end_time: "08:00" },
                    { event: "Wake up", start_time: "08:00", end_time: "08:05" },
                    { event: "Exercise", start_time: "08:05", end_time: "08:13" },
                    { event: "Feed Cat", start_time: "08:13", end_time: "08:15" },
                    { event: "Shower", start_time: "08:15", end_time: "08:30" },
                    { event: "Brush Teeth", start_time: "08:30", end_time: "08:35" },
                    { event: "Get dressed (new clothes)", start_time: "08:35", end_time: "08:45" },
                    { event: "Leisure", start_time: "08:45", end_time: "09:00" },
                    { event: "Work", start_time: "09:00", end_time: "09:45" },
                    { event: "Exercise", start_time: "09:45", end_time: "10:00" },
                    { event: "Work", start_time: "10:00", end_time: "11:00" },
                    { event: "Prepare Lunch", start_time: "11:00", end_time: "11:25" },
                    { event: "Feed Cat", start_time: "11:25", end_time: "11:30" },
                    { event: "Have Lunch", start_time: "11:30", end_time: "11:45" },
                    { event: "Exercise", start_time: "11:45", end_time: "12:00" },
                    { event: "Work", start_time: "12:00", end_time: "12:45" },
                    { event: "Exercise", start_time: "12:45", end_time: "13:00" },
                    { event: "Work", start_time: "13:00", end_time: "13:45" },
                    { event: "Exercise", start_time: "13:45", end_time: "14:00" },
                    { event: "Work", start_time: "14:00", end_time: "14:45" },
                    { event: "Exercise", start_time: "14:45", end_time: "15:00" },
                    { event: "Work", start_time: "15:00", end_time: "15:45" },
                    { event: "Exercise", start_time: "15:45", end_time: "16:00" },
                    { event: "Work", start_time: "16:00", end_time: "16:30" },
                    { event: "Listen to Book", start_time: "16:30", end_time: "17:30" },
                    { event: "Exercise", start_time: "17:30", end_time: "17:45" },
                    { event: "Gardening", start_time: "17:45", end_time: "18:15" },
                    { event: "Work on Game", start_time: "18:15", end_time: "19:15" },
                    { event: "Exercise", start_time: "19:15", end_time: "19:30" },
                    { event: "Prepare Dinner", start_time: "19:30", end_time: "20:00" },
                    { event: "Feed Cat", start_time: "20:00", end_time: "20:05" },
                    { event: "Eat Dinner", start_time: "20:05", end_time: "20:30" },
                    { event: "Leisure", start_time: "20:30", end_time: "23:45" },
                    { event: "Brush Teeth", start_time: "23:45", end_time: "23:59" }
                ];

                defaultEvents.forEach(({ event, start_time, end_time }) => {
                    stmt.run(event, start_time, end_time, (err) => {
                        if (err) {
                            console.error("Error inserting default schedule:", err);
                        }
                    });
                });
                stmt.finalize();
                console.log("Inserted default schedule.");
            }
        });
    });

    db.run("DELETE FROM event_audio", (err) => {});
    // Create default_schedule table
    db.run("CREATE TABLE IF NOT EXISTS event_audio (id INTEGER PRIMARY KEY AUTOINCREMENT, event TEXT, count INTEGER, dir TEXT)", (err) => {
        if (err) {
            console.error("Error creating event_audio table:", err);
            return;
        }

        // Check if the event_audio table is empty
        db.get("SELECT COUNT(*) as count FROM event_audio", (err, row) => {
            if (err) {
                console.error("Error querying event_audio table:", err);
                return;
            }

            if (row.count === 0) {
                // Insert default audio entries if the table is empty
                console.log("creating event audio");
                const stmt = db.prepare("INSERT INTO event_audio (event, count, dir) VALUES (?, ?, ?)");
                const defaultEvents = [
                    { event: "Sleep", count: 22, dir: "Sleep"},
                    { event: "Wake up", count: 10, dir: "Wake up" },
                    { event: "Shower", count: 10, dir: "Shower" },
                    { event: "Get dressed (new clothes)", count: 10, dir: "Get dressed (new clothes)" },
                    { event: "Leisure", count: 20, dir: "Leisure" },
                    { event: "Work", count: 70, dir: "Work" },
                    { event: "Prepare Lunch", count: 10, dir: "Prepare Lunch" },
                    { event: "Feed Cat", count: 30, dir: "Feed Cat" },
                    { event: "Have Lunch", count: 10, dir: "Have Lunch"},
                    { event: "Exercise", count: 90, dir: "Exercise" },
                    { event: "Listen to Book", count: 10, dir: "Listen to Book"},
                    { event: "Gardening", count: 10, dir: "Gardening" },
                    { event: "Work on Game", count: 10, dir: "Work on Game" },
                    { event: "Prepare Dinner", count: 10, dir: "Prepare Dinner" },
                    { event: "Eat Dinner", count: 9, dir: "Eat Dinner" },
                    { event: "Brush Teeth", count: 20, dir: "Brush Teeth" },
                    { event: "Clean Up", count: 10, dir: "Clean Up" }
                ];

                defaultEvents.forEach(({ event, count, dir }) => {
                    stmt.run(event, count, dir, (err) => {
                        if (err) {
                            console.error("Error inserting default audio:", err);
                        }
                    });
                });
                stmt.finalize();
                console.log("Inserted default audio.");
            }
        });
    });

    db.run("CREATE TABLE IF NOT EXISTS day_specific_schedule (id INTEGER PRIMARY KEY AUTOINCREMENT, event TEXT, day_of_week TEXT, start_time TEXT, end_time TEXT, FOREIGN KEY (event) REFERENCES default_schedule(event))", (err) => {
        if (err) {
            console.error("Error creating day_specific_schedule table:", err);
            return;
        }
    
        // Check if the day_specific_schedule table is empty and insert defaults if needed
        db.get("SELECT COUNT(*) as count FROM day_specific_schedule", (err, row) => {
            if (err) {
                console.error("Error querying day_specific_schedule table:", err);
                return;
            }
    
            if (row.count === 0) {
                const stmt = db.prepare("INSERT INTO day_specific_schedule (event, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)");
                const daySpecificEvents = [
                    { event: "Yoga Class", day_of_week: "Monday", start_time: "18:00", end_time: "19:00" },
                    { event: "Team Meeting", day_of_week: "Wednesday", start_time: "10:00", end_time: "11:00" },
                    // Add more day-specific events as needed
                ];
    
                daySpecificEvents.forEach(({ event, day_of_week, start_time, end_time }) => {
                    stmt.run(event, day_of_week, start_time, end_time, (err) => {
                        if (err) {
                            console.error("Error inserting day-specific schedule:", err);
                        }
                    });
                });
                stmt.finalize();
                console.log("Inserted default day-specific schedule.");
            }
        });
    });

    const createHabitCompletionsTable = () => {
        db.run(`
            CREATE TABLE IF NOT EXISTS habit_completions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                habit_id INTEGER, -- Links to either default_schedule.id or day_specific_schedule.id
                habit_type TEXT NOT NULL CHECK(habit_type IN ('default', 'day-specific')), -- Type of habit
                completion_date DATETIME DEFAULT CURRENT_TIMESTAMP, -- When the habit was completed
                status TEXT NOT NULL CHECK(status IN ('failed', 'partially_completed', 'completed', 'perfectly_completed')), -- Completion status
                FOREIGN KEY (habit_id) REFERENCES default_schedule(id) ON DELETE SET NULL, -- Optional foreign key for default
                FOREIGN KEY (habit_id) REFERENCES day_specific_schedule(id) ON DELETE SET NULL -- Optional for day-specific
            )
        `, (err) => {
            if (err) {
                console.error("Error creating habit_completions table:", err);
                return;
            }

            // Check if the habit_completions table is empty (optional, for initial data)
            db.get("SELECT COUNT(*) as count FROM habit_completions", (err, row) => {
                if (err) {
                    console.error("Error querying habit_completions table:", err);
                    return;
                }

                if (row.count === 0) {
                    console.log("No initial data needed for habit_completions (empty is normal).");
                }
            });
        });
    };

    db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='habit_completions'", (err, row) => {
        if (err) {
            console.error("Error inspecting habit_completions table:", err);
            createHabitCompletionsTable();
            return;
        }

        if (row && row.sql && !row.sql.includes("'failed'")) {
            db.exec(`
                BEGIN TRANSACTION;
                ALTER TABLE habit_completions RENAME TO habit_completions_old;
                CREATE TABLE habit_completions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    habit_id INTEGER,
                    habit_type TEXT NOT NULL CHECK(habit_type IN ('default', 'day-specific')),
                    completion_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    status TEXT NOT NULL CHECK(status IN ('failed', 'partially_completed', 'completed', 'perfectly_completed')),
                    FOREIGN KEY (habit_id) REFERENCES default_schedule(id) ON DELETE SET NULL,
                    FOREIGN KEY (habit_id) REFERENCES day_specific_schedule(id) ON DELETE SET NULL
                );
                INSERT INTO habit_completions (id, habit_id, habit_type, completion_date, status)
                    SELECT id, habit_id, habit_type, completion_date, status FROM habit_completions_old;
                DROP TABLE habit_completions_old;
                COMMIT;
            `, (migrationErr) => {
                if (migrationErr) {
                    console.error("Error migrating habit_completions table:", migrationErr);
                } else {
                    console.log("Migrated habit_completions table to include 'failed' status.");
                }
                createHabitCompletionsTable();
            });
        } else {
            createHabitCompletionsTable();
        }
    });

});


module.exports = db;
