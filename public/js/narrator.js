import { api, timeUtils } from "./utils.js";

const narratorPage = {
  elements: {},
  state: {
    narrators: [],
    samples: [],
    selectedNarratorId: null,
    selectedDate: timeUtils.getTodayDate(),
    generationInProgress: false,
  },
  init() {
    this.cacheElements();
    this.bindEvents();
    this.resetNarratorForm();
    this.state.selectedDate = timeUtils.getTodayDate();
    if (this.elements.generationDate) {
      this.elements.generationDate.value = this.state.selectedDate;
    }
    this.loadAllData();
  },
  cacheElements() {
    this.elements = {
      container: document.getElementById("narrator"),
      list: document.getElementById("narratorList"),
      form: document.getElementById("narratorForm"),
      narratorId: document.getElementById("narratorId"),
      narratorName: document.getElementById("narratorName"),
      rolePrompt: document.getElementById("rolePrompt"),
      stylePrompt: document.getElementById("stylePrompt"),
      voice: document.getElementById("narratorVoice"),
      sampleSelect: document.getElementById("narratorSampleSelect"),
      samplePath: document.getElementById("narratorSamplePath"),
      temperature: document.getElementById("narratorTemperature"),
      isDefault: document.getElementById("narratorIsDefault"),
      formSubmit: document.getElementById("narratorFormSubmit"),
      formReset: document.getElementById("narratorFormReset"),
      generationDate: document.getElementById("generationDate"),
      generateButton: document.getElementById("generateClipsButton"),
      generationSummary: document.getElementById("generationSummary"),
      clipStatusContainer: document.getElementById("clipStatusContainer"),
      sampleUploadForm: document.getElementById("sampleUploadForm"),
      sampleLabel: document.getElementById("sampleLabel"),
      sampleFile: document.getElementById("sampleFile"),
      sampleList: document.getElementById("sampleList"),
      sampleStatus: document.getElementById("sampleStatus"),
    };
  },
  bindEvents() {
    if (this.elements.form) {
      this.elements.form.addEventListener("submit", (event) => {
        event.preventDefault();
        this.handleNarratorSubmit();
      });
    }
    if (this.elements.formReset) {
      this.elements.formReset.addEventListener("click", () => {
        this.resetNarratorForm();
      });
    }
    if (this.elements.list) {
      this.elements.list.addEventListener("click", (event) => {
        const action = event.target.dataset.action;
        const id = Number.parseInt(event.target.dataset.id, 10);
        if (!action || Number.isNaN(id)) return;
        if (action === "select") this.populateNarratorForm(id);
        if (action === "default") this.handleSetDefaultNarrator(id);
        if (action === "delete") this.handleDeleteNarrator(id);
      });
    }
    if (this.elements.sampleSelect) {
      this.elements.sampleSelect.addEventListener("change", (event) => {
        this.elements.samplePath.value = event.target.value || "";
      });
    }
    if (this.elements.samplePath) {
      this.elements.samplePath.addEventListener("input", (event) => {
        const entered = event.target.value;
        if (!entered) {
          this.elements.sampleSelect.value = "";
          return;
        }
        const matchingOption = Array.from(
          this.elements.sampleSelect.options
        ).find((option) => option.value === entered);
        if (matchingOption) {
          this.elements.sampleSelect.value = matchingOption.value;
        } else {
          this.elements.sampleSelect.value = "";
        }
      });
    }
    if (this.elements.generationDate) {
      this.elements.generationDate.addEventListener("change", (event) => {
        const value = event.target.value;
        this.state.selectedDate = value || timeUtils.getTodayDate();
        this.refreshClipSummary();
      });
    }
    if (this.elements.generateButton) {
      this.elements.generateButton.addEventListener("click", () => {
        this.handleGenerateClips();
      });
    }
    if (this.elements.sampleUploadForm) {
      this.elements.sampleUploadForm.addEventListener("submit", (event) => {
        event.preventDefault();
        this.handleSampleUpload();
      });
    }
    if (this.elements.sampleList) {
      this.elements.sampleList.addEventListener("click", (event) => {
        const action = event.target.dataset.action;
        const id = Number.parseInt(event.target.dataset.id, 10);
        if (action === "delete" && !Number.isNaN(id)) {
          this.handleDeleteSample(id);
        }
      });
    }
  },
  async loadAllData() {
    await Promise.all([
      this.loadNarrators(),
      this.loadSamples(),
      this.refreshClipSummary(),
    ]);
  },
  async loadNarrators() {
    try {
      const payload = await api.fetchNarrators();
      this.state.narrators = payload.narrators || [];
      this.renderNarratorList();
      this.syncSelectedNarrator();
    } catch (error) {
      console.error("Failed to load narrators", error);
      alert("Unable to load narrators. Please try again.");
    }
  },
  renderNarratorList() {
    if (!this.elements.list) return;
    if (!this.state.narrators.length) {
      this.elements.list.innerHTML = `<p class="empty-state">No narrators yet. Create one below.</p>`;
      return;
    }
    const selectedId = this.state.selectedNarratorId;
    this.elements.list.innerHTML = this.state.narrators
      .map((narrator) => {
        const clipSummary = `${narrator.ready_clip_count ?? 0}/${narrator.clip_count ?? 0} clips ready`;
        return `
          <div class="narrator-item ${
            narrator.is_default ? "is-default" : ""
          } ${selectedId === narrator.id ? "is-selected" : ""}">
            <div class="narrator-item__info">
              <div class="narrator-item__heading">
                <h3>${narrator.name}</h3>
                ${
                  narrator.is_default
                    ? '<span class="narrator-item__badge">Default</span>'
                    : ""
                }
              </div>
              <p class="narrator-item__meta">
                Voice: ${narrator.voice || "—"} • Sample: ${
          narrator.sample_path || "None"
        } • ${clipSummary}
              </p>
            </div>
            <div class="narrator-item__actions">
              <button type="button" data-action="select" data-id="${
                narrator.id
              }">Edit</button>
              <button type="button" data-action="default" data-id="${
                narrator.id
              }">Set Default</button>
              <button type="button" data-action="delete" data-id="${
                narrator.id
              }">Delete</button>
            </div>
          </div>
        `;
      })
      .join("");
  },
  syncSelectedNarrator() {
    if (!this.state.selectedNarratorId) return;
    const exists = this.state.narrators.some(
      (narrator) => narrator.id === this.state.selectedNarratorId
    );
    if (!exists) {
      this.state.selectedNarratorId = null;
      this.resetNarratorForm();
    }
  },
  resetNarratorForm() {
    if (!this.elements.form) return;
    this.elements.form.reset();
    if (this.elements.narratorId) this.elements.narratorId.value = "";
    if (this.elements.sampleSelect) this.elements.sampleSelect.value = "";
    if (this.elements.samplePath) this.elements.samplePath.value = "";
    this.state.selectedNarratorId = null;
    if (this.elements.formSubmit) {
      this.elements.formSubmit.textContent = "Create Narrator";
    }
  },
  populateNarratorForm(id) {
    const narrator = this.state.narrators.find((item) => item.id === id);
    if (!narrator) return;
    this.state.selectedNarratorId = id;
    if (this.elements.narratorId) this.elements.narratorId.value = String(id);
    if (this.elements.narratorName)
      this.elements.narratorName.value = narrator.name || "";
    if (this.elements.rolePrompt)
      this.elements.rolePrompt.value = narrator.role_prompt || "";
    if (this.elements.stylePrompt)
      this.elements.stylePrompt.value = narrator.style_prompt || "";
    if (this.elements.voice)
      this.elements.voice.value = narrator.voice || "";
    if (this.elements.samplePath)
      this.elements.samplePath.value = narrator.sample_path || "";
    if (this.elements.sampleSelect) {
      const matchingOption = Array.from(
        this.elements.sampleSelect.options
      ).find((option) => option.value === narrator.sample_path);
      this.elements.sampleSelect.value = matchingOption
        ? matchingOption.value
        : "";
    }
    if (this.elements.temperature)
      this.elements.temperature.value =
        narrator.temperature !== undefined && narrator.temperature !== null
          ? narrator.temperature
          : 0.7;
    if (this.elements.isDefault)
      this.elements.isDefault.checked = Boolean(narrator.is_default);
    if (this.elements.formSubmit) {
      this.elements.formSubmit.textContent = "Update Narrator";
    }
    this.renderNarratorList();
  },
  async handleNarratorSubmit() {
    if (!this.elements.form) return;
    const name = this.elements.narratorName.value.trim();
    const rolePrompt = this.elements.rolePrompt.value.trim();
    if (!name || !rolePrompt) {
      alert("Name and role prompt are required.");
      return;
    }
    const payload = {
      name,
      role_prompt: rolePrompt,
      style_prompt: this.elements.stylePrompt.value.trim() || null,
      voice: this.elements.voice.value.trim() || null,
      sample_path: this.elements.samplePath.value.trim() || null,
      temperature: Number.parseFloat(this.elements.temperature.value) || 0.7,
      is_default: this.elements.isDefault.checked,
    };
    try {
      if (this.state.selectedNarratorId) {
        await api.updateNarrator(this.state.selectedNarratorId, payload);
      } else {
        const { narrator } = await api.createNarrator(payload);
        if (narrator) {
          this.state.selectedNarratorId = narrator.id;
        }
      }
      await this.loadNarrators();
      this.renderNarratorList();
      if (!this.state.selectedNarratorId) {
        this.resetNarratorForm();
      } else {
        this.populateNarratorForm(this.state.selectedNarratorId);
      }
      alert("Narrator saved successfully.");
    } catch (error) {
      console.error("Failed to save narrator", error);
      alert("Failed to save narrator. Please try again.");
    }
  },
  async handleSetDefaultNarrator(id) {
    try {
      await api.setDefaultNarrator(id);
      this.state.selectedNarratorId = id;
      await this.loadNarrators();
      this.populateNarratorForm(id);
    } catch (error) {
      console.error("Failed to set default narrator", error);
      alert("Unable to set default narrator.");
    }
  },
  async handleDeleteNarrator(id) {
    if (!window.confirm("Delete this narrator? This cannot be undone.")) return;
    try {
      await api.deleteNarrator(id);
      if (this.state.selectedNarratorId === id) {
        this.resetNarratorForm();
      }
      await this.loadNarrators();
    } catch (error) {
      console.error("Failed to delete narrator", error);
      alert("Unable to delete narrator. Please try again.");
    }
  },
  async loadSamples() {
    try {
      const payload = await api.fetchNarratorSamples();
      this.state.samples = payload.samples || [];
      this.renderSampleOptions();
      this.renderSampleList();
    } catch (error) {
      console.error("Failed to load narrator samples", error);
      alert("Unable to load narrator samples.");
    }
  },
  renderSampleOptions() {
    if (!this.elements.sampleSelect) return;
    const options = [
      '<option value="">No sample</option>',
      ...this.state.samples.map(
        (sample) =>
          `<option value="${sample.file_path}">${sample.label} (${sample.file_path})</option>`
      ),
    ];
    this.elements.sampleSelect.innerHTML = options.join("");
    if (this.elements.samplePath && this.elements.samplePath.value) {
      const matchingOption = Array.from(
        this.elements.sampleSelect.options
      ).find((option) => option.value === this.elements.samplePath.value);
      if (matchingOption) {
        this.elements.sampleSelect.value = matchingOption.value;
      }
    }
  },
  renderSampleList() {
    if (!this.elements.sampleList) return;
    if (!this.state.samples.length) {
      this.elements.sampleList.innerHTML =
        '<p class="empty-state">No samples uploaded yet.</p>';
      return;
    }
    this.elements.sampleList.innerHTML = this.state.samples
      .map(
        (sample) => `
        <div class="sample-item">
          <div class="sample-item__details">
            <strong>${sample.label}</strong>
            <span>${sample.file_path}</span>
          </div>
          <button type="button" data-action="delete" data-id="${sample.id}">Remove</button>
        </div>
      `
      )
      .join("");
  },
  async handleSampleUpload() {
    if (!this.elements.sampleFile?.files?.length) {
      alert("Select a sample file to upload.");
      return;
    }
    const formData = new FormData();
    formData.append("sample", this.elements.sampleFile.files[0]);
    if (this.elements.sampleLabel.value.trim()) {
      formData.append("label", this.elements.sampleLabel.value.trim());
    }
    try {
      await api.uploadNarratorSample(formData);
      this.elements.sampleUploadForm.reset();
      await this.loadSamples();
      if (this.elements.sampleStatus) {
        this.elements.sampleStatus.textContent = "Sample uploaded successfully.";
        setTimeout(() => {
          this.elements.sampleStatus.textContent = "";
        }, 4000);
      }
    } catch (error) {
      console.error("Failed to upload sample", error);
      alert("Failed to upload sample. Please try again.");
    }
  },
  async handleDeleteSample(id) {
    if (
      !window.confirm(
        "Remove this sample? The underlying file will also be deleted."
      )
    )
      return;
    try {
      await api.deleteNarratorSample(id, { removeFile: true });
      await this.loadSamples();
    } catch (error) {
      console.error("Failed to delete sample", error);
      alert("Unable to delete sample.");
    }
  },
  async handleGenerateClips() {
    if (this.state.generationInProgress) return;
    const narratorId =
      this.state.selectedNarratorId ||
      this.state.narrators.find((item) => item.is_default)?.id;
    if (!narratorId) {
      alert("Select or create a narrator first.");
      return;
    }
    const date = this.state.selectedDate || timeUtils.getTodayDate();
    this.state.generationInProgress = true;
    this.updateGenerationButtonState();
    try {
      const result = await api.generateNarratorClips(narratorId, date);
      this.renderGenerationSummary(result);
      await this.refreshClipSummary();
      await this.loadNarrators();
    } catch (error) {
      console.error("Failed to generate clips", error);
      alert("Audio generation failed. Check the server logs for details.");
    } finally {
      this.state.generationInProgress = false;
      this.updateGenerationButtonState();
    }
  },
  updateGenerationButtonState() {
    if (!this.elements.generateButton) return;
    this.elements.generateButton.disabled = this.state.generationInProgress;
    this.elements.generateButton.textContent = this.state.generationInProgress
      ? "Generating..."
      : "Generate Clips";
  },
  renderGenerationSummary(result) {
    if (!this.elements.generationSummary) return;
    if (!result) {
      this.elements.generationSummary.innerHTML = "";
      return;
    }
    const { summary, date } = result;
    const failures = (result.clips || []).filter(
      (clip) => clip.status !== "ready"
    );
    this.elements.generationSummary.innerHTML = `
      <div class="generation-summary__content">
        <strong>${summary.ready}/${summary.total}</strong> clips ready for ${date}.
        ${
          failures.length
            ? `<p class="error-message">${failures.length} clips failed. Check logs for details.</p>`
            : ""
        }
      </div>
    `;
  },
  async refreshClipSummary() {
    if (!this.elements.clipStatusContainer) return;
    try {
      const data = await api.fetchClipSummary(this.state.selectedDate);
      this.renderClipSummary(data);
    } catch (error) {
      console.error("Failed to load clip summary", error);
      this.elements.clipStatusContainer.innerHTML =
        '<p class="error-message">Unable to load clip summary.</p>';
    }
  },
  renderClipSummary(data) {
    if (!this.elements.clipStatusContainer) return;
    const clips = data?.clips || [];
    if (!clips.length) {
      this.elements.clipStatusContainer.innerHTML = `
        <p class="empty-state">No clips generated for ${data?.date || this.state.selectedDate}.</p>
      `;
      return;
    }
    const rows = clips
      .map((clip) => {
        const statusClass =
          clip.status === "ready" ? "status--ready" : "status--pending";
        const scriptPreview = clip.script
          ? clip.script.slice(0, 140) + (clip.script.length > 140 ? "…" : "")
          : "";
        const playButton =
          clip.status === "ready"
            ? `<button type="button" data-action="play" data-type="${clip.habit_type}" data-id="${clip.habit_id}">Play</button>`
            : "";
        return `
          <tr>
            <td>${clip.habit_type}</td>
            <td>${clip.habit_id}</td>
            <td>${clip.event || "—"}</td>
            <td><span class="status ${statusClass}">${clip.status}</span></td>
            <td>${scriptPreview || "—"}</td>
            <td>${playButton}</td>
          </tr>
        `;
      })
      .join("");
    this.elements.clipStatusContainer.innerHTML = `
      <table class="clip-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>ID</th>
            <th>Habit</th>
            <th>Status</th>
            <th>Script preview</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
    this.elements.clipStatusContainer
      .querySelectorAll("button[data-action='play']")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const habitType = button.dataset.type;
          const habitId = Number.parseInt(button.dataset.id, 10);
          if (!habitType || Number.isNaN(habitId)) return;
          api.playAudioForHabit(
            { id: habitId, type: habitType },
            { date: this.state.selectedDate }
          );
        });
      });
  },
};

export { narratorPage };
