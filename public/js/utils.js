// utils.js
export const state = {
  schedule: [],
  habits: { default: [], daySpecific: [] },
  habitsLoaded: false,
  completions: [],
  weeklyCompletions: [],
  completionsPage: {
    limit: 25,
    offset: 0,
    total: 0,
    hasMore: false,
  },
  selectedHabit: null,
  lastHabitKey: null,
  lastHabit: null,
};

const HABIT_WATCHER_INTERVAL_MS = 5000;
const WEEKLY_COMPLETION_LIMIT = 500;
let habitWatcherIntervalId = null;

const applyScheduleUpdate = (
  defaultSchedule = [],
  daySpecificSchedule = []
) => {
  state.habits.default = Array.isArray(defaultSchedule)
    ? defaultSchedule
    : [];
  state.habits.daySpecific = Array.isArray(daySpecificSchedule)
    ? daySpecificSchedule
    : [];
  state.habitsLoaded = true;
};

const ensureAudioPlayer = () => {
  let audioPlayer = document.getElementById("audioPlayer");
  if (!audioPlayer) {
    audioPlayer = document.createElement("audio");
    audioPlayer.id = "audioPlayer";
    audioPlayer.setAttribute("preload", "auto");
    audioPlayer.style.display = "none";
    document.body.appendChild(audioPlayer);
  }
  return audioPlayer;
};

