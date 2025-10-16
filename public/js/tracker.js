// trackerTab.js
import { state, api, timeUtils, uiUtils } from "./utils.js";

let elements = {
  timer: document.getElementById("timer"),
  eventLabel: document.getElementById("event-label"),
  progressBar: document.getElementById("progress-bar"),
  remainingTime: document.getElementById("remaining-time"),
  scheduleBar: document.getElementById("schedule-bar"),
  completionButtons: document.getElementById("completion-buttons"),
};

export const trackerTab = {
  updateTime() {
    const now = new Date();
    const timeString = `${now
      .getHours()
      .toString()
      .padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
    elements.timer.textContent = timeString;
  },
  getTodaysSpecificHabits() {
    const today = new Date().toLocaleString("en-us", { weekday: "long" });
    return state.habits.daySpecific.filter(
      (habit) =>
        habit.day_of_week &&
        habit.day_of_week.toLowerCase() === today.toLowerCase()
    );
  },
  updateEvent() {
    const currentTime = timeUtils.getCurrentTime();
    let currentEvent = "No Event";
    let eventStartTime, eventEndTime;

    const todaysSpecificHabits = this.getTodaysSpecificHabits();

    for (const event of todaysSpecificHabits) {
      if (
        currentTime >= event.start_time &&
        currentTime < event.end_time
      ) {
        currentEvent = event.event;
        eventStartTime = new Date(
          `${new Date().toDateString()} ${event.start_time}`
        );
        eventEndTime = new Date(
          `${new Date().toDateString()} ${event.end_time}`
        );
        break;
      }
    }
    if (currentEvent === "No Event") {
      for (const event of state.habits.default) {
        if (
          currentTime >= event.start_time &&
          currentTime < event.end_time
        ) {
          currentEvent = event.event;
          eventStartTime = new Date(
            `${new Date().toDateString()} ${event.start_time}`
          );
          eventEndTime = new Date(
            `${new Date().toDateString()} ${event.end_time}`
          );
          break;
        }
      }
    }

    elements.eventLabel.textContent = currentEvent;
    //uiUtils.handleHabitChange(currentEvent);

    this.updateProgressBar(eventStartTime, eventEndTime);
    this.updateRemainingTime(eventEndTime);
  },
  updateProgressBar(startTime, endTime) {
    if (!startTime || !endTime) {
      elements.progressBar.style.width = "0%";
      return;
    }
    const now = new Date();
    const totalDuration = endTime - startTime;
    const elapsedDuration = now - startTime;
    const progress = Math.min(100, (elapsedDuration / totalDuration) * 100);
    elements.progressBar.style.width = `${progress}%`;
  },
  updateRemainingTime(endTime) {
    if (!endTime) {
      elements.remainingTime.textContent = "Remaining Time: --:--:--";
      return;
    }
    const now = new Date();
    const remainingTime = endTime - now;
    if (remainingTime <= 0) {
      elements.remainingTime.textContent = "Remaining Time: 00:00:00";
      return;
    }
    const hours = Math.floor(remainingTime / (1000 * 60 * 60))
      .toString()
      .padStart(2, "0");
    const minutes = Math.floor(
      (remainingTime % (1000 * 60 * 60)) / (1000 * 60)
    )
      .toString()
      .padStart(2, "0");
    const seconds = Math.floor((remainingTime % (1000 * 60)) / 1000)
      .toString()
      .padStart(2, "0");
    elements.remainingTime.textContent = `Remaining Time: ${hours}:${minutes}:${seconds}`;
  },
  updateSideProgressBar() {
    elements.scheduleBar.innerHTML = "";

    if (!state.habits.default.length) {
      elements.scheduleBar.style.removeProperty("height");
      return;
    }

    const MIN_SEGMENT_HEIGHT = 72;
    const PIXELS_PER_MINUTE = 1.6;

    elements.scheduleBar.style.removeProperty("height");

    const todaysSpecificHabits = this.getTodaysSpecificHabits();

    state.habits.default.forEach((defaultEvent) => {
      const segment = document.createElement("div");
      segment.className = "schedule-segment";
      const durationSeconds = Math.max(
        0,
        timeUtils.getEventDuration(defaultEvent)
      );
      const computedHeight = durationSeconds
        ? (durationSeconds / 60) * PIXELS_PER_MINUTE
        : MIN_SEGMENT_HEIGHT;
      segment.style.height = `${Math.max(
        MIN_SEGMENT_HEIGHT,
        computedHeight
      )}px`;

      const elapsedTime = timeUtils.getElapsedTime(defaultEvent);
      const duration = timeUtils.getEventDuration(defaultEvent);
      let elapsedPercentage = duration
        ? (elapsedTime / duration) * 100
        : 0;
      if (elapsedPercentage > 100) elapsedPercentage = 100;

      const endTimeDiv = document.createElement("div");
      endTimeDiv.className = "segment-endTime";
      endTimeDiv.innerHTML = defaultEvent.end_time + "--";

      const track = document.createElement("div");
      track.className = "segment-track";

      const segmentBackground = document.createElement("div");
      segmentBackground.className = "segment-background";

      const progress = document.createElement("div");
      progress.className = "segment-progress";
      progress.style.height = `${elapsedPercentage}%`;

      const labelContainer = document.createElement("div");
      labelContainer.className = "segment-content";

      const defaultLabel = document.createElement("div");
      defaultLabel.className = "segment-label";
      defaultLabel.textContent = defaultEvent.event;
      labelContainer.appendChild(defaultLabel);

      todaysSpecificHabits.forEach((specificEvent) => {
        if (this.isOverlapping(defaultEvent, specificEvent)) {
          const specificLabel = document.createElement("div");
          specificLabel.className = "segment-label specific-label";
          specificLabel.innerHTML = `<span>${specificEvent.event}</span> (${specificEvent.day_of_week}, ${specificEvent.start_time}-${specificEvent.end_time})`;
          labelContainer.appendChild(specificLabel);
        }
      });

      segment.appendChild(endTimeDiv);
      track.appendChild(segmentBackground);
      track.appendChild(progress);
      segment.appendChild(track);
      segment.appendChild(labelContainer);
      elements.scheduleBar.appendChild(segment);
    });
  },
  isOverlapping(defaultEvent, specificEvent) {
    const defaultStart = timeUtils.parseTime(defaultEvent.start_time);
    const defaultEnd = timeUtils.parseTime(defaultEvent.end_time);
    const specificStart = timeUtils.parseTime(specificEvent.start_time);
    const specificEnd = timeUtils.parseTime(specificEvent.end_time);
    return defaultStart <= specificEnd && specificStart <= defaultEnd;
  },
  getCurrentEventIndex() {
    const now = new Date();
    const [year, month, date] = [
      now.getFullYear(),
      (now.getMonth() + 1).toString().padStart(2, "0"),
      now.getDate().toString().padStart(2, "0"),
    ];
    return state.habits.default.findIndex((event) => {
      let startTime = new Date(`${year}-${month}-${date}T${event.start_time}Z`);
      let endTime = new Date(`${year}-${month}-${date}T${event.end_time}Z`);
      startTime = startTime.setHours(
        startTime.getHours() + now.getTimezoneOffset() / 60
      );
      endTime = endTime.setHours(
        endTime.getHours() + now.getTimezoneOffset() / 60
      );
      return now >= startTime && now <= endTime;
    });
  },
  scrollToCurrentEvent() {
    const currentIndex = this.getCurrentEventIndex();
    if (currentIndex !== -1) {
      const eventElements = document.querySelectorAll(".schedule-segment");
      if (eventElements[currentIndex]) {
        eventElements[currentIndex].scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  },
  updateWebsite() {
    this.updateTime();
    this.updateEvent();
    this.updateSideProgressBar();
    const currentHabit = uiUtils.getCurrentHabit();
    elements.eventLabel.textContent = currentHabit ? currentHabit.event : "No Event";
    elements.completionButtons.style.display = currentHabit ? "block" : "none";
  },
  async markHabit(status) {
    const currentHabit = uiUtils.getCurrentHabit();
    if (!currentHabit) {
      alert("No current habit to mark as completed!");
      return;
    }
    try {
      await api.markHabit(currentHabit, status);
      await uiUtils.fetchAllData();
      alert(`Habit marked as ${status}!`);
    } catch (error) {
      console.error("Error marking habit:", error);
      alert("An error occurred");
    }
  },
  init() {
    elements = {
        timer: document.getElementById("timer"),
        eventLabel: document.getElementById("event-label"),
        progressBar: document.getElementById("progress-bar"),
        remainingTime: document.getElementById("remaining-time"),
        scheduleBar: document.getElementById("schedule-bar"),
        completionButtons: document.getElementById("completion-buttons"),
    };

    const playButton = document.getElementById("playButton");
    if (playButton) {
      playButton.addEventListener("click", () =>
        api.playAudioForEvent(state.lastEvent)
      );
    }
    elements.scheduleBar?.addEventListener("scroll", this.handleManualScroll);

    let autoScrollInterval = setInterval(() => this.scrollToCurrentEvent(), 60000);
    let manualScrollTimeout;

    this.handleManualScroll = () => {
      clearInterval(autoScrollInterval);
      autoScrollInterval = setInterval(() => this.scrollToCurrentEvent(), 15000);
      if (manualScrollTimeout) clearTimeout(manualScrollTimeout);
      manualScrollTimeout = setTimeout(() => {
        clearInterval(autoScrollInterval);
        autoScrollInterval = setInterval(() => this.scrollToCurrentEvent(), 60000);
      }, 15000);
    };

    uiUtils.fetchAllData();
    this.updateWebsite();
    setInterval(() => this.updateWebsite(), 1000);
  },
};

window.markHabit = (status) => trackerTab.markHabit(status);
