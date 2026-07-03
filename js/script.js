const STORAGE_KEY = "tarefas_saf_v1";
let tasks = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
let currentFilter = "todas";

const formPanel = document.getElementById("formPanel");
const taskForm = document.getElementById("taskForm");
const taskList = document.getElementById("taskList");

const taskId = document.getElementById("taskId");
const nameInput = document.getElementById("name");
const descInput = document.getElementById("description");
const requestedByInput = document.getElementById("requestedBy");
const priorityInput = document.getElementById("priority");
const dateInput = document.getElementById("date");

function saveTasks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    render();
}

function formatDate(value) {
    if (!value) return "Sem data";
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
}

function priorityClass(priority) {
    if (priority === "Alta") return "alta";
    if (priority === "Baixa") return "baixa";
    return "media";
}

function getFilteredTasks() {
    const sorted = [...tasks].sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return new Date(a.date) - new Date(b.date);
    });

    if (currentFilter === "pendentes") return sorted.filter(t => !t.done);
    if (currentFilter === "concluidas") return sorted.filter(t => t.done);
    if (currentFilter === "alta") return sorted.filter(t => t.priority === "Alta");
    return sorted;
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
    <article class="task ${task.done ? "done" : ""}">
      <div class="task-head">
        <h2>${escapeHTML(task.name)}</h2>
        <span class="badge ${priorityClass(task.priority)}">${task.priority}</span>
      </div>

      ${task.description ? `<p>${escapeHTML(task.description)}</p>` : ""}

      <div class="meta">
        <span>📅 ${formatDate(task.date)}</span>
        <span>👤 ${escapeHTML(task.requestedBy || "Não informado")}</span>
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

taskForm.addEventListener("submit", event => {
    event.preventDefault();

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

    saveTasks();
    closeForm();
});

window.toggleDone = function (id) {
    tasks = tasks.map(task => task.id === id ? { ...task, done: !task.done } : task);
    saveTasks();
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

window.deleteTask = function (id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (confirm(`Excluir a tarefa "${task.name}"?`)) {
        tasks = tasks.filter(task => task.id !== id);
        saveTasks();
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

document.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
        document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        currentFilter = chip.dataset.filter;
        renderTasks();
    });
});

document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        const view = btn.dataset.view;
        document.getElementById("dashboardView").classList.toggle("hidden", view !== "dashboard");
        document.getElementById("tasksView").classList.toggle("hidden", view === "about");
        document.getElementById("aboutView").classList.toggle("hidden", view !== "about");

        if (view === "dashboard") {
            document.getElementById("tasksView").classList.remove("hidden");
        }
    });
});

document.getElementById("exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "backup-tarefas-saf.json";
    a.click();
    URL.revokeObjectURL(url);
});

document.getElementById("importBtn").addEventListener("click", () => {
    document.getElementById("importFile").click();
});

document.getElementById("importFile").addEventListener("change", event => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        try {
            const imported = JSON.parse(reader.result);
            if (!Array.isArray(imported)) throw new Error();
            tasks = imported;
            saveTasks();
            alert("Backup importado com sucesso.");
        } catch {
            alert("Arquivo inválido.");
        }
    };
    reader.readAsText(file);
});

resetForm();
render();