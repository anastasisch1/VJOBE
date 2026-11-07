const addButtonSvg = `<img class="add-button-icon" src="../Add_button.svg" alt="Add" aria-hidden="true" />`;
const asset = (fileName, className = "icon") => `<img class="${className}" src="../${encodeURIComponent(fileName)}" alt="" />`;

const icons = {
  logo: asset("VJOBE_logo.svg", "brand-logo"),
  applications: asset("my applications.svg", "nav-icon"),
  statistics: asset("my statistics.svg", "nav-icon"),
  data: asset("my data.svg", "nav-icon"),
  saved: asset("saved vacancies.svg", "nav-icon"),
  calendar: asset("calendar.svg", "nav-icon"),
  search: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="4"><circle cx="20" cy="20" r="13"/><path d="M30 30l12 12"/></svg>`,
  filters: asset("filter.svg", "filter-icon"),
  more: asset("More_button.svg", "more-icon"),
  backFront: asset("back-front_button.svg", "arrow-icon")
};

const defaultState = {
  version: 2,
  user: {
    firstName: "",
    lastName: "",
    nameParts: ["", ""],
    cv: "",
    motivation: ""
  },
  applications: [],
  savedVacancies: [],
  events: [],
  filters: {
    Applied: true,
    Interview: true,
    Rejected: true,
    Other: true
  },
  favoriteOnly: false,
  selectedTags: [],
  selectedSavedCategories: null,
  applicationsSort: "az",
  savedSort: "az",
  currentMonth: new Date().getMonth(),
  currentYear: new Date().getFullYear()
};

const storageKey = "vjobe-state-v1";
const app = document.querySelector("#app");
let state = loadState();
let route = "applications";
let selectedApplicationId = null;
let query = "";
let filterOpen = false;

function loadState() {
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return structuredClone(defaultState);

    const parsed = { ...defaultState, ...JSON.parse(stored) };
    parsed.user = { ...defaultState.user, ...parsed.user };
    parsed.filters = { ...defaultState.filters, ...(parsed.filters || {}) };
    parsed.favoriteOnly = Boolean(parsed.favoriteOnly);
    if (!Array.isArray(parsed.user.nameParts) || !parsed.user.nameParts.length) {
      parsed.user.nameParts = [parsed.user.firstName || "", parsed.user.lastName || ""];
    }
    return parsed;
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function statusClass(status) {
  return status.toLowerCase();
}

function formatDate(value) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

function visibleApplications() {
  const normalized = query.trim().toLowerCase();
  const selectedTags = state.selectedTags || [];
  const allTags = [...new Set(state.applications.flatMap((item) => item.tags || []))];
  return state.applications
    .filter((item) => state.filters[item.status])
    .filter((item) => !state.favoriteOnly || item.favorite)
    .filter(
      (item) =>
        !selectedTags.length ||
        allTags.every((tag) => selectedTags.includes(tag)) ||
        (item.tags || []).some((tag) => selectedTags.includes(tag))
    )
    .filter((item) => {
      if (!normalized) return true;
      return [item.company, item.title, item.status, item.link, (item.tags || []).join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    })
    .sort((a, b) => {
      if (state.applicationsSort === "za") return b.company.localeCompare(a.company);
      if (state.applicationsSort === "new") return getApplicationAddedTime(b) - getApplicationAddedTime(a);
      if (state.applicationsSort === "recent") return getApplicationDate(b) - getApplicationDate(a);
      if (state.applicationsSort === "oldest") return getApplicationDate(a) - getApplicationDate(b);
      if (state.applicationsSort === "updated") return getApplicationUpdatedTime(b) - getApplicationUpdatedTime(a);
      return a.company.localeCompare(b.company);
    });
}

function render() {
  app.innerHTML = `
    <div class="shell">
      ${renderSidebar()}
      <main class="main">
        ${renderTopbar()}
        ${renderScreen()}
      </main>
    </div>
    ${filterOpen ? renderFilterPopover() : ""}
  `;
  bindEvents();
}

function renderSidebar() {
  const nav = [
    ["applications", "my applications", icons.applications],
    ["statistics", "my statistics", icons.statistics],
    ["data", "my data", icons.data],
    ["saved", "saved vacancies", icons.saved],
    ["calendar", "calendar", icons.calendar]
  ];

  return `
    <aside class="sidebar">
      <div class="brand">${icons.logo}</div>
      <p class="hello">${state.user.firstName ? `Hello, ${escapeHtml(state.user.firstName)}!` : "Hello!"}</p>
      <nav class="nav">
        ${nav
          .map(
            ([id, label, icon]) => `
              <button class="${route === id ? "active" : ""}" data-route="${id}" title="${label}">
                ${icon}
                <span>${label}</span>
              </button>
            `
          )
          .join("")}
      </nav>
    </aside>
  `;
}

function renderTopbar() {
  return `
    <div class="topbar">
      <h1>${pageTitle()}</h1>
      <label class="search">
        <input value="${escapeHtml(query)}" data-search placeholder="" />
        ${icons.search}
      </label>
      <button class="filter-button" data-toggle-filters title="Filters">${icons.filters}</button>
    </div>
  `;
}

function pageTitle() {
  if (route === "applications") return "My applications";
  if (route === "detail") return "Company";
  if (route === "statistics") return "My statistics";
  if (route === "data") return "My data";
  if (route === "saved") return "Saved vacancies";
  return "Calendar";
}

function renderScreen() {
  if (route === "applications") return renderApplications();
  if (route === "detail") return renderDetail();
  if (route === "statistics") return renderStatistics();
  if (route === "data") return renderData();
  if (route === "saved") return renderSaved();
  return renderCalendar();
}

function renderApplications() {
  return `
    <div class="applications-toolbar">
      <label class="sort-select-label">
        <span>Sort by</span>
        <select class="sort-select" data-sort-applications aria-label="Sort applications">
          <option value="az" ${state.applicationsSort === "az" ? "selected" : ""}>A-Z</option>
          <option value="za" ${state.applicationsSort === "za" ? "selected" : ""}>Z-A</option>
          <option value="new" ${state.applicationsSort === "new" ? "selected" : ""}>New added first</option>
          <option value="recent" ${state.applicationsSort === "recent" ? "selected" : ""}>Date: newest first</option>
          <option value="oldest" ${state.applicationsSort === "oldest" ? "selected" : ""}>Date: oldest first</option>
          <option value="updated" ${state.applicationsSort === "updated" ? "selected" : ""}>Recently Updated</option>
        </select>
      </label>
      <button class="add-company-button" data-add-company title="Add company card" aria-label="Add company card">
        <img src="../Add_button.svg" alt="Add company card" />
      </button>
    </div>
    <div data-application-results>${renderApplicationResults()}</div>
  `;
}

function renderApplicationResults() {
  const items = visibleApplications();
  return items.length
    ? `<section class="app-grid">
        ${items
          .map(
            (item) => `
            <button class="application-card" data-open-application="${item.id}">
              <h2>${escapeHtml(item.company)}</h2>
              <div class="meta">
                <span class="dot ${statusClass(item.status)}"></span>
                <span class="truncate">${escapeHtml(item.title || "New role")}</span>
              </div>
              <div class="card-tags">
                ${(item.tags || []).map((tag) => `<span class="card-tag">${escapeHtml(tag)}</span>`).join("")}
              </div>
            </button>
          `
          )
          .join("")}
      </section>`
    : `<p class="empty">No applications match this view.</p>`;
}

function renderDetail() {
  const item = state.applications.find((entry) => entry.id === selectedApplicationId) || state.applications[0];
  if (!item) return renderApplications();
  selectedApplicationId = item.id;

  return `
    <section class="detail">
      <div class="detail-header">
        <div class="detail-company-wrap">
          <button class="detail-back" data-back-to-applications title="Back to applications" aria-label="Back to applications">
            ${icons.backFront}
          </button>
          <input
            class="detail-company-input"
            data-app-field="company"
            value="${escapeAttr(item.company)}"
            aria-label="Company name"
          />
        </div>
        <div class="detail-actions">
          <button class="favorite-button ${item.favorite ? "is-favorite" : ""}" data-toggle-favorite aria-pressed="${Boolean(item.favorite)}" title="${item.favorite ? "Remove from favorites" : "Add to favorites"}" aria-label="${item.favorite ? "Remove from favorites" : "Add to favorites"}">
            <svg viewBox="0 0 64 64" aria-hidden="true"><path d="m32 5 8.2 17 18.8 2.7-13.6 13.3 3.2 18.7L32 47.9l-16.6 8.8 3.2-18.7L5 24.7 23.8 22z" /></svg>
          </button>
          <button class="detail-action save" data-save-application>Save</button>
        </div>
      </div>
      <div class="detail-row">
        <label class="status-control">
          <span>Status:</span>
          <select class="status-select" data-app-field="status">
            ${["Applied", "Interview", "Rejected", "Other"]
              .map((status) => `<option ${item.status === status ? "selected" : ""}>${status}</option>`)
              .join("")}
          </select>
          <span class="dot ${statusClass(item.status)}"></span>
        </label>
        <label class="tag-control">
          <span>Add tag:</span>
          <input class="text-input" data-new-tag placeholder="Java, Germany" />
          <button class="square-button" data-add-tag title="Add tag">${addButtonSvg}</button>
        </label>
        <input class="date-input" data-app-field="date" type="date" value="${item.date}" />
      </div>
      <div class="field-pair">
        <input class="text-input" data-app-field="title" value="${escapeAttr(item.title === "New role" ? "" : item.title)}" placeholder="New role" aria-label="Role title" />
        <div class="company-link-field">
          <input class="text-input" data-app-field="link" value="${escapeAttr(item.link)}" />
          <button class="open-link" data-open-company-link title="Open company link" aria-label="Open company link">↗</button>
        </div>
      </div>
      <div class="tag-control-list">
        ${item.tags
          .map(
            (tag, index) => `
              <span class="tag">
                <span>${escapeHtml(tag)}</span>
                <button class="tag-delete" data-delete-tag="${index}" title="Delete tag" aria-label="Delete tag">×</button>
              </span>
            `
          )
          .join("")}
      </div>
      ${renderEditor(item.notesHtml, item.notes, 'data-app-field="notes"', "Notes")}
      <div class="files-row">
        <span class="files-heading">Files attached:</span>
        <div class="files-list">
        ${item.files
          .map(
            (file, index) => {
              const fileName = typeof file === "string" ? file : file.name || "File";
              return `
                <button type="button" class="document-chip" data-download-attachment="${index}" title="Download ${escapeAttr(fileName)}" aria-label="Download ${escapeAttr(fileName)}">
                  <span class="doc-icon"><span></span></span>
                  <span class="document-name" title="${escapeAttr(fileName)}">${escapeHtml(fileName)}</span>
                </button>
              `;
            }
          )
          .join("")}
        <input type="file" class="hidden-file-input" data-file-input accept=".pdf,.doc,.docx,.txt,.rtf,.odt,image/*" multiple />
        <button class="square-button" data-add-file title="Attach file">${addButtonSvg}</button>
        </div>
      </div>
      <div class="detail-footer"><button class="detail-action delete" data-delete-application>Delete</button></div>
    </section>
  `;
}

function renderStatistics() {
  const total = state.applications.length;
  const counts = {
    Applied: state.applications.filter((item) => item.status === "Applied").length,
    Rejected: state.applications.filter((item) => item.status === "Rejected").length,
    Interview: state.applications.filter((item) => item.status === "Interview").length
  };
  const stats = [
    ["Waiting for response", "Applied", "var(--yellow)"],
    ["Rejected", "Rejected", "var(--red)"],
    ["Interview", "Interview", "var(--green)"]
  ];

  return `
    <section>
      <div class="stats-lead">Applied in total: ${total}</div>
      <div class="stats-grid">
        ${stats
          .map(([label, status, color]) => {
            const raw = total ? (counts[status] / total) * 100 : 0;
            const value = raw > 0 && raw < 1 ? 1 : Math.round(raw);
            const labelValue = raw > 0 && raw < 1 ? "&lt;1%" : `${value}%`;
            return `
              <article class="stat">
                <div class="donut" style="--value: ${value}; --color: ${color};">
                  <strong>${labelValue}</strong>
                </div>
                <div class="legend"><span class="dot ${statusClass(status)}"></span>${label} (${counts[status]})</div>
              </article>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderSaved() {
  const vacancies = visibleSavedVacancies();

  return `
    <div class="saved-controls">
      <label class="sort-select-label">
        <span>Sort by</span>
        <select class="sort-select" data-sort-saved>
          <option value="az" ${state.savedSort === "az" ? "selected" : ""}>A-Z</option>
          <option value="new" ${state.savedSort === "new" ? "selected" : ""}>New first</option>
          <option value="old" ${state.savedSort === "old" ? "selected" : ""}>Old first</option>
        </select>
      </label>
      <span class="saved-count">${vacancies.length} companies</span>
      <button class="add-row" data-add-saved title="Add saved vacancy" aria-label="Add saved vacancy">${addButtonSvg}</button>
    </div>
    <section class="saved-table">
      <div class="table-head">
        <span>Company:</span>
        <span>Link:</span>
        <span>Note:</span>
        <span>Category:</span>
        <span></span>
      </div>
      <div class="saved-results" data-saved-results>${renderSavedRows(vacancies)}</div>
    </section>
  `;
}

function visibleSavedVacancies() {
  const normalized = query.trim().toLowerCase();
  const selectedCategories = state.selectedSavedCategories;
  return state.savedVacancies
    .filter((item) => selectedCategories === null || selectedCategories.includes(String(item.category || "").trim()))
    .filter((item) => {
      if (!normalized) return true;
      return [item.company, item.link, item.note, item.category].join(" ").toLowerCase().includes(normalized);
    })
    .sort(compareSavedVacancies);
}

function renderSavedRows(vacancies = visibleSavedVacancies()) {
  return vacancies.length
    ? vacancies
        .map(
          (item) => `
          <div class="saved-row" data-saved-row="${item.id}">
            <input data-saved-field="company" value="${escapeAttr(item.company)}" />
            <div class="saved-link-field">
              <input data-saved-field="link" value="${escapeAttr(item.link)}" />
              <button class="open-link" data-open-saved-link="${item.id}" title="Open vacancy link" aria-label="Open vacancy link">↗</button>
            </div>
            <input data-saved-field="note" value="${escapeAttr(item.note)}" />
            <input data-saved-field="category" value="${escapeAttr(item.category || "")}" />
            <button class="delete-row" data-delete-saved="${item.id}" title="Delete saved vacancy">x</button>
          </div>
        `
        )
        .join("")
    : `<p class="empty">No saved vacancies match this search.</p>`;
}

function renderData() {
  return `
    <section class="profile-grid">
      <div>
        <section class="data-section">
          <label class="section-label">Name</label>
          <div class="name-entry-grid">
            <div class="name-fields">
              ${state.user.nameParts
                .map(
                  (part, index) => `
                    <input class="text-input" data-name-part="${index}" value="${escapeAttr(part)}" aria-label="Name part ${index + 1}" />
                  `
                )
                .join("")}
            </div>
            <button class="square-button add-name-button" data-add-name-part title="Add name field" aria-label="Add name field">${addButtonSvg}</button>
          </div>
          <button class="detail-action save data-save-button" data-save-user-section="name">Save</button>
        </section>

        <section class="data-section">
          <label class="section-label">CV</label>
          ${renderEditor(state.user.cvHtml, state.user.cv, 'data-user-field="cv"', "CV")}
          <div class="data-actions">
            <button class="detail-action save data-save-button" data-save-user-section="cv">Save</button>
            <button class="download-button" data-download="cv">${icons.more} Download</button>
          </div>
        </section>

        <section class="data-section">
          <label class="section-label">Motivation letter</label>
          ${renderEditor(state.user.motivationHtml, state.user.motivation, 'data-user-field="motivation"', "Motivation letter")}
          <div class="data-actions">
            <button class="detail-action save data-save-button" data-save-user-section="motivation">Save</button>
            <button class="download-button" data-download="motivation">${icons.more} Download</button>
          </div>
        </section>
      </div>
      <div class="folder-art">
        <img class="folder-illustration" src="../folder%20illustration.svg" alt="Folder illustration" />
      </div>
    </section>
  `;
}

function renderCalendar() {
  const monthName = new Intl.DateTimeFormat("en", { month: "long" }).format(
    new Date(state.currentYear, state.currentMonth, 1)
  );
  const firstDay = new Date(state.currentYear, state.currentMonth, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(state.currentYear, state.currentMonth + 1, 0).getDate();
  const cells = [];

  for (let index = 0; index < startOffset; index += 1) {
    cells.push({ blank: true });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ blank: true });
  }

  return `
    <section>
      <div class="calendar-header">
        <button class="month-button prev" data-month="-1" title="Previous month">${icons.backFront}</button>
        <h2>${monthName}</h2>
        <button class="month-button next" data-month="1" title="Next month">${icons.backFront}</button>
      </div>
      <div class="calendar-grid">
        ${["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => `<div class="weekday">${day}</div>`).join("")}
        ${cells
          .map((cell, index) => {
            if (cell.blank) return `<div class="day-cell"></div>`;
            const events = state.events.filter(
              (event) =>
                event.day === cell.day && event.month === state.currentMonth && event.year === state.currentYear
            );
            const weekend = index % 7 === 5 || index % 7 === 6;
            return `
              <div class="day-cell ${weekend ? "weekend" : ""}">
                <div class="day-number">${cell.day}</div>
                <div class="day-events">
                  ${events.map((event) => `<div class="day-event">${event.textHtml ? sanitizeRichText(event.textHtml) : escapeHtml(event.text).replace(/\n/g, "<br>")}</div>`).join("")}
                </div>
                <button class="square-button add-event" data-add-event="${cell.day}" title="Add event">${addButtonSvg}</button>
              </div>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderFilterPopover() {
  if (route === "saved") {
    const categories = [...new Set(state.savedVacancies.map((item) => String(item.category || "").trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
    const selectedCategories = state.selectedSavedCategories;
    const allSelected = selectedCategories === null || categories.every((category) => selectedCategories.includes(category));

    return `
      <div class="filter-popover">
        ${renderFilterSort(true)}
        <button class="filter-select-all" data-toggle-all-filters type="button">${allSelected ? "Deselect All" : "Select All"}</button>
        <div class="filter-group">
          <strong>Category</strong>
          ${categories
            .map(
              (category) => `
                <label>
                  <input type="checkbox" data-filter-category="${escapeAttr(category)}" ${selectedCategories === null || selectedCategories.includes(category) ? "checked" : ""} />
                  <span>${escapeHtml(category)}</span>
                </label>
              `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  const tags = [...new Set(state.applications.flatMap((item) => item.tags || []))].sort((a, b) => a.localeCompare(b));
  const selectedTags = state.selectedTags || [];
  const allSelected = Object.values(state.filters).every(Boolean) && tags.every((tag) => selectedTags.includes(tag));
  return `
    <div class="filter-popover">
      ${renderFilterSort(false)}
      <button class="filter-select-all" data-toggle-all-filters type="button">${allSelected ? "Deselect All" : "Select All"}</button>
      <div class="filter-group">
        <strong>Status</strong>
        ${Object.keys(state.filters)
          .map(
            (status) => `
            <label>
              <input type="checkbox" data-filter="${status}" ${state.filters[status] ? "checked" : ""} />
              <span>${status}</span>
            </label>
          `
          )
          .join("")}
      </div>
      <div class="filter-group">
        <strong>Favorites</strong>
        <label>
          <input type="checkbox" data-filter-favorites ${state.favoriteOnly ? "checked" : ""} />
          <span>Only favorites</span>
        </label>
      </div>
      ${tags.length ? `
        <div class="filter-group">
          <strong>Tags</strong>
          ${tags
            .map(
              (tag) => `
              <label>
                <input type="checkbox" data-filter-tag="${escapeAttr(tag)}" ${selectedTags.includes(tag) ? "checked" : ""} />
                <span>${escapeHtml(tag)}</span>
              </label>
            `
            )
            .join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function bindEvents() {
  bindEditors(document);
  document.querySelector("[data-filter-sort]")?.addEventListener("change", (event) => {
    state[route === "saved" ? "savedSort" : "applicationsSort"] = event.target.value;
    saveState();
    render();
  });
  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => {
      route = button.dataset.route;
      filterOpen = false;
      render();
    });
  });

  const search = document.querySelector("[data-search]");
  search?.addEventListener("input", (event) => {
    query = event.target.value;
    const results = document.querySelector("[data-application-results]");
    if (results) {
      results.innerHTML = renderApplicationResults();
      bindApplicationCardEvents();
    }

    const savedResults = document.querySelector("[data-saved-results]");
    if (savedResults) {
      const vacancies = visibleSavedVacancies();
      savedResults.innerHTML = renderSavedRows(vacancies);
      document.querySelector(".saved-count").textContent = `${vacancies.length} companies`;
      bindSavedRowEvents();
    }
  });

  document.querySelector("[data-toggle-filters]")?.addEventListener("click", () => {
    filterOpen = !filterOpen;
    render();
  });

  document.querySelector("[data-toggle-all-filters]")?.addEventListener("click", () => {
    if (route === "saved") {
      const categories = [...new Set(state.savedVacancies.map((item) => String(item.category || "").trim()).filter(Boolean))];
      const allSelected =
        state.selectedSavedCategories === null || categories.every((category) => state.selectedSavedCategories.includes(category));
      state.selectedSavedCategories = allSelected ? [] : null;
      saveState();
      render();
      return;
    }

    const tags = [...new Set(state.applications.flatMap((item) => item.tags || []))];
    const allSelected = Object.values(state.filters).every(Boolean) && tags.every((tag) => (state.selectedTags || []).includes(tag));
    const selectAll = !allSelected;
    state.filters = Object.fromEntries(Object.keys(state.filters).map((status) => [status, selectAll]));
    state.selectedTags = selectAll ? tags : [];
    saveState();
    render();
  });

  document.querySelectorAll("[data-filter-category]").forEach((input) => {
    input.addEventListener("change", () => {
      const categories = [...new Set(state.savedVacancies.map((item) => String(item.category || "").trim()).filter(Boolean))];
      const selectedCategories =
        state.selectedSavedCategories === null ? categories : [...state.selectedSavedCategories];
      state.selectedSavedCategories = input.checked
        ? [...new Set([...selectedCategories, input.dataset.filterCategory])]
        : selectedCategories.filter((category) => category !== input.dataset.filterCategory);
      if (categories.every((category) => state.selectedSavedCategories.includes(category))) {
        state.selectedSavedCategories = null;
      }
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-filter]").forEach((input) => {
    input.addEventListener("change", () => {
      state.filters[input.dataset.filter] = input.checked;
      saveState();
      render();
    });
  });

  document.querySelector("[data-filter-favorites]")?.addEventListener("change", (event) => {
    state.favoriteOnly = event.target.checked;
    saveState();
    render();
  });

  document.querySelectorAll("[data-filter-tag]").forEach((input) => {
    input.addEventListener("change", () => {
      const tag = input.dataset.filterTag;
      state.selectedTags ||= [];
      state.selectedTags = input.checked
        ? [...new Set([...state.selectedTags, tag])]
        : state.selectedTags.filter((selectedTag) => selectedTag !== tag);
      saveState();
      render();
    });
  });

  document.querySelector("[data-sort-applications]")?.addEventListener("change", (event) => {
    state.applicationsSort = event.target.value;
    saveState();
    render();
  });

  document.querySelector("[data-back-to-applications]")?.addEventListener("click", () => {
    route = "applications";
    render();
  });

  document.querySelector("[data-save-application]")?.addEventListener("click", () => {
    const item = getSelectedApplication();
    item.updatedAt = new Date().toISOString();
    saveState();
    render();
  });

  document.querySelector("[data-delete-application]")?.addEventListener("click", () => {
    state.applications = state.applications.filter((entry) => entry.id !== selectedApplicationId);
    selectedApplicationId = state.applications[0]?.id || null;
    route = "applications";
    saveState();
    render();
  });

  document.querySelector("[data-toggle-favorite]")?.addEventListener("click", () => {
    const item = getSelectedApplication();
    item.favorite = !item.favorite;
    item.updatedAt = new Date().toISOString();
    saveState();
    render();
  });

  document.querySelector("[data-add-company]")?.addEventListener("click", () => {
    const item = {
      id: crypto.randomUUID(),
      company: "New company",
      title: "",
      status: "Applied",
      date: new Date().toISOString().slice(0, 10),
      addedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
      link: "",
      notes: "",
      files: []
    };
    state.applications.unshift(item);
    selectedApplicationId = item.id;
    route = "detail";
    saveState();
    render();
  });

  document.querySelector("[data-sort-saved]")?.addEventListener("change", (event) => {
    state.savedSort = event.target.value;
    saveState();
    render();
  });

  bindApplicationCardEvents();

  document.querySelectorAll("[data-app-field]").forEach((field) => {
    field.addEventListener("input", () => updateApplication(field));
    field.addEventListener("change", () => updateApplication(field));
  });

  document.querySelector("[data-add-tag]")?.addEventListener("click", () => {
    const input = document.querySelector("[data-new-tag]");
    const value = input.value.trim();
    if (!value) return;
    const item = getSelectedApplication();
    item.tags.push(value);
    item.updatedAt = new Date().toISOString();
    input.value = "";
    saveState();
    render();
  });

  document.querySelectorAll("[data-delete-tag]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = getSelectedApplication();
      const tagIndex = Number(button.dataset.deleteTag);
      item.tags.splice(tagIndex, 1);
      item.updatedAt = new Date().toISOString();
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-download-attachment]").forEach((button) => {
    button.addEventListener("click", async () => {
      const file = getSelectedApplication().files[Number(button.dataset.downloadAttachment)];
      if (window.attachments) await window.attachments.download(typeof file === "string" ? { name: file } : file);
    });
  });

  document.querySelector("[data-add-file]")?.addEventListener("click", async () => {
    if (window.attachments) {
      const item = getSelectedApplication();
      try {
        const files = await window.attachments.import();
        if (!files.length) return;
        item.files.push(...files);
        item.updatedAt = new Date().toISOString();
        saveState();
        render();
      } catch {
        window.alert("Could not attach the file. Please try again.");
      }
      return;
    }
    const input = document.querySelector("[data-file-input]");
    if (!input) return;
    input.value = "";
    input.click();
  });

  document.querySelector("[data-file-input]")?.addEventListener("change", (event) => {
    const item = getSelectedApplication();
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const attachments = files.map((file) => ({
      name: file.name,
      type: file.type || "application/octet-stream",
      path: file.path || "",
      size: file.size || 0
    }));

    item.files.push(...attachments);
    item.updatedAt = new Date().toISOString();
    event.target.value = "";
    saveState();
    render();
  });

  bindSavedRowEvents();

  document.querySelector("[data-open-company-link]")?.addEventListener("click", () => {
    openExternalLink(getSelectedApplication()?.link);
  });

  document.querySelector("[data-add-saved]")?.addEventListener("click", () => {
    state.savedVacancies.push({
      id: crypto.randomUUID(),
      company: "",
      link: "",
      note: "",
      category: "Manual",
      addedAt: new Date().toISOString(),
      importOrder: state.savedVacancies.length + 1
    });
    state.selectedSavedCategories = null;
    state.savedSort = "new";
    saveState();
    render();
  });

  document.querySelectorAll("[data-user-field]").forEach((field) => {
    field.addEventListener("input", () => {
      state.user[field.dataset.userField] = field.isContentEditable ? field.innerText : field.value;
      if (field.isContentEditable) state.user[field.dataset.userField + "Html"] = sanitizeRichText(field.innerHTML);
      saveState();
    });
  });

  document.querySelectorAll("[data-name-part]").forEach((field) => {
    field.addEventListener("input", () => {
      state.user.nameParts[Number(field.dataset.namePart)] = field.value;
      state.user.firstName = state.user.nameParts[0] || "";
      state.user.lastName = state.user.nameParts.slice(1).join(" ");
      document.querySelector(".hello").textContent = state.user.firstName ? `Hello, ${state.user.firstName}!` : "Hello!";
      saveState();
    });
  });

  document.querySelector("[data-add-name-part]")?.addEventListener("click", () => {
    const index = state.user.nameParts.length;
    state.user.nameParts.push("");
    saveState();
    render();
    document.querySelector(`[data-name-part="${index}"]`)?.focus();
  });

  document.querySelectorAll("[data-save-user-section]").forEach((button) => {
    button.addEventListener("click", () => {
      const section = button.dataset.saveUserSection;
      if (section === "name") {
        state.user.nameParts = Array.from(document.querySelectorAll("[data-name-part]"), (field) => field.value);
        state.user.firstName = state.user.nameParts[0] || "";
        state.user.lastName = state.user.nameParts.slice(1).join(" ");
      } else {
        const field = document.querySelector(`[data-user-field="${section}"]`);
        state.user[section] = field.isContentEditable ? field.innerText : field.value;
        if (field.isContentEditable) state.user[section + "Html"] = sanitizeRichText(field.innerHTML);
      }
      saveState();
      button.textContent = "Saved";
      window.setTimeout(() => {
        if (button.isConnected) button.textContent = "Save";
      }, 1200);
    });
  });

  document.querySelectorAll("[data-download]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.download;
      const fileName = key === "cv" ? "VJOBE-CV.pdf" : "VJOBE-Motivation-Letter.pdf";
      downloadPdf(fileName, state.user[key] || "");
    });
  });

  document.querySelectorAll("[data-month]").forEach((button) => {
    button.addEventListener("click", () => {
      const delta = Number(button.dataset.month);
      const next = new Date(state.currentYear, state.currentMonth + delta, 1);
      state.currentMonth = next.getMonth();
      state.currentYear = next.getFullYear();
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-add-event]").forEach((button) => {
    button.addEventListener("click", () => openEventModal(Number(button.dataset.addEvent)));
  });
}

function bindApplicationCardEvents() {
  document.querySelectorAll("[data-open-application]").forEach((card) => {
    card.addEventListener("click", () => {
      selectedApplicationId = card.dataset.openApplication;
      route = "detail";
      render();
    });
  });
}

function bindSavedRowEvents() {
  document.querySelectorAll("[data-saved-field]").forEach((input) => {
    input.addEventListener("input", () => {
      const row = input.closest("[data-saved-row]");
      const item = state.savedVacancies.find((entry) => entry.id === row.dataset.savedRow);
      item[input.dataset.savedField] = input.value;
      saveState();
    });
  });

  document.querySelectorAll("[data-delete-saved]").forEach((button) => {
    button.addEventListener("click", () => {
      state.savedVacancies = state.savedVacancies.filter((item) => item.id !== button.dataset.deleteSaved);
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-open-saved-link]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = state.savedVacancies.find((entry) => entry.id === button.dataset.openSavedLink);
      openExternalLink(item?.link);
    });
  });
}

function openExternalLink(value) {
  const text = String(value || "").trim();
  if (!text) return;

  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(text) ? text : `https://${text}`);
    if (url.protocol === "http:" || url.protocol === "https:") {
      window.open(url.href, "_blank");
    }
  } catch {
    return;
  }
}

function updateApplication(field) {
  const item = getSelectedApplication();
  item[field.dataset.appField] = field.isContentEditable ? field.innerText : field.value;
  if (field.isContentEditable) item[field.dataset.appField + "Html"] = sanitizeRichText(field.innerHTML);
  item.updatedAt = new Date().toISOString();
  saveState();
}

function getSelectedApplication() {
  return state.applications.find((entry) => entry.id === selectedApplicationId) || state.applications[0];
}

function openEventModal(day) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <form class="modal">
      <h2>Add event for ${day}</h2>
      ${renderEditor("", "", 'data-event-editor', "Interview, test, follow-up")}
      <div class="modal-actions">
        <button class="secondary" type="button" data-close-modal>Cancel</button>
        <button class="primary" type="submit">Save</button>
      </div>
    </form>
  `;
  document.body.appendChild(backdrop);
  bindEditors(backdrop);
  const textarea = backdrop.querySelector("[contenteditable]");
  textarea.focus();

  backdrop.querySelector("[data-close-modal]").addEventListener("click", () => backdrop.remove());
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) backdrop.remove();
  });
  backdrop.querySelector("form").addEventListener("submit", (event) => {
    event.preventDefault();
    const text = textarea.innerText.trim();
    if (text) {
      state.events.push({
        id: crypto.randomUUID(),
        day,
        month: state.currentMonth,
        year: state.currentYear,
        text,
        textHtml: sanitizeRichText(textarea.innerHTML)
      });
      saveState();
      backdrop.remove();
      render();
    }
  });
}

function downloadPdf(fileName, text) {
  const lines = String(text || "").split(/\r?\n/);
  let stream = "";
  let y = 760;

  lines.forEach((line) => {
    const safeLine = line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
    stream += `BT /F1 12 Tf 50 ${y} Td (${safeLine}) Tj ET\n`;
    y -= 18;
  });

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function renderFilterSort(saved) {
  const value = saved ? state.savedSort : state.applicationsSort;
  const options = saved
    ? [["az", "A-Z"], ["new", "New first"], ["old", "Old first"]]
    : [["az", "A-Z"], ["za", "Z-A"], ["recent", "Date: newest first"], ["oldest", "Date: oldest first"], ["new", "New added first"], ["updated", "Recently updated"]];
  return `<div class="filter-group"><label>Sort by <select class="sort-select" data-filter-sort>${options.map(([key, label]) => `<option value="${key}" ${value === key ? "selected" : ""}>${label}</option>`).join("")}</select></label></div>`;
}

function sanitizeRichText(html) {
  const template = document.createElement("template");
  template.innerHTML = String(html || "");
  const allowed = new Set(["P", "DIV", "BR", "B", "STRONG", "I", "EM", "U", "S", "UL", "OL", "LI", "BLOCKQUOTE"]);
  for (const element of Array.from(template.content.querySelectorAll("*"))) {
    if (["SCRIPT", "STYLE", "IFRAME", "OBJECT"].includes(element.tagName)) {
      element.remove();
    } else if (!allowed.has(element.tagName)) {
      element.replaceWith(...element.childNodes);
    } else {
      for (const attribute of Array.from(element.attributes)) element.removeAttribute(attribute.name);
    }
  }
  return template.innerHTML;
}

function renderEditor(html, text, attributes, label) {
  const tools = [["bold", "B", "Bold"], ["italic", "I", "Italic"], ["underline", "U", "Underline"], ["insertUnorderedList", "&#8226;", "Bulleted list"], ["insertOrderedList", "1.", "Numbered list"], ["removeFormat", "Tx", "Clear formatting"]];
  return `<div class="rich-editor"><div class="editor-toolbar" role="toolbar" aria-label="Text formatting">${tools.map(([command, icon, title]) => `<button type="button" data-editor-command="${command}" title="${title}" aria-label="${title}">${icon}</button>`).join("")}</div><div class="editor-content" contenteditable="true" role="textbox" aria-multiline="true" aria-label="${escapeAttr(label)}" data-placeholder="${escapeAttr(label)}" ${attributes}>${html ? sanitizeRichText(html) : escapeHtml(text || "").replace(/\n/g, "<br>")}</div></div>`;
}

function bindEditors(root) {
  root.querySelectorAll(".rich-editor").forEach((wrapper) => {
    const editor = wrapper.querySelector(".editor-content");
    wrapper.querySelectorAll("[data-editor-command]").forEach((button) => {
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => {
        editor.focus();
        document.execCommand(button.dataset.editorCommand, false);
        editor.dispatchEvent(new Event("input", { bubbles: true }));
      });
    });
    editor.addEventListener("paste", (event) => {
      event.preventDefault();
      const html = event.clipboardData.getData("text/html");
      if (html) document.execCommand("insertHTML", false, sanitizeRichText(html));
      else document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
    });
    editor.addEventListener("drop", (event) => event.preventDefault());
  });
}

document.addEventListener("pointerdown", (event) => {
  if (filterOpen && !event.target.closest(".filter-popover, [data-toggle-filters]")) {
    filterOpen = false;
    document.querySelector(".filter-popover")?.remove();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && filterOpen) {
    filterOpen = false;
    document.querySelector(".filter-popover")?.remove();
    document.querySelector("[data-toggle-filters]")?.focus();
  }
});

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function compareSavedVacancies(a, b) {
  if (state.savedSort === "new") {
    return getTime(b) - getTime(a) || (b.importOrder || 0) - (a.importOrder || 0);
  }

  if (state.savedSort === "old") {
    return getTime(a) - getTime(b) || (a.importOrder || 0) - (b.importOrder || 0);
  }

  return a.company.localeCompare(b.company);
}

function getTime(item) {
  const time = Date.parse(item.addedAt || "");
  return Number.isNaN(time) ? 0 : time;
}

function getApplicationAddedTime(item) {
  return getDateTime(item.addedAt || item.date);
}

function getApplicationDate(item) {
  return getDateTime(item.date);
}

function getApplicationUpdatedTime(item) {
  return getDateTime(item.updatedAt || item.addedAt || item.date);
}

function getDateTime(value) {
  const time = Date.parse(value || "");
  return Number.isNaN(time) ? 0 : time;
}

render();
