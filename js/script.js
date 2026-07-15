const STORAGE_KEY = "tarefas_saf_v1";
const CONFIG = window.TAREFAS_SAF_SUPABASE || {};
const SUPABASE_TABLE = CONFIG.table || "tarefas";
const SUPABASE_READY = Boolean(CONFIG.url && CONFIG.anonKey && window.supabase);

const db = SUPABASE_READY
    ? window.supabase.createClient(CONFIG.url, CONFIG.anonKey)
    : null;
window.tarefasSafDb = db;

const SYNC_TIMEOUT_MS = 8000;

let tasks = [];
let currentUser = null;
window.tarefasSafCurrentUser = null;
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
const calendarContextMenu = document.getElementById("calendarContextMenu");
const calendarTaskPreview = document.getElementById("calendarTaskPreview");
const authGate = document.getElementById("authGate");
const appShell = document.getElementById("appShell");
const authForm = document.getElementById("authForm");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authMessage = document.getElementById("authMessage");
const signUpButton = document.getElementById("signUpButton");
const signOutButton = document.getElementById("signOutButton");
const userIdentity = document.getElementById("userIdentity");

let calendarDate = new Date();
let selectedCalendarDate = "";
let selectedCalendarTaskId = "";
let selectedCalendarPointer = { x: 0, y: 0 };
let calendarLongPressTimer = null;
let suppressNextCalendarClick = false;

function setSyncStatus(message) {
    if (syncStatus) syncStatus.textContent = message;
}

function placeFloatingElement(element, x, y) {
    if (!element) return;

    const margin = 12;
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;

    requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect();
        const nextLeft = Math.min(Math.max(margin, x), window.innerWidth - rect.width - margin);
        const nextTop = Math.min(Math.max(margin, y), window.innerHeight - rect.height - margin);
        element.style.left = `${nextLeft}px`;
        element.style.top = `${nextTop}px`;
    });
}

function hideCalendarContextMenu() {
    calendarContextMenu?.classList.add("hidden");
}

function renderCalendarContextMenu(mode) {
    if (!calendarContextMenu) return;

    if (mode === "task") {
        calendarContextMenu.innerHTML = `
            <button type="button" data-calendar-action="edit-task" role="menuitem">
                <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 20h9"></path><path d="m16.5 3.5 4 4L8 20H4v-4L16.5 3.5z"></path></svg>
                <span>Editar tarefa</span>
            </button>
            <button type="button" data-calendar-action="delete-task" role="menuitem" class="danger-menu-item">
                <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="m19 6-1 14H6L5 6"></path><path d="M10 11v5"></path><path d="M14 11v5"></path></svg>
                <span>Excluir tarefa</span>
            </button>
        `;
        return;
    }

    calendarContextMenu.innerHTML = `
        <button type="button" data-calendar-action="new-task" role="menuitem">Nova tarefa</button>
        <button type="button" data-calendar-action="new-meeting" role="menuitem">Nova reunião</button>
    `;
}

function showCalendarContextMenu(mode, date, taskId, x, y) {
    if (!calendarContextMenu) return;

    hideCalendarTaskPreview();
    selectedCalendarDate = date;
    selectedCalendarTaskId = taskId || "";
    selectedCalendarPointer = { x, y };
    renderCalendarContextMenu(mode);
    calendarContextMenu.classList.remove("hidden");
    placeFloatingElement(calendarContextMenu, x, y);
}

function hideCalendarTaskPreview() {
    calendarTaskPreview?.classList.add("hidden");
    calendarTaskPreview?.setAttribute("aria-hidden", "true");
}

function placePreviewBesideDay(dayElement) {
    if (!calendarTaskPreview || !dayElement) return;

    const margin = 12;
    const dayRect = dayElement.getBoundingClientRect();
    calendarTaskPreview.style.left = `${dayRect.right + 8}px`;
    calendarTaskPreview.style.top = `${dayRect.top}px`;

    requestAnimationFrame(() => {
        const previewRect = calendarTaskPreview.getBoundingClientRect();
        const hasRoomRight = dayRect.right + 8 + previewRect.width <= window.innerWidth - margin;
        const left = hasRoomRight
            ? dayRect.right + 8
            : Math.max(margin, dayRect.left - previewRect.width - 8);
        const top = Math.min(
            Math.max(margin, dayRect.top),
            window.innerHeight - previewRect.height - margin
        );

        calendarTaskPreview.style.left = `${left}px`;
        calendarTaskPreview.style.top = `${top}px`;
    });
}

