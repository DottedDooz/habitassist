// insightsTab.js
import { state, api, timeUtils, uiUtils } from "./utils.js";

const getDateKey = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
};

const matchesHabitAndDate = (completion, habit, completionDate) =>
  completion.habit_id === habit.id &&
  completion.habit_type === habit.type &&
  getDateKey(completion.completion_date) === completionDate;

const upsertCompletionRecord = (list, completion) => {
  if (!completion) return -1;
  const dateKey = getDateKey(completion.completion_date);
  let index = -1;
  if (completion.id) {
    index = list.findIndex((item) => item.id === completion.id);
  }
  if (index === -1 && dateKey) {
    index = list.findIndex(
      (item) =>
        item.habit_id === completion.habit_id &&
        item.habit_type === completion.habit_type &&
        getDateKey(item.completion_date) === dateKey
    );
  }
  if (index >= 0) {
    list[index] = { ...list[index], ...completion };
    return index;
  }
  list.push(completion);
  return list.length - 1;
};

const removeCompletionRecord = (
  list,
  { id = null, habit = null, completionDate = null } = {}
) => {
  let index = -1;
  if (id) {
    index = list.findIndex((item) => item.id === id);
  }
  if (index === -1 && habit && completionDate) {
    index = list.findIndex((item) =>
      matchesHabitAndDate(item, habit, completionDate)
    );
  }
  if (index >= 0) {
    list.splice(index, 1);
  }
};

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
  getHabitCard(habit, completionDate) {
    if (!elements.daysContainer) return null;
    return elements.daysContainer.querySelector(
      `.completion-habit[data-habit-id="${habit.id}"][data-habit-type="${habit.type}"][data-completion-date="${completionDate}"]`
    );
  },
  findCompletionIndex(habit, completionDate) {
    return state.weeklyCompletions.findIndex((completion) =>
      matchesHabitAndDate(completion, habit, completionDate)
    );
  },
  findHistoryCompletionIndex(habit, completionDate) {
    return state.completions.findIndex((completion) =>
      matchesHabitAndDate(completion, habit, completionDate)
    );
  },
  getCompletionForHabit(habit, completionDate) {
    const index = this.findCompletionIndex(habit, completionDate);
    return index >= 0 ? state.weeklyCompletions[index] : null;
  },
  setCardBusy(habit, completionDate, isBusy) {
    const card = this.getHabitCard(habit, completionDate);
    if (!card) return;
    card.classList.toggle("is-busy", isBusy);
    const buttons = card.querySelectorAll(".status-button");
    buttons.forEach((button) => {
      button.disabled = isBusy;
    });
  },
  applyStatusToHabitCard(habit, completionDate, { status, completionId } = {}) {
    const card = this.getHabitCard(habit, completionDate);
    if (!card) return;

    const statusClasses = ["status-none", ...Object.keys(statusLabels).map((key) => `status-${key}`)];
    statusClasses.forEach((className) => card.classList.remove(className));

    const badge = card.querySelector(".status-pill");
    if (badge) {
      statusClasses.forEach((className) => badge.classList.remove(className));
    }

    const hasStatus = Boolean(status);
    if (hasStatus) {
      card.classList.add("has-status");
    } else {
      card.classList.remove("has-status");
    }

    const normalizedStatus = hasStatus ? status : "none";
    const cssClass = `status-${normalizedStatus}`;
    card.classList.add(cssClass);
    card.dataset.status = hasStatus ? status : "";

    if (badge) {
      badge.textContent = hasStatus
        ? statusLabels[status] || status.replace(/_/g, " ")
        : "Not completed";
      badge.classList.add(cssClass);
    }

    if (hasStatus && completionId) {
      card.dataset.completionId = String(completionId);
    } else {
      delete card.dataset.completionId;
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
        habitItem.dataset.day = habit.day;

        const completionDate = timeUtils.getDateForDay(habit.day);
        habitItem.dataset.completionDate = completionDate;

        const completion = this.getCompletionForHabit(habit, completionDate);
        if (completion) {
          habitItem.dataset.completionId = completion.id;
        }

        const statusClass = completion ? `status-${completion.status}` : "status-none";
        habitItem.classList.add(statusClass);
        if (completion) {
          habitItem.classList.add("has-status");
        }
        habitItem.dataset.status = completion ? completion.status : "";

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
            this.updateHabitCompletion({ habit, status: key, completionDate });
          });
          buttonContainer.appendChild(button);
        });

        footer.appendChild(statusBadge);
        

        habitItem.appendChild(header);
        habitItem.appendChild(footer);
        habitItem.appendChild(buttonContainer);
        habitItem.addEventListener("click", () => this.showModal(habit));
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
  async updateHabitCompletion({ habit, status, completionDate, silent = false }) {
    let completionDateTime = new Date(`${completionDate}T00:00:00`);
    if (Number.isNaN(completionDateTime.getTime())) {
      completionDateTime = new Date();
    } else {
      const now = new Date();
      completionDateTime.setHours(
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
        now.getMilliseconds()
      );
    }
    const completionISO = completionDateTime.toISOString();
    const isCurrentWeek = timeUtils.isDateInCurrentWeek(completionDateTime);
    const weeklyIndex = this.findCompletionIndex(habit, completionDate);
    const historyIndex = this.findHistoryCompletionIndex(habit, completionDate);
    const existingWeekly =
      weeklyIndex >= 0 ? { ...state.weeklyCompletions[weeklyIndex] } : null;
    const existingHistory =
      historyIndex >= 0 ? { ...state.completions[historyIndex] } : null;
    const previousStatus = existingWeekly?.status ?? existingHistory?.status ?? null;
    const previousCompletionId = existingWeekly?.id ?? existingHistory?.id ?? null;
    let success = false;

    this.setCardBusy(habit, completionDate, true);

    try {
      let completionRecord = null;
      if (previousCompletionId) {
        const updatedRecord = {
          id: previousCompletionId,
          habit_id: habit.id,
          habit_type: habit.type,
          status,
          completion_date: completionISO,
        };
        upsertCompletionRecord(state.completions, updatedRecord);
        if (isCurrentWeek) {
          upsertCompletionRecord(state.weeklyCompletions, updatedRecord);
        } else {
          removeCompletionRecord(state.weeklyCompletions, {
            id: previousCompletionId,
          });
        }
        await api.updateCompletion(previousCompletionId, status, completionDateTime);
        completionRecord = updatedRecord;
      } else {
        const provisionalRecord = {
          id: null,
          habit_id: habit.id,
          habit_type: habit.type,
          status,
          completion_date: completionISO,
        };
        let provisionalIndex = -1;
        if (isCurrentWeek) {
          provisionalIndex = upsertCompletionRecord(
            state.weeklyCompletions,
            provisionalRecord
          );
        }
        const response = await api.createCompletion(
          habit,
          status,
          completionDateTime
        );
        const completionId = response?.id;
        completionRecord = { ...provisionalRecord, id: completionId || null };
        if (completionId) {
          upsertCompletionRecord(state.completions, completionRecord);
          if (isCurrentWeek) {
            upsertCompletionRecord(state.weeklyCompletions, completionRecord);
          }
        } else if (provisionalIndex >= 0) {
          state.weeklyCompletions[provisionalIndex] = provisionalRecord;
        }
      }

      this.applyStatusToHabitCard(habit, completionDate, {
        status,
        completionId: completionRecord?.id,
      });

      if (
        state.selectedHabit &&
        state.selectedHabit.id === habit.id &&
        state.selectedHabit.type === habit.type &&
        state.selectedHabit.day === habit.day
      ) {
        state.selectedHabit.completion = completionRecord;
      }

      this.updateCompletionHistory();
      success = true;
    } catch (error) {
      if (previousCompletionId) {
        if (existingHistory) {
          upsertCompletionRecord(state.completions, existingHistory);
        } else {
          removeCompletionRecord(state.completions, {
            id: previousCompletionId,
            habit,
            completionDate,
          });
        }
        if (existingWeekly) {
          upsertCompletionRecord(state.weeklyCompletions, existingWeekly);
        } else {
          removeCompletionRecord(state.weeklyCompletions, {
            id: previousCompletionId,
            habit,
            completionDate,
          });
        }
      } else {
        removeCompletionRecord(state.weeklyCompletions, {
          habit,
          completionDate,
        });
      }
      this.applyStatusToHabitCard(habit, completionDate, {
        status: previousStatus,
        completionId: previousCompletionId,
      });
      if (
        state.selectedHabit &&
        state.selectedHabit.id === habit.id &&
        state.selectedHabit.type === habit.type &&
        state.selectedHabit.day === habit.day
      ) {
        state.selectedHabit.completion = existingWeekly || existingHistory || null;
      }
      this.updateCompletionHistory();
      console.error("Error updating completion:", error);
      if (!silent) {
        alert("An error occurred");
      }
    } finally {
      this.setCardBusy(habit, completionDate, false);
    }
    return success;
  },
  showModal(habit) {
    const completionDate = timeUtils.getDateForDay(habit.day);
    const latestCompletion = this.getCompletionForHabit(habit, completionDate);

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
    const success = await this.updateHabitCompletion({
      habit,
      status,
      completionDate,
      silent: true,
    });
    if (success) {
      this.closeModal();
      alert("Completion updated successfully!");
    }
  },
  async deleteCompletion() {
    if (!state.selectedHabit || !state.selectedHabit.completion) {
      alert("No completion to delete");
      return;
    }
    const habitSnapshot = { ...state.selectedHabit };
    const completionId = habitSnapshot.completion.id;
    const completionDate = timeUtils.getDateForDay(habitSnapshot.day);
    try {
      this.setCardBusy(habitSnapshot, completionDate, true);
      await api.deleteCompletion(completionId);
      state.completions = state.completions.filter(
        (item) => item.id !== completionId
      );
      removeCompletionRecord(state.weeklyCompletions, { id: completionId });
      if (
        state.selectedHabit &&
        state.selectedHabit.id === habitSnapshot.id &&
        state.selectedHabit.type === habitSnapshot.type &&
        state.selectedHabit.day === habitSnapshot.day
      ) {
        state.selectedHabit.completion = null;
      }
      this.applyStatusToHabitCard(habitSnapshot, completionDate, {
        status: null,
        completionId: null,
      });
      this.updateCompletionHistory();
      this.closeModal();
      alert("Completion deleted successfully!");
    } catch (error) {
      console.error("Error deleting completion:", error);
      alert("An error occurred");
    } finally {
      this.setCardBusy(habitSnapshot, completionDate, false);
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
      newCompletions.forEach((completion) => {
        if (timeUtils.isDateInCurrentWeek(completion.completion_date)) {
          upsertCompletionRecord(state.weeklyCompletions, completion);
        }
      });
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
