let habits = { default: [], daySpecific: [] };

document.addEventListener('DOMContentLoaded', () => {
    fetchHabits();
    document.getElementById('habitType').addEventListener('change', toggleDaySelect);
});

function toggleDaySelect() {
    const habitType = document.getElementById('habitType').value;
    const daySelect = document.getElementById('dayOfWeek');
    daySelect.style.display = habitType === 'day-specific' ? 'inline' : 'none';
}

async function fetchHabits() {
    try {
        const [defaultResp, daySpecificResp] = await Promise.all([
            fetch('/api/schedule/default').then(res => res.json()),
            fetch('/api/schedule/day-specific').then(res => res.json())
        ]);
        habits.default = defaultResp.schedule || [];
        habits.daySpecific = daySpecificResp.schedule || [];
        updateHabitLists();
    } catch (error) {
        console.error('Error fetching habits:', error);
    }
}

function updateHabitLists() {
    const defaultList = document.getElementById('defaultHabits');
    const daySpecificList = document.getElementById('daySpecificHabits');

    defaultList.innerHTML = '';
    daySpecificList.innerHTML = '';

    habits.default.forEach(habit => {
        const li = document.createElement('li');
        li.innerHTML = `${habit.event} from ${habit.start_time} to ${habit.end_time} 
            <button onclick="deleteHabit('default', ${habit.id})">Delete</button>`;
        defaultList.appendChild(li);
    });

    habits.daySpecific.forEach(habit => {
        const li = document.createElement('li');
        li.innerHTML = `${habit.event} on ${habit.day_of_week} from ${habit.start_time} to ${habit.end_time} 
            <button onclick="deleteHabit('day-specific', ${habit.id})">Delete</button>`;
        daySpecificList.appendChild(li);
    });
}

async function addHabit() {
    const habitType = document.getElementById('habitType').value;
    const eventName = document.getElementById('eventName').value;
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const dayOfWeek = document.getElementById('dayOfWeek').value;

    if (!eventName || !startTime || !endTime) {
        alert('Please fill in all fields');
        return;
    }

    try {
        let response;
        if (habitType === 'default') {
            response = await fetch('/api/schedule/default', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: eventName, start_time: startTime, end_time: endTime })
            });
        } else {
            if (!dayOfWeek) {
                alert('Please select a day of the week');
                return;
            }
            response = await fetch('/api/schedule/day-specific', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: eventName, day_of_week: dayOfWeek, start_time: startTime, end_time: endTime })
            });
        }

        if (response.ok) {
            document.getElementById('eventName').value = '';
            document.getElementById('startTime').value = '';
            document.getElementById('endTime').value = '';
            document.getElementById('dayOfWeek').value = '';
            fetchHabits();
        } else {
            alert('Failed to add habit');
        }
    } catch (error) {
        console.error('Error adding habit:', error);
        alert('An error occurred while adding the habit');
    }
}

async function deleteHabit(type, id) {
    try {
        const response = await fetch(`/api/schedule/${type}/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            fetchHabits(); // Refresh the list
        } else {
            alert('Failed to delete habit');
        }
    } catch (error) {
        console.error('Error deleting habit:', error);
        alert('An error occurred while deleting the habit');
    }
}

// Simple alert system (you can enhance this)
function checkAlerts() {
    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    habits.default.forEach(habit => {
        if (habit.start_time <= currentTime && habit.end_time >= currentTime) {
            alert(`Reminder: It's time for ${habit.event}!`);
        }
    });

    habits.daySpecific.forEach(habit => {
        if (habit.day_of_week.toLowerCase() === now.toLocaleString('en-us', { weekday: 'long' }).toLowerCase() &&
            habit.start_time <= currentTime && habit.end_time >= currentTime) {
            alert(`Reminder: It's time for ${habit.event} on ${habit.day_of_week}!`);
        }
    });
}

// Check for alerts every minute
setInterval(checkAlerts, 60000);