function showCalendarTaskPreview(taskId, dayElement) {
    if (!calendarTaskPreview) return;

    const task = tasks.find(item => item.id === taskId);
    if (!task) return;

    const priority = normalizePriority(task.priority);
    calendarTaskPreview.className = `calendar-task-preview ${priorityClass(priority)} ${task.done ? "done" : ""}`;
    calendarTaskPreview.innerHTML = `
        <h3>${escapeHTML(task.name)}</h3>
        ${task.description ? `<p>${escapeHTML(task.description)}</p>` : ""}
        <div class="calendar-preview-meta">
            <span>${escapeHTML(priority)}</span>
            <span>Fazer em: ${formatDate(task.date)}</span>
            <span>${task.done ? "Concluída" : "Pendente"}</span>
            ${task.requestedBy ? `<span>Solicitante: ${escapeHTML(task.requestedBy)}</span>` : ""}
            ${task.reminderDay ? `<span>Lembrete: ${escapeHTML(task.reminderDay)}</span>` : ""}
        </div>
    `;
    calendarTaskPreview.classList.remove("hidden");
    calendarTaskPreview.setAttribute("aria-hidden", "false");
    placePreviewBesideDay(dayElement);
}

function setAuthMessage(message, isError = false) {
    if (!authMessage) return;
    authMessage.textContent = message;
    authMessage.classList.toggle("error", isError);
}

