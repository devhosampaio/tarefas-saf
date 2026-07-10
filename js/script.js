const STORAGE_KEY = "tarefas_saf_v1";
const CONFIG = window.TAREFAS_SAF_SUPABASE || {};
const SUPABASE_TABLE = CONFIG.table || "tarefas";
const SUPABASE_READY = Boolean(CONFIG.url && CONFIG.anonKey && window.supabase);

const db = SUPABASE_READY
    ? window.supabase.createClient(CONFIG.url, CONFIG.anonKey)
    : null;

const SYNC_TIMEOUT_MS = 8000;

let tasks = [];
let currentFilter = "todas";
let advancedFilters = {
    date: "",
    priority: "",
    requestedBy: ""
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
const syncStatus = document.getElementById("syncStatus");
const filterPanel = document.getElementById("filterPanel");
const filterDateInput = document.getElementById("filterDate");
const filterPriorityInput = document.getElementById("filterPriority");
const filterRequestedByInput = document.getElementById("filterRequestedBy");
const openFiltersButton = document.getElementById("openFilters");
const filterCount = document.getElementById("filterCount");

function setSyncStatus(message) {
    if (syncStatus) syncStatus.textContent = message;
}

function saveLocalTasks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    render();
}

function getLocalTasks() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
}

function toDatabaseTask(task) {
    return {
        id: task.id,
        name: task.name,
        description: task.description || "",
        requested_by: task.requestedBy || "",
        priority: task.priority,
        date: task.date,
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
        priority: task.priority,
        date: task.date,
        done: Boolean(task.done),
        createdAt: task.created_at
    };
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

function priorityClass(priority) {
    if (priority === "Alta") return "priority-high";
    if (priority === "Baixa") return "priority-low";
    return "priority-medium";
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

    if (advancedFilters.date) {
        filtered = filtered.filter(t => t.date === advancedFilters.date);
    }

    if (advancedFilters.priority) {
        filtered = filtered.filter(t => t.priority === advancedFilters.priority);
    }

    if (advancedFilters.requestedBy) {
        const requester = advancedFilters.requestedBy.toLowerCase();
        filtered = filtered.filter(t => (t.requestedBy || "").toLowerCase().includes(requester));
    }

    return filtered.sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
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
        <span class="badge ${priorityClass(task.priority)}">${task.priority}</span>
      </div>

      ${task.description ? `<p>${escapeHTML(task.description)}</p>` : ""}

      <div class="meta">
        <span>Data: ${formatDate(task.date)}</span>
        <span>Solicitante: ${escapeHTML(task.requestedBy || "Não informado")}</span>
      </div>

      <div class="task-actions">
        <button class="small-btn" onclick="toggleDone('${task.id}')">
          ${task.done ? "Reabrir" : "Concluir"}
        </button>
        <button class="small-btn" onclick="editTask('${task.id}')">Editar</button>
        <button class="small-btn delete" onclick="deleteTask('${task.id}')">×</button>
      </div>
    </article>
  `).join("");
}

function render() {
    renderStats();
    renderTasks();
}

function resetForm() {
    taskId.value = "";
    nameInput.value = "";
    descInput.value = "";
    requestedByInput.value = "";
    priorityInput.value = "Média";
    dateInput.value = new Date().toISOString().split("T")[0];
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
    priorityInput.value = task.priority;
    dateInput.value = task.date;

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
        date: "",
        priority: "",
        requestedBy: ""
    };
    filterDateInput.value = "";
    filterPriorityInput.value = "";
    filterRequestedByInput.value = "";
    filterPanel.classList.add("hidden");
    updateFilterButton();
    renderTasks();
});

resetForm();
updateFilterButton();
loadTasks();
