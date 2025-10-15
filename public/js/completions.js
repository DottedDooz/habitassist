// completionsTab.js
import { state, api, timeUtils, uiUtils } from "./utils.js";

let elements = {
  daysContainer: document.getElementById("daysContainer"),
  completionList: document.getElementById("completionList"),
  modal: document.getElementById("habitModal"),
  modalHabitName: document.getElementById("modalHabitName"),
  completionStatusModal: document.getElementById("completionStatusModal"),
  analysisResult: document.getElementById("analysisResult"),
  analysisDate: document.getElementById("analysisDate"),
};

const statusLabels = {
  failed: "Failed",
  partially_completed: "Partially completed",
  completed: "Completed",
  perfectly_completed: "Perfectly completed",
};

export const completionsTab = {
  displayWeeklyHabits() {
    elements.daysContainer.innerHTML = "";
    const daysOfWeek = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];

    daysOfWeek.forEach((day) => {
      const dayColumn = document.createElement("div");
      dayColumn.className = "day-column";
      dayColumn.innerHTML = `<h3>${day}</h3>`;

      const habitsForDay = [
        ...state.habits.default.map((habit) => ({
          ...habit,
          type: "default",
          day,
        })),
        ...state.habits.daySpecific
          .filter((habit) => habit.day_of_week.toLowerCase() === day.toLowerCase())
          .map((habit) => ({ ...habit, type: "day-specific", day })),
      ].sort((a, b) => timeUtils.parseTime(a.start_time) - timeUtils.parseTime(b.start_time));

      if (habitsForDay.length === 0) {
        const emptyState = document.createElement("div");
        emptyState.className = "empty-state";
        emptyState.textContent = "No habits scheduled for this day.";
        dayColumn.appendChild(emptyState);
        elements.daysContainer.appendChild(dayColumn);
        return;
      }

      habitsForDay.forEach((habit) => {
        const habitItem = document.createElement("article");
        habitItem.className = "completion-habit";
        habitItem.dataset.habitId = habit.id;
        habitItem.dataset.habitType = habit.type;

        const completionDate = timeUtils.getDateForDay(habit.day);
        const completion = state.completions.find(
          (c) =>
            c.habit_id === habit.id &&
            c.habit_type === habit.type &&
            new Date(c.completion_date).toISOString().split("T")[0] === completionDate
        );

        const statusClass = completion ? `status-${completion.status}` : "status-none";
        habitItem.classList.add(statusClass);
        if (completion) {
          habitItem.classList.add("has-status");
        }

        const header = document.createElement("div");
        header.className = "completion-habit__header";

        const title = document.createElement("span");
        title.className = "completion-habit__title";
        title.textContent = habit.event;

        const time = document.createElement("span");
        time.className = "completion-habit__time";
        time.textContent = `${habit.start_time} – ${habit.end_time}`;

        header.appendChild(title);
        header.appendChild(time);

        const footer = document.createElement("div");
        footer.className = "completion-habit__footer";

        const statusBadge = document.createElement("span");
        statusBadge.className = `status-pill ${statusClass}`;
        statusBadge.textContent = completion
          ? statusLabels[completion.status] || completion.status.replace(/_/g, " ")
          : "Not completed";

        const buttonContainer = document.createElement("div");
        buttonContainer.className = "completion-habit__actions";

        const quickStatuses = [
          { key: "failed", label: "Fail" },
          { key: "partially_completed", label: "Partial" },
          { key: "perfectly_completed", label: "Perfect" },
        ];

        quickStatuses.forEach(({ key, label }) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = `status-button status-button--${key}`;
          button.textContent = label;
          button.title = `Mark as ${statusLabels[key] || key.replace("_", " ")}`;
          button.addEventListener("click", (event) => {
            event.stopPropagation();
            this.updateHabitCompletion(habit, completion, key, completionDate);
          });
          buttonContainer.appendChild(button);
        });

        footer.appendChild(statusBadge);
        

        habitItem.appendChild(header);
        habitItem.appendChild(footer);
        habitItem.appendChild(buttonContainer);
        habitItem.addEventListener("click", () =>
          this.showModal(habit, completion)
        );
        dayColumn.appendChild(habitItem);
      });

      elements.daysContainer.appendChild(dayColumn);
    });
  },
  updateCompletionHistory() {
    elements.completionList.innerHTML = "";
    if (state.completions.length === 0) {
      const empty = document.createElement("li");
      empty.className = "completion-history__item";
      empty.innerHTML = `<div class="completion-history__meta">
        <span class="completion-history__habit">No completions logged yet</span>
        <span class="completion-history__time">Record completions to see them appear here.</span>
      </div>`;
      elements.completionList.appendChild(empty);
      return;
    }

    state.completions
      .slice()
      .sort(
        (a, b) =>
          new Date(b.completion_date).getTime() - new Date(a.completion_date).getTime()
      )
      .forEach((completion) => {
        const item = document.createElement("li");
        item.className = "completion-history__item";

        let habitName = "Unknown";
        if (completion.habit_type === "default") {
          const habit = state.habits.default.find((h) => h.id === completion.habit_id);
          habitName = habit ? habit.event : "Deleted Habit";
        } else {
          const habit = state.habits.daySpecific.find((h) => h.id === completion.habit_id);
          habitName = habit ? `${habit.event} (${habit.day_of_week})` : "Deleted Habit";
        }

        const meta = document.createElement("div");
        meta.className = "completion-history__meta";

        const name = document.createElement("span");
        name.className = "completion-history__habit";
        name.textContent = habitName;

        const time = document.createElement("span");
        time.className = "completion-history__time";
        time.textContent = new Date(completion.completion_date).toLocaleString();

        meta.appendChild(name);
        meta.appendChild(time);

        const badge = document.createElement("span");
        badge.className = `status-pill status-${completion.status}`;
        badge.textContent = statusLabels[completion.status] || completion.status.replace(/_/g, " ");

        item.appendChild(meta);
        item.appendChild(badge);
        elements.completionList.appendChild(item);
      });
  },
  async updateHabitCompletion(habit, existingCompletion, status, completionDate) {
    try {
      const completionDateTime = new Date(
        new Date(completionDate).setTime(new Date().getTime())
      );
      if (existingCompletion) {
        await api.updateCompletion(existingCompletion.id, status, completionDateTime);
      } else {
        await api.createCompletion(habit, status, completionDateTime);
      }
      await uiUtils.fetchAllData();
      this.displayWeeklyHabits();
      this.updateCompletionHistory();
    } catch (error) {
      console.error("Error updating completion:", error);
      alert("An error occurred");
    }
  },
  showModal(habit, completion) {
    const completionDate = timeUtils.getDateForDay(habit.day);
    const latestCompletion =
      completion ||
      state.completions.find(
        (c) =>
          c.habit_id === habit.id &&
          c.habit_type === habit.type &&
          new Date(c.completion_date).toISOString().split("T")[0] === completionDate
      );

    state.selectedHabit = { ...habit, completion: latestCompletion };
    elements.modalHabitName.textContent = `${habit.event} (${habit.start_time} – ${habit.end_time}) on ${habit.day}`;
    elements.completionStatusModal.value = latestCompletion
      ? latestCompletion.status
      : "partially_completed";
    elements.modal.classList.add("is-visible");
  },
  closeModal() {
    elements.modal.classList.remove("is-visible");
    state.selectedHabit = null;
  },
  async updateCompletion() {
    if (!state.selectedHabit) return;
    const status = elements.completionStatusModal.value;
    const habit = state.selectedHabit;
    const completionDate = timeUtils.getDateForDay(habit.day);
    const completionDateTime = new Date(
      new Date(completionDate).setTime(new Date().getTime())
    );

    try {
      if (state.selectedHabit.completion) {
        await api.updateCompletion(
          state.selectedHabit.completion.id,
          status,
          completionDateTime
        );
      } else {
        await api.createCompletion(habit, status, completionDateTime);
      }
      await uiUtils.fetchAllData();
      this.displayWeeklyHabits();
      this.updateCompletionHistory();
      this.closeModal();
      alert("Completion updated successfully!");
    } catch (error) {
      console.error("Error updating completion:", error);
      alert("An error occurred");
    }
  },
  async deleteCompletion() {
    if (!state.selectedHabit || !state.selectedHabit.completion) {
      alert("No completion to delete");
      return;
    }
    try {
      await api.deleteCompletion(state.selectedHabit.completion.id);
      await uiUtils.fetchAllData();
      this.displayWeeklyHabits();
      this.updateCompletionHistory();
      this.closeModal();
      alert("Completion deleted successfully!");
    } catch (error) {
      console.error("Error deleting completion:", error);
      alert("An error occurred");
    }
  },
  runAnalysis(event) {
    event?.preventDefault();
    const dateValue = elements.analysisDate?.value || timeUtils.getTodayDate();
    uiUtils.analyzeDay(dateValue);
    return false;
  },
  init() {
    elements = {
      daysContainer: document.getElementById("daysContainer"),
      completionList: document.getElementById("completionList"),
      modal: document.getElementById("habitModal"),
      modalHabitName: document.getElementById("modalHabitName"),
      completionStatusModal: document.getElementById("completionStatusModal"),
      analysisResult: document.getElementById("analysisResult"),
      analysisDate: document.getElementById("analysisDate"),
    };

    if (elements.analysisDate && !elements.analysisDate.value) {
      elements.analysisDate.value = timeUtils.getTodayDate();
    }

    uiUtils.fetchAllData();
    this.displayWeeklyHabits();
    this.updateCompletionHistory();
  },
};

window.updateCompletion = () => completionsTab.updateCompletion();
window.deleteCompletion = () => completionsTab.deleteCompletion();
window.closeModal = () => completionsTab.closeModal();
window.runAnalysis = (event) => completionsTab.runAnalysis(event);
