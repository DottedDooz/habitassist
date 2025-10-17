// plannerTab.js
const state = {
  habits: { default: [], daySpecific: [] },
};

const syncGlobalSchedules = () => {
  if (window.habitAssist?.syncSchedules) {
    window.habitAssist.syncSchedules({
      defaultSchedule: state.habits.default,
      daySpecificSchedule: state.habits.daySpecific,
    });
  }
};

let elements = {
  habitForm: document.getElementById("habitForm"),
  habitType: document.getElementById("habitType"),
  eventName: document.getElementById("eventName"),
  startTime: document.getElementById("startTime"),
  endTime: document.getElementById("endTime"),
  dayOfWeek: document.getElementById("dayOfWeek"),
  dayOfWeekWrapper: document.getElementById("dayOfWeekWrapper"),
  defaultHabits: document.getElementById("defaultHabits"),
  daySpecificHabits: document.getElementById("daySpecificHabits"),
};

const plannerPage = {
  alertInterval: null,
  init() {
    this.cacheElements();
    if (!elements.habitType) return;

    elements.habitType.addEventListener("change", () => this.toggleDaySelect());
    elements.habitForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      this.addHabit();
    });

    this.toggleDaySelect();
    this.fetchHabits();
    this.scheduleAlerts();
  },
  cacheElements() {
    elements = {
      habitForm: document.getElementById("habitForm"),
      habitType: document.getElementById("habitType"),
      eventName: document.getElementById("eventName"),
      startTime: document.getElementById("startTime"),
      endTime: document.getElementById("endTime"),
      dayOfWeek: document.getElementById("dayOfWeek"),
      dayOfWeekWrapper: document.getElementById("dayOfWeekWrapper"),
      defaultHabits: document.getElementById("defaultHabits"),
      daySpecificHabits: document.getElementById("daySpecificHabits"),
    };
  },
  toggleDaySelect() {
    if (!elements.dayOfWeek) return;
    const shouldShowDaySelect = elements.habitType.value === "day-specific";
    elements.dayOfWeekWrapper?.classList.toggle("is-hidden", !shouldShowDaySelect);
    elements.dayOfWeek.disabled = !shouldShowDaySelect;
    if (!shouldShowDaySelect) {
      elements.dayOfWeek.value = "";
    }
  },
  async fetchHabits() {
    try {
      const [defaultResp, daySpecificResp] = await Promise.all([
        fetch("/api/schedule/default").then((res) => res.json()),
        fetch("/api/schedule/day-specific").then((res) => res.json()),
      ]);

      state.habits.default = defaultResp.schedule || [];
      state.habits.daySpecific = daySpecificResp.schedule || [];

      syncGlobalSchedules();

      this.updateHabitLists();
      this.checkAlerts();
    } catch (error) {
      console.error("Error fetching habits:", error);
      alert("Failed to load habits. Please try again.");
    }
  },
  updateHabitLists() {
    elements.defaultHabits.innerHTML = "";
    elements.daySpecificHabits.innerHTML = "";

    if (state.habits.default.length === 0) {
      elements.defaultHabits.appendChild(
        this.createEmptyState("No default habits yet. Add one to build momentum.")
      );
    } else {
      state.habits.default.forEach((habit) => {
        const item = this.createHabitListItem(habit, "default");
        elements.defaultHabits.appendChild(item);
      });
    }

    if (state.habits.daySpecific.length === 0) {
      elements.daySpecificHabits.appendChild(
        this.createEmptyState("No day specific habits yet. Assign one to a weekday.")
      );
    } else {
      state.habits.daySpecific.forEach((habit) => {
        const item = this.createHabitListItem(habit, "day-specific");
        elements.daySpecificHabits.appendChild(item);
      });
    }
  },
  createEmptyState(message) {
    const item = document.createElement("li");
    item.className = "habit-list__empty";
    item.textContent = message;
    return item;
  },
  createHabitListItem(habit, type) {
    const listItem = document.createElement("li");
    listItem.className = "habit-item";

    const details = document.createElement("div");
    details.className = "habit-item__details";
    const title = document.createElement("span");
    title.textContent = habit.event;
    const meta = document.createElement("span");
    meta.className = "habit-item__meta";
    meta.textContent =
      type === "default"
        ? `${habit.start_time} - ${habit.end_time}`
        : `${habit.day_of_week} | ${habit.start_time} - ${habit.end_time}`;
    details.appendChild(title);
    details.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "habit-item__actions";
    const deleteButton = document.createElement("button");

    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () =>
      this.deleteHabit(type, habit.id)
    );

    actions.appendChild(deleteButton);

    listItem.appendChild(details);
    listItem.appendChild(actions);
    return listItem;
  },
  async addHabit() {
    const habitType = elements.habitType.value;
    const eventName = elements.eventName.value.trim();
    const startTime = elements.startTime.value;
    const endTime = elements.endTime.value;
    const dayOfWeek = elements.dayOfWeek.value;

    if (!eventName || !startTime || !endTime) {
      alert("Please fill in all fields.");
      return;
    }

    if (habitType === "day-specific" && !dayOfWeek) {
      alert("Please select a day of the week.");
      return;
    }

    const payload =
      habitType === "default"
        ? { event: eventName, start_time: startTime, end_time: endTime }
        : {
            event: eventName,
            day_of_week: dayOfWeek,
            start_time: startTime,
            end_time: endTime,
          };

    try {
      const response = await fetch(
        `/api/schedule/${habitType === "default" ? "default" : "day-specific"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        alert("Failed to add habit.");
        return;
      }

      this.resetForm();
      this.fetchHabits();
    } catch (error) {
      console.error("Error adding habit:", error);
      alert("An error occurred while adding the habit.");
    }
  },
  async deleteHabit(type, id) {
    try {
      const response = await fetch(`/api/schedule/${type}/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        alert("Failed to delete habit.");
        return;
      }

      this.fetchHabits();
    } catch (error) {
      console.error("Error deleting habit:", error);
      alert("An error occurred while deleting the habit.");
    }
  },
  resetForm() {
    elements.eventName.value = "";
    elements.startTime.value = "";
    elements.endTime.value = "";
    elements.dayOfWeek.value = "";
    elements.habitType.value = "default";
    this.toggleDaySelect();
  },
  checkAlerts() {
    const now = new Date();
    const currentTime = `${now
      .getHours()
      .toString()
      .padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
    const today = now
      .toLocaleString("en-us", { weekday: "long" })
      .toLowerCase();

    state.habits.default.forEach((habit) => {
      if (
        habit.start_time <= currentTime &&
        habit.end_time >= currentTime
      ) {
        //alert(`Reminder: It's time for ${habit.event}!`);
      }
    });

    state.habits.daySpecific.forEach((habit) => {
      if (
        habit.day_of_week.toLowerCase() === today &&
        habit.start_time <= currentTime &&
        habit.end_time >= currentTime
      ) {
        /*alert(
          `Reminder: It's time for ${habit.event} on ${habit.day_of_week}!`
        );*/
      }
    });
  },
  scheduleAlerts() {
    if (this.alertInterval) clearInterval(this.alertInterval);
    this.alertInterval = setInterval(() => this.checkAlerts(), 60000);
  },
};

document.addEventListener("DOMContentLoaded", () => plannerPage.init());

// Preserve global handlers referenced in inline HTML.
window.addHabit = () => plannerPage.addHabit();
window.deleteHabit = (type, id) => plannerPage.deleteHabit(type, id);