export const elements = {
  trackerTab: document.getElementById("tracker"),
  insightsTab: document.getElementById("insights"),
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
  async fetchCompletions({ limit = 25, offset = 0 } = {}) {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    const response = await fetch(`/api/completions?${params.toString()}`);
    if (!response.ok) throw new Error("Failed to fetch completions");
    return await response.json();
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
    return await response.json();
  },
  async deleteCompletion(completionId) {
    const response = await fetch(`/api/completions/${completionId}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete completion");
    return response;
  },
  async playAudioForHabit(habit, { date } = {}) {
    if (!habit || !habit.id || !habit.type) {
      console.warn("Attempted to play audio without a valid habit", habit);
      return;
    }
    try {
      const params = new URLSearchParams();
      if (date) params.set("date", date);
      const query = params.toString();
      const url = query
        ? `/api/audio/habit/${habit.type}/${habit.id}?${query}`
        : `/api/audio/habit/${habit.type}/${habit.id}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch audio");
      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audioPlayer = ensureAudioPlayer();
      audioPlayer.src = audioUrl;
      await audioPlayer.play();
    } catch (error) {
      console.error("Error playing audio:", error);
    }
  },
  async fetchNarrators() {
    const response = await fetch("/api/narrators");
    if (!response.ok) throw new Error("Failed to load narrators");
    return await response.json();
  },
  async createNarrator(payload) {
    const response = await fetch("/api/narrators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("Failed to create narrator");
    return await response.json();
  },
  async updateNarrator(id, payload) {
    const response = await fetch(`/api/narrators/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("Failed to update narrator");
    return await response.json();
  },
  async deleteNarrator(id) {
    const response = await fetch(`/api/narrators/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete narrator");
    return await response.json();
  },
  async setDefaultNarrator(id) {
    const response = await fetch(`/api/narrators/${id}/default`, {
      method: "POST",
    });
    if (!response.ok) throw new Error("Failed to set default narrator");
    return await response.json();
  },
  async generateNarratorClips(id, date) {
    const response = await fetch(`/api/narrators/${id}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    });
    if (!response.ok) throw new Error("Failed to generate audio clips");
    return await response.json();
  },
  async fetchNarratorSamples() {
    const response = await fetch("/api/narrator-samples");
    if (!response.ok) throw new Error("Failed to load narrator samples");
    return await response.json();
  },
  async uploadNarratorSample(formData) {
    const response = await fetch("/api/narrator-samples", {
      method: "POST",
      body: formData,
    });
    if (!response.ok) throw new Error("Failed to upload narrator sample");
    return await response.json();
  },
  async deleteNarratorSample(id, { removeFile = false } = {}) {
    const params = new URLSearchParams();
    if (removeFile) params.set("removeFile", "true");
    const query = params.toString();
    const url = query
      ? `/api/narrator-samples/${id}?${query}`
      : `/api/narrator-samples/${id}`;
    const response = await fetch(url, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete narrator sample");
    return await response.json();
  },
  async fetchClipSummary(date) {
    const params = new URLSearchParams();
    if (date) params.set("date", date);
    const query = params.toString();
    const response = await fetch(
      query ? `/api/audio/clips?${query}` : "/api/audio/clips"
    );
    if (!response.ok) throw new Error("Failed to load audio clips");
    return await response.json();
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
  getStartOfCurrentWeek() {
    const now = new Date();
    const monday = new Date(now);
    const day = monday.getDay();
    const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  },
  getEndOfCurrentWeek() {
    const startOfWeek = this.getStartOfCurrentWeek();
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);
    return endOfWeek;
  },
  isDateInCurrentWeek(dateLike) {
    const target = new Date(dateLike);
    if (Number.isNaN(target.getTime())) return false;
    const weekStart = this.getStartOfCurrentWeek();
    const weekEnd = this.getEndOfCurrentWeek();
    return target >= weekStart && target < weekEnd;
  },
};

export const uiUtils = {
  async fetchAllData() {
    try {
      const [
        defaultSchedule,
        specificSchedule,
        completionData,
        weeklyCompletionData,
      ] =
        await Promise.all([
          api.fetchDefaultSchedule(),
          api.fetchSpecificSchedule(),
          api.fetchCompletions(),
          api.fetchCompletions({ limit: WEEKLY_COMPLETION_LIMIT }),
        ]);
      applyScheduleUpdate(defaultSchedule, specificSchedule);
      const completionPayload = completionData || {};
      state.completions = completionPayload.completions || [];
      state.completionsPage = {
        limit: completionPayload.limit ?? state.completionsPage.limit,
        offset: completionPayload.nextOffset ?? state.completions.length,
        total: completionPayload.total ?? state.completions.length,
        hasMore: completionPayload.hasMore ?? false,
      };
      const weeklyPayload = weeklyCompletionData || {};
      state.weeklyCompletions = (weeklyPayload.completions || []).filter(
        (completion) => {
          return timeUtils.isDateInCurrentWeek(completion.completion_date);
        }
      );
    } catch (error) {
      console.error("Error fetching data:", error);
      alert("Failed to load data. Please try again.");
    }
  },
  async loadSchedules() {
    const [defaultSchedule, specificSchedule] = await Promise.all([
      api.fetchDefaultSchedule(),
      api.fetchSpecificSchedule(),
    ]);
    applyScheduleUpdate(defaultSchedule, specificSchedule);
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
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
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
  async handleHabitChange(habit, { playAudio = true } = {}) {
    const habitKey = habit ? `${habit.type}-${habit.id}` : "none";
    if (state.lastHabitKey === habitKey) return;
    state.lastHabitKey = habitKey;
    state.lastHabit = habit || null;
    if (!playAudio || !habit) return;
    await api.playAudioForHabit(habit);
  },
  startHabitWatcher() {
    if (habitWatcherIntervalId) return;

    const checkForHabitChange = async () => {
      try {
        if (!state.habitsLoaded) {
          await this.loadSchedules();
        }
        const currentHabit = this.getCurrentHabit();
        await this.handleHabitChange(currentHabit);
      } catch (error) {
        console.error("Error monitoring habit changes:", error);
      }
    };

    checkForHabitChange();
    habitWatcherIntervalId = window.setInterval(
      checkForHabitChange,
      HABIT_WATCHER_INTERVAL_MS
    );
  },
};

window.habitAssist = window.habitAssist || {};
window.habitAssist.syncSchedules = ({
  defaultSchedule = [],
  daySpecificSchedule = [],
} = {}) => {
  applyScheduleUpdate(defaultSchedule, daySpecificSchedule);
  const currentHabit = uiUtils.getCurrentHabit();
  uiUtils
    .handleHabitChange(currentHabit, { playAudio: false })
    .catch((error) =>
      console.error("Error handling habit change after schedule sync:", error)
    );
};

export const toggleDarkMode = () => {
  document.body.classList.toggle("dark-mode");
  localStorage.setItem(
    "theme",
    document.body.classList.contains("dark-mode") ? "dark" : "light"
  );
};