function setSignedInState(user) {
    currentUser = user || null;
    window.tarefasSafCurrentUser = currentUser;

    authGate?.classList.toggle("hidden", Boolean(currentUser));
    appShell?.classList.toggle("hidden", !currentUser && SUPABASE_READY);
    signOutButton?.classList.toggle("hidden", !currentUser);
    userIdentity?.classList.toggle("hidden", !currentUser);
    document.querySelectorAll(".requires-auth").forEach(element => {
        element.classList.toggle("hidden", !currentUser);
    });

    if (userIdentity && currentUser) {
        userIdentity.textContent = currentUser.email || "Usuário conectado";
    }
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
        user_id: currentUser?.id,
        name: task.name,
        description: task.description || "",
        requested_by: task.requestedBy || "",
        priority: normalizePriority(task.priority),
        date: task.date,
        reminder_day: task.reminderDay || "",
        done: Boolean(task.done),
        completed_at: task.completedAt || null,
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
        completedAt: task.completed_at || "",
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
        setSignedInState({ email: "Modo local" });
        tasks = getLocalTasks();
        setSyncStatus("Salvando neste navegador");
        render();
        return;
    }

    if (!currentUser) {
        tasks = [];
        setSyncStatus("Entre para sincronizar");
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
                .eq("user_id", currentUser.id)
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

    if (!SUPABASE_READY || !currentUser) return;

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

    if (!currentUser) {
        setSyncStatus("Entre para salvar na nuvem");
        return false;
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

async function saveTaskDate(id, date) {
    if (!SUPABASE_READY) {
        saveLocalTasks();
        setSyncStatus("Salvando neste navegador");
        return true;
    }

    if (!currentUser) {
        setSyncStatus("Entre para salvar na nuvem");
        return false;
    }

    let result;
    try {
        result = await withTimeout(
            db
                .from(SUPABASE_TABLE)
                .update({
                    date,
                    updated_at: new Date().toISOString()
                })
                .eq("id", id)
                .eq("user_id", currentUser.id)
        );
    } catch (error) {
        console.error(error);
        setSyncStatus("Erro ao programar tarefa na nuvem");
        return false;
    }

    const { error } = result;
    if (error) {
        console.error(error);
        setSyncStatus("Erro ao programar tarefa na nuvem");
        return false;
    }

    setSyncStatus("Tarefa programada para hoje");
    render();
    return true;
}

async function removeTask(id) {
    if (!SUPABASE_READY) {
        saveLocalTasks();
        setSyncStatus("Salvando neste navegador");
        return true;
    }

    if (!currentUser) {
        setSyncStatus("Entre para excluir na nuvem");
        return false;
    }

    let result;
    try {
        result = await withTimeout(
            db
                .from(SUPABASE_TABLE)
                .delete()
                .eq("id", id)
                .eq("user_id", currentUser.id)
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

function isRoutineTask(task) {
    return normalizePriority(task.priority) === "Rotineira";
}

function shouldCarryTaskToToday(task, isoDate) {
    const today = toISODate(new Date());
    return !task.done && isoDate === today && task.date < today;
}

function shouldShowTaskOnCalendarDay(task, isoDate) {
    if (!isRoutineTask(task)) {
        return task.date === isoDate || shouldCarryTaskToToday(task, isoDate);
    }

    if (!task.date || isoDate < task.date) return false;
    if (!task.done) return true;

    return Boolean(task.completedAt) && isoDate < task.completedAt;
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
        <span>Fazer em: ${formatDate(task.date)}</span>
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
        <button class="small-btn icon-action" onclick="editTask('${task.id}', event)" title="Editar" aria-label="Editar tarefa">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 20h9"></path><path d="m16.5 3.5 4 4L8 20H4v-4L16.5 3.5z"></path></svg>
          <span>Editar</span>
        </button>
        <button class="small-btn icon-action schedule-today" type="button" data-action="schedule-today" data-task-id="${task.id}" title="Fazer hoje" aria-label="Programar tarefa para hoje">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 2v4"></path><path d="M16 2v4"></path><path d="M3 10h18"></path><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M8 15h5"></path></svg>
          <span>Fazer hoje</span>
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
            .filter(task => shouldShowTaskOnCalendarDay(task, isoDate))
            .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
        const isCurrentMonth = date.getMonth() === month;
        const isToday = isoDate === today;

        return `
            <button class="calendar-day ${isCurrentMonth ? "" : "muted-day"} ${isToday ? "today" : ""}" type="button" data-date="${isoDate}" aria-label="Adicionar tarefa em ${formatDate(isoDate)}">
                <span class="calendar-date">${date.getDate()}</span>
                <span class="calendar-items">
                    ${dayTasks.map(task => `
                        <span class="calendar-task ${priorityClass(task.priority)} ${task.done ? "done" : ""}" data-task-id="${task.id}" title="${escapeHTML(task.name)}" tabindex="0">
                            ${escapeHTML(task.name)}
                        </span>
                    `).join("")}
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
    formPanel.classList.remove("floating-popover");
    formPanel.style.left = "";
    formPanel.style.top = "";
    formPanel.classList.add("active");
    nameInput.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function openFormPopover(x, y) {
    formPanel.classList.add("active", "floating-popover");
    placeFloatingElement(formPanel, x, y);
    nameInput.focus();
}

function closeForm() {
    formPanel.classList.remove("active", "floating-popover");
    formPanel.style.left = "";
    formPanel.style.top = "";
    resetForm();
}

taskForm.addEventListener("submit", async event => {
    event.preventDefault();

    const submitButton = taskForm.querySelector("button[type='submit']");
    const originalSubmitText = submitButton?.textContent || "Salvar";
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Salvando...";
    }

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
        completedAt: taskId.value ? tasks.find(t => t.id === taskId.value)?.completedAt || "" : "",
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

    if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalSubmitText;
    }
});

window.toggleDone = async function (id) {
    const previousTasks = [...tasks];
    const updatedTask = tasks.find(task => task.id === id);
    if (!updatedTask) return;

    const willBeDone = !updatedTask.done;
    const nextTask = {
        ...updatedTask,
        done: willBeDone,
        completedAt: willBeDone ? toISODate(new Date()) : ""
    };
    tasks = tasks.map(task => task.id === id ? nextTask : task);
    render();
    setSyncStatus("Salvando...");

    const saved = await saveTask(nextTask);
    if (!saved) {
        tasks = previousTasks;
        render();
    }
}

async function toggleTaskFromCalendar(id) {
    const task = tasks.find(item => item.id === id);
    if (!task) return;

    await toggleDone(id);
}

window.scheduleTaskToday = async function (id) {
    const task = tasks.find(item => item.id === id);
    if (!task) return;

    const today = toISODate(new Date());
    if (task.date === today) {
        calendarDate = new Date();
        render();
        setSyncStatus("Essa tarefa já está marcada para hoje");
        return;
    }

    const nextTask = { ...task, date: today };
    tasks = tasks.map(item => item.id === id ? nextTask : item);
    calendarDate = new Date();
    render();
    setSyncStatus("Programando para hoje...");

    const saved = await saveTaskDate(id, today);
    if (!saved) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
        setSyncStatus("Programado localmente. Nuvem indisponível.");
        render();
    }
}

window.editTask = function (id, sourceEvent) {
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
    window.closeMeetingPopover?.();

    if (sourceEvent?.clientX && sourceEvent?.clientY) {
        openFormPopover(sourceEvent.clientX, sourceEvent.clientY);
        return;
    }

    const activeElementRect = document.activeElement?.getBoundingClientRect?.();
    if (activeElementRect) {
        openFormPopover(activeElementRect.left, activeElementRect.bottom + 6);
        return;
    }

    openFormPopover(window.innerWidth / 2 - 220, 96);
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

taskList.addEventListener("click", event => {
    const button = event.target.closest("[data-action='schedule-today']");
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    scheduleTaskToday(button.dataset.taskId);
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

authForm?.addEventListener("submit", async event => {
    event.preventDefault();

    if (!SUPABASE_READY) {
        setAuthMessage("Supabase não está configurado. O app vai usar modo local.", true);
        loadTasks();
        return;
    }

    setAuthMessage("Entrando...");
    const { data, error } = await db.auth.signInWithPassword({
        email: authEmail.value.trim(),
        password: authPassword.value
    });

    if (error) {
        setAuthMessage(error.message || "Não foi possível entrar.", true);
        return;
    }

    setSignedInState(data.user);
    setAuthMessage("");
    await loadTasks();
    window.loadMeetings?.();
});

signUpButton?.addEventListener("click", async () => {
    if (!SUPABASE_READY) {
        setAuthMessage("Supabase não está configurado.", true);
        return;
    }

    setAuthMessage("Criando conta...");
    const { data, error } = await db.auth.signUp({
        email: authEmail.value.trim(),
        password: authPassword.value
    });

    if (error) {
        setAuthMessage(error.message || "Não foi possível criar a conta.", true);
        return;
    }

    if (data.session) {
        setSignedInState(data.user);
        setAuthMessage("");
        await loadTasks();
        window.loadMeetings?.();
        return;
    }

    setAuthMessage("Conta criada. Se o Supabase pedir confirmação, verifique seu e-mail antes de entrar.");
});

signOutButton?.addEventListener("click", async () => {
    if (SUPABASE_READY) {
        await db.auth.signOut();
    }

    tasks = [];
    setSignedInState(null);
    render();
    window.clearMeetingsForSignedOutUser?.();
    setSyncStatus("Sessão encerrada");
});

monthCalendar?.addEventListener("pointerdown", event => {
    if (event.pointerType !== "touch") return;

    window.clearTimeout(calendarLongPressTimer);
    calendarLongPressTimer = window.setTimeout(() => {
        const taskItem = event.target.closest(".calendar-task");
        if (taskItem?.dataset.taskId) {
            const day = taskItem.closest(".calendar-day");
            suppressNextCalendarClick = true;
            showCalendarContextMenu("task", day?.dataset.date || "", taskItem.dataset.taskId, event.clientX, event.clientY);
            return;
        }

        const day = event.target.closest(".calendar-day");
        if (day?.dataset.date) {
            suppressNextCalendarClick = true;
            showCalendarContextMenu("day", day.dataset.date, "", event.clientX, event.clientY);
        }
    }, 550);
});

["pointerup", "pointercancel", "pointerleave"].forEach(eventName => {
    monthCalendar?.addEventListener(eventName, () => {
        window.clearTimeout(calendarLongPressTimer);
    });
});

monthCalendar?.addEventListener("click", event => {
    if (suppressNextCalendarClick) {
        event.preventDefault();
        event.stopPropagation();
        suppressNextCalendarClick = false;
        return;
    }

    const taskItem = event.target.closest(".calendar-task");
    if (taskItem?.dataset.taskId) {
        event.stopPropagation();
        event.preventDefault();
        hideCalendarContextMenu();
        hideCalendarTaskPreview();
        toggleTaskFromCalendar(taskItem.dataset.taskId);
        return;
    }

    hideCalendarContextMenu();
});

monthCalendar?.addEventListener("contextmenu", event => {
    const taskItem = event.target.closest(".calendar-task");
    if (taskItem?.dataset.taskId) {
        event.preventDefault();
        event.stopPropagation();
        const day = taskItem.closest(".calendar-day");
        showCalendarContextMenu("task", day?.dataset.date || "", taskItem.dataset.taskId, event.clientX, event.clientY);
        return;
    }

    const day = event.target.closest(".calendar-day");
    if (!day?.dataset.date) return;

    event.preventDefault();
    showCalendarContextMenu("day", day.dataset.date, "", event.clientX, event.clientY);
});

monthCalendar?.addEventListener("mouseover", event => {
    const taskItem = event.target.closest(".calendar-task");
    if (!taskItem?.dataset.taskId) return;

    showCalendarTaskPreview(
        taskItem.dataset.taskId,
        taskItem.closest(".calendar-day")
    );
});

monthCalendar?.addEventListener("focusin", event => {
    const taskItem = event.target.closest(".calendar-task");
    if (!taskItem?.dataset.taskId) return;

    showCalendarTaskPreview(
        taskItem.dataset.taskId,
        taskItem.closest(".calendar-day")
    );
});

monthCalendar?.addEventListener("mouseout", event => {
    const taskItem = event.target.closest(".calendar-task");
    if (!taskItem || taskItem.contains(event.relatedTarget)) return;
    hideCalendarTaskPreview();
});

monthCalendar?.addEventListener("focusout", event => {
    if (event.target.closest(".calendar-task")) {
        hideCalendarTaskPreview();
    }
});

calendarContextMenu?.addEventListener("click", event => {
    const button = event.target.closest("[data-calendar-action]");
    if (!button) return;

    const { x, y } = selectedCalendarPointer;
    const date = selectedCalendarDate || toISODate(new Date());
    const taskId = selectedCalendarTaskId;
    hideCalendarContextMenu();

    if (button.dataset.calendarAction === "edit-task") {
        editTask(taskId, { clientX: x, clientY: y });
        return;
    }

    if (button.dataset.calendarAction === "delete-task") {
        deleteTask(taskId);
        return;
    }

    if (button.dataset.calendarAction === "new-task") {
        closeForm();
        window.closeMeetingPopover?.();
        window.showTab?.("tasksTab");
        resetForm();
        dateInput.value = date;
        document.getElementById("formTitle").textContent = "Nova tarefa";
        openFormPopover(x, y);
        return;
    }

    if (button.dataset.calendarAction === "new-meeting") {
        closeForm();
        window.openMeetingFormPopover?.(date, x, y);
    }
});

document.addEventListener("click", event => {
    if (event.target.closest("#calendarContextMenu")) return;
    hideCalendarContextMenu();
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        hideCalendarContextMenu();
        hideCalendarTaskPreview();
    }
});

window.addEventListener("scroll", () => {
    hideCalendarContextMenu();
    hideCalendarTaskPreview();
}, true);

window.openTaskFormPopover = function (date, x, y) {
    resetForm();
    dateInput.value = date;
    document.getElementById("formTitle").textContent = "Nova tarefa";
    openFormPopover(x, y);
};

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

async function initializeAuth() {
    if (!SUPABASE_READY) {
        await loadTasks();
        return;
    }

    const { data } = await db.auth.getSession();
    setSignedInState(data.session?.user || null);

    db.auth.onAuthStateChange((_event, session) => {
        setSignedInState(session?.user || null);
    });

    if (data.session?.user) {
        await loadTasks();
    } else {
        setSyncStatus("Entre para sincronizar");
        render();
    }
}

initializeAuth();


