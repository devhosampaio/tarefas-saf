const appShell = document.getElementById("appShell");
const sidebarToggle = document.getElementById("sidebarToggle");
const currentDateLabel = document.getElementById("currentDateLabel");
const globalSearchInput = document.getElementById("globalSearchInput");
const quickFilterButton = document.getElementById("quickFilterButton");

function formatLongDate(date = new Date()) {
    return new Intl.DateTimeFormat("pt-BR", {
        weekday: "short",
        day: "2-digit",
        month: "short"
    }).format(date);
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function readStorage(key) {
    try {
        return JSON.parse(localStorage.getItem(key)) || [];
    } catch {
        return [];
    }
}

function isoToday() {
    return new Date().toISOString().split("T")[0];
}

function isThisWeek(dateValue) {
    if (!dateValue) return false;
    const date = new Date(`${dateValue}T00:00:00`);
    const today = new Date();
    const first = new Date(today);
    first.setDate(today.getDate() - today.getDay());
    first.setHours(0, 0, 0, 0);
    const last = new Date(first);
    last.setDate(first.getDate() + 6);
    last.setHours(23, 59, 59, 999);
    return date >= first && date <= last;
}

function updateExecutiveDashboard() {
    const tasks = readStorage("tarefas_saf_v1");
    const meetings = readStorage("reunioes_cadastradas_v1");
    const today = isoToday();

    const pending = tasks.filter(task => !task.done);
    const done = tasks.filter(task => task.done);
    const todayTasks = pending.filter(task => task.date === today);
    const overdue = pending.filter(task => task.date && task.date < today);
    const upcoming = pending.filter(task => task.date && task.date >= today).slice(0, 7);
    const todayMeetings = meetings.filter(meeting => meeting.date === today);
    const plannedMinutes = meetings.reduce((sum, meeting) => sum + Number(meeting.durationMinutes || 0), 0);

    setText("todayTasksMetric", todayTasks.length);
    setText("todayMeetingsMetric", todayMeetings.length);
    setText("overdueTasksMetric", overdue.length);
    setText("upcomingDeadlinesMetric", upcoming.length);
    setText("doneWeekMetric", done.filter(task => isThisWeek(task.date)).length);
    setText("activeProjectsMetric", new Set(tasks.map(task => task.project).filter(Boolean)).size || 2);
    setText("pendingTasksMirror", pending.length);
    setText("projectTaskCount", `${tasks.length} tarefas`);
    setText("projectMeetingCount", `${meetings.length} reuniões`);

    const dashboardTaskPreview = document.getElementById("dashboardTaskPreview");
    if (dashboardTaskPreview) {
        const preview = pending.slice(0, 5);
        dashboardTaskPreview.innerHTML = preview.length
            ? preview.map(task => `
                <div class="insight-item">
                    <span class="insight-dot"></span>
                    <div>
                        <strong>${escapePreview(task.name)}</strong>
                        <small>${escapePreview(task.priority || "Média")} · ${formatPreviewDate(task.date)}</small>
                    </div>
                </div>
            `).join("")
            : `<div class="empty">Nenhuma tarefa pendente.</div>`;
    }

    renderCalendarPreview(tasks, meetings);
}

function escapePreview(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatPreviewDate(value) {
    if (!value) return "Sem prazo";
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
}

function renderCalendarPreview(tasks, meetings) {
    const shell = document.getElementById("calendarShell");
    if (!shell) return;

    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDay = new Date(year, month, 1);
    const start = new Date(firstDay);
    start.setDate(firstDay.getDate() - firstDay.getDay());

    const days = Array.from({ length: 35 }, (_, index) => {
        const date = new Date(start);
        date.setDate(start.getDate() + index);
        return date;
    });

    shell.innerHTML = days.map(date => {
        const iso = date.toISOString().split("T")[0];
        const dayTasks = tasks.filter(task => task.date === iso).slice(0, 2);
        const dayMeetings = meetings.filter(meeting => meeting.date === iso).slice(0, 2);
        const isToday = iso === isoToday();

        return `
            <div class="calendar-day ${isToday ? "today" : ""}">
                <strong>${date.getDate()}</strong>
                ${dayTasks.map(task => `<div class="calendar-event">${escapePreview(task.name)}</div>`).join("")}
                ${dayMeetings.map(meeting => `<div class="calendar-event">${escapePreview(meeting.subject)}</div>`).join("")}
            </div>
        `;
    }).join("");
}

sidebarToggle?.addEventListener("click", () => {
    appShell?.classList.toggle("sidebar-collapsed");
});

quickFilterButton?.addEventListener("click", () => {
    if (typeof showTab === "function") showTab("tasksTab");
    document.getElementById("openFilters")?.click();
});

globalSearchInput?.addEventListener("input", () => {
    const query = globalSearchInput.value.trim();
    const taskSearch = document.getElementById("taskSearchInput");
    const meetingSearch = document.getElementById("meetingSearchInput");

    if (taskSearch) {
        taskSearch.value = query;
        taskSearch.dispatchEvent(new Event("input", { bubbles: true }));
    }

    if (meetingSearch) {
        meetingSearch.value = query;
        meetingSearch.dispatchEvent(new Event("input", { bubbles: true }));
    }

    if (query && typeof showTab === "function") showTab("tasksTab");
});

document.querySelectorAll(".tab-link").forEach(button => {
    button.addEventListener("click", () => {
        if (typeof showTab === "function") showTab(button.dataset.tab);
    });
});

currentDateLabel.textContent = formatLongDate();
updateExecutiveDashboard();
window.addEventListener("storage", updateExecutiveDashboard);
setInterval(updateExecutiveDashboard, 30000);
