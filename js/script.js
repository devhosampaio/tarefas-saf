const STORAGE_KEY = "tarefas_saf_v1";
const CONFIG = window.TAREFAS_SAF_SUPABASE || {};
const SUPABASE_TABLE = CONFIG.table || "tarefas";
const SUPABASE_READY = Boolean(CONFIG.url && CONFIG.anonKey && window.supabase);

const db = SUPABASE_READY
    ? window.supabase.createClient(CONFIG.url, CONFIG.anonKey)
    : null;

const SYNC_TIMEOUT_MS = 8000;

let tasks = [];
let currentFilter = "pendentes";
let advancedFilters = {
    query: "",
    date: "",
    priority: "",
    requestedBy: ""
};

const PRIORITY_ORDER = {
    "Alta": 0,
    "M\u00e9dia": 1,
    "Baixa": 2,
    "Rotineira": 3
};

const formPanel = document.getElementById("formPanel");
const taskForm = document.getElementById("taskForm");
const taskList = document.getElementById("taskList");

const taskId = document.getElementById("taskId");
const nameInput = document.getElementById("name");
const descInput = document.getElementById("description");
const requestedByInput = document.getElementById("requestedBy");
const priorityInput = document.getElementById("priority");
const dateInput = document.getElementById("date");
const reminderDayInput = document.getElementById("reminderDay");
const syncStatus = document.getElementById("syncStatus");
const filterPanel = document.getElementById("filterPanel");
const filterDateInput = document.getElementById("filterDate");
const filterPriorityInput = document.getElementById("filterPriority");
const filterRequestedByInput = document.getElementById("filterRequestedBy");
const taskSearchInput = document.getElementById("taskSearchInput");
const themeToggle = document.getElementById("themeToggle");
const openFiltersButton = document.getElementById("openFilters");
const filterCount = document.getElementById("filterCount");
const monthCalendar = document.getElementById("monthCalendar");
const calendarTitle = document.getElementById("calendarTitle");
const prevMonthButton = document.getElementById("prevMonth");
const nextMonthButton = document.getElementById("nextMonth");
const todayMonthButton = document.getElementById("todayMonth");

let calendarDate = new Date();

function setSyncStatus(message) {
    if (syncStatus) syncStatus.textContent = message;
}

function saveLocalTasks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    render();
}

function getLocalTasks() {
    return (JSON.parse(localStorage.getItem(STORAGE_KEY)) || []).map(task => ({
        ...task,
        priority: normalizePriority(task.priority)
    }));
}

function toDatabaseTask(task) {
    return {
        id: task.id,
        name: task.name,
        description: task.description || "",
        requested_by: task.requestedBy || "",
        priority: normalizePriority(task.priority),
        date: task.date,
        reminder_day: task.reminderDay || "",
        done: Boolean(task.done),
        created_at: task.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
}

function fromDatabaseTask(task) {
    return {
        id: task.id,
        name: task.name,
        description: task.description || "",
        requestedBy: task.requested_by || "",
        priority: normalizePriority(task.priority),
        date: task.date,
        reminderDay: task.reminder_day || "",
        done: Boolean(task.done),
        createdAt: task.created_at
    };
}

function normalizePriority(priority) {
    if (priority === "MÃ©dia") return "M\u00e9dia";
    if (priority === "ContÃ­nua" || priority === "Cont\u00ednua" || priority === "Contínua") return "Rotineira";
    return priority || "M\u00e9dia";
}

function withTimeout(promise, message = "Tempo limite de sincronização") {
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error(message)), SYNC_TIMEOUT_MS);
        })
    ]);
}

async function loadTasks() {
    if (!SUPABASE_READY) {
        tasks = getLocalTasks();
        setSyncStatus("Salvando neste navegador");
        render();
        return;
    }

    setSyncStatus("Sincronizando com Supabase...");
    tasks = getLocalTasks();
    render();

    let result;
    try {
        result = await withTimeout(
            db
                .from(SUPABASE_TABLE)
                .select("*")
                .order("date", { ascending: true })
        );
    } catch (error) {
        console.error(error);
        setSyncStatus("Nuvem indisponível. Usando dados locais.");
        render();
        return;
    }

    const { data, error } = result;
    if (error) {
        console.error(error);
        tasks = getLocalTasks();
        setSyncStatus("Falha na nuvem. Usando dados locais.");
        render();
        return;
    }

    tasks = data.map(fromDatabaseTask);
    await migrateLocalTasks();
    setSyncStatus("Sincronizado na nuvem");
    render();
}

