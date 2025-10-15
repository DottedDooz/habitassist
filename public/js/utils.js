// utils.js
export const state = {
  schedule: [],
  habits: { default: [], daySpecific: [] },
  completions: [],
  selectedHabit: null,
  lastEvent: "",
};

export const elements = {
  homeTab: document.getElementById("home"),
  completionsTab: document.getElementById("completions"),
};

export const api = {
  async fetchDefaultSchedule() {
    const response = await fetch("/api/schedule/default");
    if (!response.ok) throw new Error("Failed to fetch default schedule");
    return (await response.json()).schedule;
  },
  async fetchSpecificSchedule() {
    const response = await fetch("/api/schedule/day-specific");
    if (!response.ok) throw new Error("Failed to fetch specific schedule");
    return (await response.json()).schedule;
  },
  async fetchCompletions() {
    const response = await fetch("/api/completions");
    if (!response.ok) throw new Error("Failed to fetch completions");
    return (await response.json()).completions;
  },
  async markHabit(habit, status) {
    const response = await fetch("/api/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        habit_id: habit.id,
        habit_type: habit.type,
        status,
      }),
    });
    if (!response.ok) throw new Error("Failed to mark habit");
    return response;
  },
  async updateCompletion(completionId, status, completionDate) {
    const response = await fetch(`/api/completions/${completionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, completion_date: completionDate }),
    });
    if (!response.ok) throw new Error("Failed to update completion");
    return response;
  },
  async createCompletion(habit, status, completionDate) {
    const response = await fetch("/api/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        habit_id: habit.id,
        habit_type: habit.type,
        status,
        completion_date: completionDate,
      }),
    });
    if (!response.ok) throw new Error("Failed to create completion");
    return response;
  },
  async deleteCompletion(completionId) {
    const response = await fetch(`/api/completions/${completionId}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete completion");
    return response;
  },
  async playAudioForEvent(event) {
    try {
      const response = await fetch(`/api/audio/${event}`);
      if (!response.ok) throw new Error("Failed to fetch audio");
      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audioPlayer = document.getElementById("audioPlayer");
      audioPlayer.src = audioUrl;
      audioPlayer.play();
    } catch (error) {
      console.error("Error playing audio:", error);
    }
  },
  async analyzeDay(date, autoRun = false) {
    try {
      const response = await fetch("/api/analyze-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      if (!response.ok) throw new Error("Failed to analyze day");
      const data = await response.json();
      document.getElementById("analysisResult").innerHTML = `
        <h3>Analysis for ${data.date}</h3>
        <p><strong>Prompt:</strong> ${data.prompt}</p>
        <p><strong>AI Response:</strong> ${data.openaiResponse}</p>
        <h4>Completions:</h4><ul>${data.completions
          .map((c) => `<li>${c.habit_id} (${c.habit_type}): ${c.status}</li>`)
          .join("")}</ul>
        <h4>Skipped Habits:</h4><ul>${data.skippedHabits
          .map((h) => `<li>${h.event} (${h.type})</li>`)
          .join("")}</ul>
        <audio id="dailyAnalysisAudio" ${autoRun ? "autoplay" : ""} controls>
          <source src="data:audio/wav;base64,${data.audio}" type="audio/wav">
          Your browser does not support the audio element.
        </audio>
      `;
      if (autoRun) console.log(`Auto-running analysis for ${date} at 23:55`);
    } catch (error) {
      console.error("Error analyzing day:", error);
      if (!autoRun) alert("An error occurred during analysis");
    }
  },
};

export const timeUtils = {
  getCurrentTime() {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
  },
  parseTime(timeStr) {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
  },
  getEventDuration(event) {
    if (!event.start_time || !event.end_time) {
      console.error("Invalid event times:", event);
      return 0;
    }
    const startTime = new Date(`1970-01-01T${event.start_time}Z`);
    const endTime = new Date(`1970-01-01T${event.end_time}Z`);
    if (isNaN(startTime) || isNaN(endTime)) {
      console.error("Invalid date format for event:", event);
      return 0;
    }
    return (endTime - startTime) / 1000; // Duration in seconds
  },
  getElapsedTime(event) {
    const now = new Date();
    const [year, month, date] = [
      now.getFullYear(),
      (now.getMonth() + 1).toString().padStart(2, "0"),
      now.getDate().toString().padStart(2, "0"),
    ];
    let startTime = new Date(`${year}-${month}-${date}T${event.start_time}Z`);
    startTime.setHours(startTime.getHours() + now.getTimezoneOffset() / 60);
    return Math.max(0, (now - startTime) / 1000); // Elapsed time in seconds
  },
  getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).setHours(0);
  },
  getDateForDay(dayName) {
    const daysOfWeek = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    const today = new Date();
    const currentDayIndex = (today.getDay() + 6) % 7; // Adjust for Monday-based week
    const targetDayIndex = daysOfWeek.indexOf(dayName);
    const dayDifference = targetDayIndex - currentDayIndex;
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + dayDifference);
    return targetDate.toISOString().split("T")[0];
  },
  getTodayDate() {
    return new Date().toISOString().split("T")[0];
  },
};

export const uiUtils = {
  async fetchAllData() {
    try {
      const [defaultSchedule, specificSchedule, completionData] =
        await Promise.all([
          api.fetchDefaultSchedule(),
          api.fetchSpecificSchedule(),
          api.fetchCompletions(),
        ]);
      state.habits.default = defaultSchedule || [];
      state.habits.daySpecific = specificSchedule || [];
      state.completions = completionData || [];
    } catch (error) {
      console.error("Error fetching schedules:", error);
      alert("Failed to load schedules. Please try again.");
    }
  },
  getCurrentHabit() {
    const now = new Date();
    const currentTime = timeUtils.getCurrentTime();
    const currentDay = now.toLocaleString("en-us", { weekday: "long" });
    let currentHabit = null;

    for (let habit of state.habits.daySpecific) {
      if (
        habit.day_of_week.toLowerCase() === currentDay.toLowerCase() &&
        this.isTimeInRange(currentTime, habit.start_time, habit.end_time)
      ) {
        currentHabit = { ...habit, type: "day-specific" };
        break;
      }
    }

    if (!currentHabit) {
      for (let habit of state.habits.default) {
        if (this.isTimeInRange(currentTime, habit.start_time, habit.end_time)) {
          currentHabit = { ...habit, type: "default" };
          break;
        }
      }
    }
    return currentHabit;
  },
  isTimeInRange(current, start, end) {
    const [currH, currM] = current.split(":").map(Number);
    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);
    const currentMinutes = currH * 60 + currM;
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  },
  scheduleDailyAnalysis() {
    const now = new Date();
    const targetTime = new Date(now).setHours(23, 55, 0, 0);
    const timeUntilTarget =
      now > targetTime ? targetTime + 24 * 60 * 60 * 1000 - now : targetTime - now;

    setTimeout(() => {
      api.analyzeDay(timeUtils.getTodayDate(), true);
      setInterval(() => api.analyzeDay(timeUtils.getTodayDate(), true), 24 * 60 * 60 * 1000);
    }, timeUntilTarget);
  },
};

export const toggleDarkMode = () => {
  document.body.classList.toggle("dark-mode");
  localStorage.setItem(
    "theme",
    document.body.classList.contains("dark-mode") ? "dark" : "light"
  );
};