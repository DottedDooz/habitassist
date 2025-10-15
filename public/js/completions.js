// completionsTab.js
import { state, api, timeUtils, uiUtils } from "./utils.js";

let elements = {
  daysContainer: document.getElementById("daysContainer"),
  completionList: document.getElementById("completionList"),
  modal: document.getElementById("habitModal"),
  modalHabitName: document.getElementById("modalHabitName"),
  completionStatusModal: document.getElementById("completionStatusModal"),
  analysisResult: document.getElementById("analysisResult"),
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

      habitsForDay.forEach((habit) => {
        const habitItem = document.createElement("div");
        habitItem.className = "habit-item";
        habitItem.dataset.habitId = habit.id;
        habitItem.dataset.habitType = habit.type;

        const completionDate = timeUtils.getDateForDay(habit.day);
        const completion = state.completions.find(
          (c) =>
            c.habit_id === habit.id &&
            c.habit_type === habit.type &&
            new Date(c.completion_date).toISOString().split("T")[0] ===
              completionDate
        );

        const statusText = completion
          ? `Completed: ${completion.status}`
          : "Not Completed";
        habitItem.className += completion
          ? ` ${completion.status}`
          : " not-completed";

        const buttonContainer = document.createElement("div");
        buttonContainer.className = "status-buttons";
        ["failed", "partially_completed", "perfectly_completed"].forEach(
          (status) => {
            const button = document.createElement("button");
            button.className = `status-button ${status}`;
            button.textContent =
              status === "perfectly_completed"
                ? "C"
                : status.charAt(0).toUpperCase();
            button.title = status.replace("_", " ");
            button.addEventListener("click", () =>
              this.updateHabitCompletion(habit, completion, status, completionDate)
            );
            buttonContainer.appendChild(button);
          }
        );

        habitItem.innerHTML = `${habit.event} (${habit.start_time}-${habit.end_time}) - ${statusText}`;
        habitItem.appendChild(buttonContainer);
        dayColumn.appendChild(habitItem);
      });

      elements.daysContainer.appendChild(dayColumn);
    });
  },
  updateCompletionHistory() {
    elements.completionList.innerHTML = "";
    state.completions.forEach((completion) => {
      const li = document.createElement("li");
      let habitName = "Unknown";
      if (completion.habit_type === "default") {
        const habit = state.habits.default.find(
          (h) => h.id === completion.habit_id
        );
        habitName = habit ? habit.event : "Deleted Habit";
      } else {
        const habit = state.habits.daySpecific.find(
          (h) => h.id === completion.habit_id
        );
        habitName = habit
          ? `${habit.event} (${habit.day_of_week})`
          : "Deleted Habit";
      }
      li.textContent = `${habitName} - ${completion.status} on ${new Date(
        completion.completion_date
      ).toLocaleString()}`;
      elements.completionList.appendChild(li);
    });
  },
  async updateHabitCompletion(habit, existingCompletion, status, completionDate) {
    try {
      const completionDateTime = new Date(
        new Date(completionDate).setTime(new Date().getTime())
      );
      if (existingCompletion) {
        await api.updateCompletion(
          existingCompletion.id,
          status,
          completionDateTime
        );
      } else {
        await api.createCompletion(habit, status, completionDateTime);
      }
      await uiUtils.fetchAllData();
      this.displayWeeklyHabits();
      this.updateCompletionHistory();
      console.log(
        `Completion updated for ${habit.event} on ${completionDate} to ${status}`
      );
    } catch (error) {
      console.error("Error updating completion:", error);
      alert("An error occurred");
    }
  },
  showModal(habit, completion) {
    state.selectedHabit = { ...habit, completion };
    elements.modalHabitName.textContent = `${habit.event} (${habit.start_time}-${habit.end_time}) on ${habit.day}`;
    elements.completionStatusModal.value = completion
      ? completion.status
      : "partially_completed";
    elements.modal.style.display = "block";
  },
  closeModal() {
    elements.modal.style.display = "none";
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
        await api.createCompletion(habit, status, completionDate);
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
  init() {
    elements = {
      daysContainer: document.getElementById("daysContainer"),
      completionList: document.getElementById("completionList"),
      modal: document.getElementById("habitModal"),
      modalHabitName: document.getElementById("modalHabitName"),
      completionStatusModal: document.getElementById("completionStatusModal"),
      analysisResult: document.getElementById("analysisResult"),
    };

    uiUtils.fetchAllData();
    this.displayWeeklyHabits();
    this.updateCompletionHistory();
  },
};