async function migrateLocalTasks() {
    const localTasks = getLocalTasks();
    const missingTasks = localTasks.filter(localTask => !tasks.some(task => task.id === localTask.id));

    if (!SUPABASE_READY) return;

    if (missingTasks.length === 0) {
        localStorage.removeItem(STORAGE_KEY);
        return;
    }

    let result;
    try {
        result = await withTimeout(
            db
                .from(SUPABASE_TABLE)
                .upsert(missingTasks.map(toDatabaseTask))
                .select("*")
        );
    } catch (error) {
        console.error(error);
        setSyncStatus("Nuvem ativa. Migração local demorou demais.");
        return;
    }

    const { data, error } = result;
    if (error) {
        console.error(error);
        setSyncStatus("Nuvem ativa. Migração local falhou.");
        return;
    }

    const migratedTasks = data.map(fromDatabaseTask);
    tasks = [
        ...tasks,
        ...migratedTasks.filter(migratedTask => !tasks.some(task => task.id === migratedTask.id))
    ];
    localStorage.removeItem(STORAGE_KEY);
}

async function saveTask(task) {
    if (!SUPABASE_READY) {
        saveLocalTasks();
        setSyncStatus("Salvando neste navegador");
        return true;
    }

    let result;
    try {
        result = await withTimeout(
            db
                .from(SUPABASE_TABLE)
                .upsert(toDatabaseTask(task))
        );
    } catch (error) {
        console.error(error);
        setSyncStatus("Erro ao salvar na nuvem");
        return false;
    }

    const { error } = result;
    if (error) {
        console.error(error);
        setSyncStatus("Erro ao salvar na nuvem");
        return false;
    }

    setSyncStatus("Sincronizado na nuvem");
    render();
    return true;
}

async function removeTask(id) {
    if (!SUPABASE_READY) {
        saveLocalTasks();
        setSyncStatus("Salvando neste navegador");
        return true;
    }

    let result;
    try {
        result = await withTimeout(
            db
                .from(SUPABASE_TABLE)
                .delete()
                .eq("id", id)
        );
    } catch (error) {
        console.error(error);
        setSyncStatus("Erro ao excluir na nuvem");
        return false;
    }

    const { error } = result;
    if (error) {
        console.error(error);
        setSyncStatus("Erro ao excluir na nuvem");
        return false;
    }

    setSyncStatus("Sincronizado na nuvem");
    render();
    return true;
}

function formatDate(value) {
    if (!value) return "Sem data";
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
}

function toISODate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatMonthTitle(date) {
    return new Intl.DateTimeFormat("pt-BR", {
        month: "long",
        year: "numeric"
    }).format(date);
}

function priorityClass(priority) {
    priority = normalizePriority(priority);
    if (priority === "Alta") return "priority-high";
    if (priority === "Baixa") return "priority-low";
    if (priority === "Rotineira") return "priority-routine";
    return "priority-medium";
}

function priorityRank(priority) {
    priority = normalizePriority(priority);
    return PRIORITY_ORDER[priority] ?? 4;
}

function normalizeSearchText(value) {
    return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function applyTheme(theme) {
    document.body.classList.toggle("dark-mode", theme === "dark");
    themeToggle?.setAttribute("aria-pressed", String(theme === "dark"));
    themeToggle?.setAttribute("title", theme === "dark" ? "Modo claro" : "Modo noturno");
}

function toggleTheme() {
    const nextTheme = document.body.classList.contains("dark-mode") ? "light" : "dark";
    localStorage.setItem("tarefas_saf_theme", nextTheme);
    applyTheme(nextTheme);
}

function activeFiltersCount() {
    return Object.values(advancedFilters).filter(Boolean).length;
}

function updateFilterButton() {
    const count = activeFiltersCount();
    const isOpen = !filterPanel.classList.contains("hidden");

    openFiltersButton.classList.toggle("is-open", isOpen);
    openFiltersButton.classList.toggle("has-filters", count > 0);
    openFiltersButton.setAttribute("aria-expanded", String(isOpen));

    filterCount.textContent = count;
    filterCount.classList.toggle("hidden", count === 0);
}

function getFilteredTasks() {
    let filtered = [...tasks];

    if (currentFilter === "pendentes") filtered = filtered.filter(t => !t.done);
    if (currentFilter === "concluidas") filtered = filtered.filter(t => t.done);

    if (advancedFilters.query) {
        const query = normalizeSearchText(advancedFilters.query);
        filtered = filtered.filter(task => {
            const searchable = normalizeSearchText([
                task.name,
                task.description,
                task.requestedBy,
                normalizePriority(task.priority),
                task.date,
                task.reminderDay,
                task.done ? "concluida concluída" : "pendente"
            ].join(" "));

            return searchable.includes(query);
        });
    }

    if (advancedFilters.date) {
        filtered = filtered.filter(t => t.date === advancedFilters.date);
    }

    if (advancedFilters.priority) {
        filtered = filtered.filter(t => normalizePriority(t.priority) === advancedFilters.priority);
    }

    if (advancedFilters.requestedBy) {
        const requester = advancedFilters.requestedBy.toLowerCase();
        filtered = filtered.filter(t => (t.requestedBy || "").toLowerCase().includes(requester));
    }

    return filtered.sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        if (priorityRank(a.priority) !== priorityRank(b.priority)) {
            return priorityRank(a.priority) - priorityRank(b.priority);
        }
        return new Date(a.date) - new Date(b.date);
    });
}

