// insightsTab.js
import { state, api, timeUtils, uiUtils } from "./utils.js";

let elements = {
  daysContainer: document.getElementById("daysContainer"),
  completionList: document.getElementById("completionList"),
  loadMoreButton: document.getElementById("loadMoreCompletions"),
  modal: document.getElementById("habitModal"),
  modalHabitName: document.getElementById("modalHabitName"),
  completionStatusModal: document.getElementById("completionStatusModal"),
  analysisResult: document.getElementById("analysisResult"),
  analysisDate: document.getElementById("analysisDate"),
  loadingIndicator: document.getElementById("insightsLoading"),
};

const statusLabels = {
  failed: "Failed",
  partially_completed: "Partially completed",
  completed: "Completed",
  perfectly_completed: "Perfectly completed",
};

export const insightsTab = {
  toggleLoading(isLoading) {
    if (elements.loadingIndicator) {
      elements.loadingIndicator.classList.toggle("is-visible", isLoading);
    }
    if (elements.daysContainer) {
      elements.daysContainer.classList.toggle("is-loading", isLoading);
      if (!isLoading) {
        elements.daysContainer.removeAttribute("aria-busy");
      } else {
        elements.daysContainer.setAttribute("aria-busy", "true");
      }
    }
    if (elements.completionList) {
      elements.completionList.classList.toggle("is-loading", isLoading);
    }
  },
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
      if (elements.loadMoreButton) {
        elements.loadMoreButton.style.display = "none";
      }
      const empty = document.createElement("li");
      empty.className = "completion-history__item";
      empty.innerHTML = `<div class="completion-history__meta">
        <span class="completion-history__habit">No completions logged yet</span>
        <span class="completion-history__time">Record completions to see them appear here.</span>
      </div>`;
      elements.completionList.appendChild(empty);
      return;
    }

    if (elements.loadMoreButton) {
      const hasMore = Boolean(state.completionsPage?.hasMore);
      elements.loadMoreButton.style.display = hasMore ? "inline-flex" : "none";
      elements.loadMoreButton.disabled = !hasMore;
      if (hasMore) {
        elements.loadMoreButton.textContent = "Load more";
      }
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
      this.toggleLoading(true);
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
    } finally {
      this.toggleLoading(false);
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
      this.toggleLoading(true);
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
    } finally {
      this.toggleLoading(false);
    }
  },
  async deleteCompletion() {
    if (!state.selectedHabit || !state.selectedHabit.completion) {
      alert("No completion to delete");
      return;
    }
    try {
      this.toggleLoading(true);
      await api.deleteCompletion(state.selectedHabit.completion.id);
      await uiUtils.fetchAllData();
      this.displayWeeklyHabits();
      this.updateCompletionHistory();
      this.closeModal();
      alert("Completion deleted successfully!");
    } catch (error) {
      console.error("Error deleting completion:", error);
      alert("An error occurred");
    } finally {
      this.toggleLoading(false);
    }
  },
  async loadMoreCompletions() {
    const pagination = state.completionsPage;
    if (!pagination?.hasMore) return;

    if (elements.loadMoreButton) {
      elements.loadMoreButton.disabled = true;
      elements.loadMoreButton.textContent = "Loading…";
    }

    try {
      const { limit, offset } = pagination;
      const response = await api.fetchCompletions({ limit, offset });
      const newCompletions = response?.completions || [];
      state.completions = state.completions.concat(newCompletions);
      state.completionsPage = {
        limit: response?.limit ?? limit,
        offset: response?.nextOffset ?? offset + newCompletions.length,
        total: response?.total ?? pagination.total,
        hasMore: response?.hasMore ?? false,
      };
      this.updateCompletionHistory();
    } catch (error) {
      console.error("Error loading more completions:", error);
      alert("Failed to load more completions. Please try again.");
    } finally {
      if (elements.loadMoreButton) {
        const hasMore = Boolean(state.completionsPage?.hasMore);
        elements.loadMoreButton.disabled = !hasMore;
        if (hasMore) {
          elements.loadMoreButton.textContent = "Load more";
          elements.loadMoreButton.style.display = "inline-flex";
        } else {
          elements.loadMoreButton.style.display = "none";
        }
      }
    }
  },
  runAnalysis(event) {
    event?.preventDefault();
    const dateValue = elements.analysisDate?.value || timeUtils.getTodayDate();
    uiUtils.analyzeDay(dateValue);
    return false;
  },
  async init() {
    elements = {
      daysContainer: document.getElementById("daysContainer"),
      completionList: document.getElementById("completionList"),
      loadMoreButton: document.getElementById("loadMoreCompletions"),
      modal: document.getElementById("habitModal"),
      modalHabitName: document.getElementById("modalHabitName"),
      completionStatusModal: document.getElementById("completionStatusModal"),
      analysisResult: document.getElementById("analysisResult"),
      analysisDate: document.getElementById("analysisDate"),
      loadingIndicator: document.getElementById("insightsLoading"),
    };

    if (elements.analysisDate && !elements.analysisDate.value) {
      elements.analysisDate.value = timeUtils.getTodayDate();
    }

    this.toggleLoading(true);
    try {
      await uiUtils.fetchAllData();
      this.displayWeeklyHabits();
      this.updateCompletionHistory();
    } finally {
      this.toggleLoading(false);
    }
  },
};

window.updateCompletion = () => insightsTab.updateCompletion();
window.deleteCompletion = () => insightsTab.deleteCompletion();
window.closeModal = () => insightsTab.closeModal();
window.runAnalysis = (event) => insightsTab.runAnalysis(event);
window.loadMoreCompletions = () => insightsTab.loadMoreCompletions();