function renderStats() {
    document.getElementById("totalTasks").textContent = tasks.length;
    document.getElementById("pendingTasks").textContent = tasks.filter(t => !t.done).length;
    document.getElementById("doneTasks").textContent = tasks.filter(t => t.done).length;
}

function renderTasks() {
    const filtered = getFilteredTasks();

    if (filtered.length === 0) {
        taskList.innerHTML = `<div class="empty">Nenhuma tarefa encontrada.</div>`;
        return;
    }

    taskList.innerHTML = filtered.map(task => `
    <article class="task ${priorityClass(task.priority)} ${task.done ? "done" : ""}">
      <div class="task-head">
        <h2>${escapeHTML(task.name)}</h2>
        <span class="badge ${priorityClass(task.priority)}">${normalizePriority(task.priority)}</span>
      </div>

      ${task.description ? `<p>${escapeHTML(task.description)}</p>` : ""}

      <div class="meta">
        <span>Data: ${formatDate(task.date)}</span>
        <span>Solicitante: ${escapeHTML(task.requestedBy || "Não informado")}</span>
        ${task.reminderDay ? `<span>Lembrete: ${escapeHTML(task.reminderDay)}</span>` : ""}
      </div>

      <div class="task-actions">
        <button class="small-btn icon-action" onclick="toggleDone('${task.id}')" title="${task.done ? "Reabrir" : "Concluir"}" aria-label="${task.done ? "Reabrir tarefa" : "Concluir tarefa"}">
          ${task.done
            ? `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 15.5-6.2"></path><path d="M18.5 2v4h-4"></path><path d="M21 12a9 9 0 0 1-15.5 6.2"></path><path d="M5.5 22v-4h4"></path></svg>`
            : `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"></path></svg>`}
          <span>${task.done ? "Reabrir" : "Concluir"}</span>
        </button>
        <button class="small-btn icon-action" onclick="editTask('${task.id}')" title="Editar" aria-label="Editar tarefa">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 20h9"></path><path d="m16.5 3.5 4 4L8 20H4v-4L16.5 3.5z"></path></svg>
          <span>Editar</span>
        </button>
        <button class="small-btn delete icon-only" onclick="deleteTask('${task.id}')" title="Excluir" aria-label="Excluir tarefa">×</button>
      </div>
    </article>
  `).join("");
}

function render() {
    renderStats();
    renderCalendar();
    renderTasks();
}

function renderCalendar() {
    if (!monthCalendar || !calendarTitle) return;

    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const gridStart = new Date(firstDay);
    gridStart.setDate(firstDay.getDate() - firstDay.getDay());
    const today = toISODate(new Date());

    calendarTitle.textContent = formatMonthTitle(calendarDate);

    const days = Array.from({ length: 42 }, (_, index) => {
        const date = new Date(gridStart);
        date.setDate(gridStart.getDate() + index);
        return date;
    });

    monthCalendar.innerHTML = days.map(date => {
        const isoDate = toISODate(date);
        const dayTasks = tasks
            .filter(task => task.date === isoDate)
            .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
        const isCurrentMonth = date.getMonth() === month;
        const isToday = isoDate === today;

        return `
            <button class="calendar-day ${isCurrentMonth ? "" : "muted-day"} ${isToday ? "today" : ""}" type="button" data-date="${isoDate}" aria-label="Adicionar tarefa em ${formatDate(isoDate)}">
                <span class="calendar-date">${date.getDate()}</span>
                <span class="calendar-items">
                    ${dayTasks.slice(0, 4).map(task => `
                        <span class="calendar-task ${priorityClass(task.priority)} ${task.done ? "done" : ""}" data-task-id="${task.id}" title="${escapeHTML(task.name)}">
                            ${escapeHTML(task.name)}
                        </span>
                    `).join("")}
                    ${dayTasks.length > 4 ? `<span class="calendar-more">+${dayTasks.length - 4} tarefas</span>` : ""}
                </span>
            </button>
        `;
    }).join("");
}

function resetForm() {
    taskId.value = "";
    nameInput.value = "";
    descInput.value = "";
    requestedByInput.value = "";
    priorityInput.value = "Média";
    dateInput.value = new Date().toISOString().split("T")[0];
    reminderDayInput.value = "";
    document.getElementById("formTitle").textContent = "Nova tarefa";
}

function openForm() {
    formPanel.classList.add("active");
    nameInput.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function closeForm() {
    formPanel.classList.remove("active");
    resetForm();
}

taskForm.addEventListener("submit", async event => {
    event.preventDefault();

    const previousTasks = [...tasks];
    const data = {
        id: taskId.value || crypto.randomUUID(),
        name: nameInput.value.trim(),
        description: descInput.value.trim(),
        requestedBy: requestedByInput.value.trim(),
        priority: priorityInput.value,
        date: dateInput.value,
        reminderDay: reminderDayInput.value,
        done: taskId.value ? tasks.find(t => t.id === taskId.value)?.done || false : false,
        createdAt: taskId.value ? tasks.find(t => t.id === taskId.value)?.createdAt : new Date().toISOString()
    };

    if (taskId.value) {
        tasks = tasks.map(task => task.id === taskId.value ? data : task);
    } else {
        tasks.push(data);
    }

    render();
    setSyncStatus("Salvando...");

    const saved = await saveTask(data);
    if (saved) {
        closeForm();
    } else {
        tasks = previousTasks;
        render();
    }
});

window.toggleDone = async function (id) {
    const previousTasks = [...tasks];
    const updatedTask = tasks.find(task => task.id === id);
    if (!updatedTask) return;

    const nextTask = { ...updatedTask, done: !updatedTask.done };
    tasks = tasks.map(task => task.id === id ? nextTask : task);
    render();
    setSyncStatus("Salvando...");

    const saved = await saveTask(nextTask);
    if (!saved) {
        tasks = previousTasks;
        render();
    }
}

window.editTask = function (id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    taskId.value = task.id;
    nameInput.value = task.name;
    descInput.value = task.description;
    requestedByInput.value = task.requestedBy;
    priorityInput.value = normalizePriority(task.priority);
    dateInput.value = task.date;
    reminderDayInput.value = task.reminderDay || "";

    document.getElementById("formTitle").textContent = "Editar tarefa";
    openForm();
}

window.deleteTask = async function (id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (confirm(`Excluir a tarefa "${task.name}"?`)) {
        const previousTasks = [...tasks];
        tasks = tasks.filter(task => task.id !== id);
        render();
        setSyncStatus("Excluindo...");

        const removed = await removeTask(id);
        if (!removed) {
            tasks = previousTasks;
            render();
        }
    }
}

function escapeHTML(text) {
    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

document.getElementById("openForm").addEventListener("click", () => {
    resetForm();
    openForm();
});

document.getElementById("cancelForm").addEventListener("click", closeForm);

document.querySelectorAll(".chip[data-filter]").forEach(chip => {
    chip.addEventListener("click", () => {
        document.querySelectorAll(".chip[data-filter]").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        currentFilter = chip.dataset.filter;
        renderTasks();
    });
});

openFiltersButton.addEventListener("click", () => {
    filterPanel.classList.toggle("hidden");
    updateFilterButton();
});

document.getElementById("applyFilters").addEventListener("click", () => {
    advancedFilters = {
        ...advancedFilters,
        date: filterDateInput.value,
        priority: filterPriorityInput.value,
        requestedBy: filterRequestedByInput.value.trim()
    };
    filterPanel.classList.add("hidden");
    updateFilterButton();
    renderTasks();
});

document.getElementById("clearFilters").addEventListener("click", () => {
    advancedFilters = {
        query: "",
        date: "",
        priority: "",
        requestedBy: ""
    };
    taskSearchInput.value = "";
    filterDateInput.value = "";
    filterPriorityInput.value = "";
    filterRequestedByInput.value = "";
    filterPanel.classList.add("hidden");
    updateFilterButton();
    renderTasks();
});

taskSearchInput.addEventListener("input", () => {
    advancedFilters.query = taskSearchInput.value.trim();
    updateFilterButton();
    renderTasks();
});

themeToggle?.addEventListener("click", toggleTheme);

monthCalendar?.addEventListener("click", event => {
    const taskItem = event.target.closest(".calendar-task");
    if (taskItem?.dataset.taskId) {
        event.stopPropagation();
        editTask(taskItem.dataset.taskId);
        return;
    }

    const day = event.target.closest(".calendar-day");
    if (!day?.dataset.date) return;

    resetForm();
    dateInput.value = day.dataset.date;
    document.getElementById("formTitle").textContent = "Nova tarefa";
    openForm();
});

prevMonthButton?.addEventListener("click", () => {
    calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
    renderCalendar();
});

nextMonthButton?.addEventListener("click", () => {
    calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
    renderCalendar();
});

todayMonthButton?.addEventListener("click", () => {
    calendarDate = new Date();
    renderCalendar();
});

applyTheme(localStorage.getItem("tarefas_saf_theme") || "light");
resetForm();
updateFilterButton();
loadTasks();


