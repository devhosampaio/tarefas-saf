const MEETINGS_STORAGE_KEY = "reunioes_cadastradas_v1";
const MEETINGS_CONFIG = window.TAREFAS_SAF_SUPABASE || {};
const MEETINGS_SUPABASE_TABLE = MEETINGS_CONFIG.meetingsTable || "reunioes";
const MEETINGS_SUPABASE_READY = Boolean(MEETINGS_CONFIG.url && MEETINGS_CONFIG.anonKey && window.supabase);
const meetingsDb = MEETINGS_SUPABASE_READY
    ? window.supabase.createClient(MEETINGS_CONFIG.url, MEETINGS_CONFIG.anonKey)
    : null;

let meetings = [];

const meetingFields = {
    id: document.getElementById("meetingId"),
    subject: document.getElementById("meetingSubject"),
    date: document.getElementById("meetingDate"),
    format: document.getElementById("meetingFormat"),
    startTime: document.getElementById("meetingStartTime"),
    endTime: document.getElementById("meetingEndTime"),
    duration: document.getElementById("meetingDuration"),
    participants: document.getElementById("meetingParticipants"),
    myRole: document.getElementById("meetingMyRole"),
    location: document.getElementById("meetingLocation"),
    decisions: document.getElementById("meetingDecisions"),
    responsible: document.getElementById("meetingResponsible"),
    deadline: document.getElementById("meetingDeadline"),
    status: document.getElementById("meetingStatus")
};

const meetingForm = document.getElementById("meetingForm");
const meetingsTable = document.getElementById("meetingsTable");
const meetingEmptyState = document.getElementById("meetingEmptyState");
const meetingSearchInput = document.getElementById("meetingSearchInput");
const meetingFormTitle = document.getElementById("meetingFormTitle");

function setMeetingsSyncStatus(message) {
    const syncStatus = document.getElementById("syncStatus");
    if (syncStatus) syncStatus.textContent = message;
}

function saveLocalMeetings() {
    localStorage.setItem(MEETINGS_STORAGE_KEY, JSON.stringify(meetings));
}

function getLocalMeetings() {
    return JSON.parse(localStorage.getItem(MEETINGS_STORAGE_KEY)) || [];
}

function toDatabaseMeeting(meeting) {
    return {
        id: meeting.id,
        user_id: window.tarefasSafCurrentUser?.id,
        subject: meeting.subject,
        date: meeting.date,
        format: meeting.format,
        start_time: meeting.startTime,
        end_time: meeting.endTime,
        duration_minutes: meeting.durationMinutes,
        participants: meeting.participants || "",
        my_role: meeting.myRole,
        location: meeting.location || "",
        decisions: meeting.decisions || "",
        responsible: meeting.responsible || "",
        deadline: meeting.deadline || null,
        status: meeting.status,
        created_at: meeting.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
}

function fromDatabaseMeeting(meeting) {
    return {
        id: meeting.id,
        subject: meeting.subject,
        date: meeting.date,
        format: meeting.format,
        startTime: meeting.start_time,
        endTime: meeting.end_time,
        durationMinutes: meeting.duration_minutes,
        participants: meeting.participants || "",
        myRole: meeting.my_role,
        location: meeting.location || "",
        decisions: meeting.decisions || "",
        responsible: meeting.responsible || "",
        deadline: meeting.deadline || "",
        status: meeting.status,
        createdAt: meeting.created_at,
        updatedAt: meeting.updated_at
    };
}

async function loadMeetings() {
    if (!MEETINGS_SUPABASE_READY) {
        meetings = getLocalMeetings();
        renderMeetingArea();
        return;
    }

    if (!window.tarefasSafCurrentUser) {
        meetings = [];
        renderMeetingArea();
        return;
    }

    meetings = getLocalMeetings();
    renderMeetingArea();

    let result;
    try {
        result = await withTimeout(
            meetingsDb
                .from(MEETINGS_SUPABASE_TABLE)
                .select("*")
                .eq("user_id", window.tarefasSafCurrentUser.id)
                .order("date", { ascending: false })
                .order("start_time", { ascending: false })
        );
    } catch (error) {
        console.error(error);
        setMeetingsSyncStatus("Nuvem indisponível. Usando reuniões locais.");
        return;
    }

    const { data, error } = result;
    if (error) {
        console.error(error);
        setMeetingsSyncStatus("Falha na nuvem. Usando reuniões locais.");
        return;
    }

    meetings = data.map(fromDatabaseMeeting);
    await migrateLocalMeetings();
    setMeetingsSyncStatus("Sincronizado na nuvem");
    renderMeetingArea();
}

async function migrateLocalMeetings() {
    const localMeetings = getLocalMeetings();
    const missingMeetings = localMeetings.filter(localMeeting => {
        return !meetings.some(meeting => meeting.id === localMeeting.id);
    });

    if (!MEETINGS_SUPABASE_READY || !window.tarefasSafCurrentUser) return;

    if (missingMeetings.length === 0) {
        localStorage.removeItem(MEETINGS_STORAGE_KEY);
        return;
    }

    let result;
    try {
        result = await withTimeout(
            meetingsDb
                .from(MEETINGS_SUPABASE_TABLE)
                .upsert(missingMeetings.map(toDatabaseMeeting))
                .select("*")
        );
    } catch (error) {
        console.error(error);
        setMeetingsSyncStatus("Nuvem ativa. Migração de reuniões falhou.");
        return;
    }

    const { data, error } = result;
    if (error) {
        console.error(error);
        setMeetingsSyncStatus("Nuvem ativa. Migração de reuniões falhou.");
        return;
    }

    const migratedMeetings = data.map(fromDatabaseMeeting);
    meetings = [
        ...meetings,
        ...migratedMeetings.filter(migratedMeeting => {
            return !meetings.some(meeting => meeting.id === migratedMeeting.id);
        })
    ];
    localStorage.removeItem(MEETINGS_STORAGE_KEY);
}

async function saveMeeting(meeting) {
    if (!MEETINGS_SUPABASE_READY) {
        saveLocalMeetings();
        renderMeetingArea();
        return true;
    }

    if (!window.tarefasSafCurrentUser) {
        setMeetingsSyncStatus("Entre para salvar reunião na nuvem");
        return false;
    }

    let result;
    try {
        result = await withTimeout(
            meetingsDb
                .from(MEETINGS_SUPABASE_TABLE)
                .upsert(toDatabaseMeeting(meeting))
        );
    } catch (error) {
        console.error(error);
        setMeetingsSyncStatus("Erro ao salvar reunião na nuvem");
        return false;
    }

    const { error } = result;
    if (error) {
        console.error(error);
        setMeetingsSyncStatus("Erro ao salvar reunião na nuvem");
        return false;
    }

    setMeetingsSyncStatus("Sincronizado na nuvem");
    renderMeetingArea();
    return true;
}

async function removeMeeting(id) {
    if (!MEETINGS_SUPABASE_READY) {
        saveLocalMeetings();
        renderMeetingArea();
        return true;
    }

    if (!window.tarefasSafCurrentUser) {
        setMeetingsSyncStatus("Entre para excluir reunião na nuvem");
        return false;
    }

    let result;
    try {
        result = await withTimeout(
            meetingsDb
                .from(MEETINGS_SUPABASE_TABLE)
                .delete()
                .eq("id", id)
                .eq("user_id", window.tarefasSafCurrentUser.id)
        );
    } catch (error) {
        console.error(error);
        setMeetingsSyncStatus("Erro ao excluir reunião na nuvem");
        return false;
    }

    const { error } = result;
    if (error) {
        console.error(error);
        setMeetingsSyncStatus("Erro ao excluir reunião na nuvem");
        return false;
    }

    setMeetingsSyncStatus("Sincronizado na nuvem");
    renderMeetingArea();
    return true;
}

function minutesFromTime(time) {
    if (!time) return null;
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
}

function calculateMeetingDurationMinutes() {
    const start = minutesFromTime(meetingFields.startTime.value);
    const end = minutesFromTime(meetingFields.endTime.value);

    if (start === null || end === null || end < start) return 0;
    return end - start;
}

function formatMeetingDuration(minutes) {
    if (!minutes) return "0 min";
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (hours && rest) return `${hours}h ${rest}min`;
    if (hours) return `${hours}h`;
    return `${rest} min`;
}

function updateMeetingDuration() {
    meetingFields.duration.value = formatMeetingDuration(calculateMeetingDurationMinutes());
}

function formatMeetingDate(value) {
    if (!value) return "-";
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
}

function escapeMeetingHTML(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function normalizeMeetingText(value) {
    return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function resetMeetingForm() {
    meetingForm.reset();
    meetingFields.id.value = "";
    meetingFields.date.value = new Date().toISOString().split("T")[0];
    meetingFields.duration.value = "0 min";
    meetingFormTitle.textContent = "Nova reunião";
    document.getElementById("cancelMeetingEditButton").style.display = "none";
    closeMeetingPopover();
}

function placeMeetingPopover(x, y) {
    const margin = 12;
    meetingForm.style.left = `${x}px`;
    meetingForm.style.top = `${y}px`;

    requestAnimationFrame(() => {
        const rect = meetingForm.getBoundingClientRect();
        const nextLeft = Math.min(Math.max(margin, x), window.innerWidth - rect.width - margin);
        const nextTop = Math.min(Math.max(margin, y), window.innerHeight - rect.height - margin);
        meetingForm.style.left = `${nextLeft}px`;
        meetingForm.style.top = `${nextTop}px`;
    });
}

function closeMeetingPopover() {
    meetingForm.classList.remove("floating-popover");
    meetingForm.style.left = "";
    meetingForm.style.top = "";
}

function openMeetingFormPopover(date, x, y) {
    showTab("meetingsTab");
    resetMeetingForm();
    meetingFields.date.value = date;
    meetingForm.classList.add("floating-popover");
    placeMeetingPopover(x, y);
    meetingFields.subject.focus();
}

function getMeetingFormData() {
    const durationMinutes = calculateMeetingDurationMinutes();

    return {
        id: meetingFields.id.value || crypto.randomUUID(),
        subject: meetingFields.subject.value.trim(),
        date: meetingFields.date.value,
        format: meetingFields.format.value,
        startTime: meetingFields.startTime.value,
        endTime: meetingFields.endTime.value,
        durationMinutes,
        participants: meetingFields.participants.value.trim(),
        myRole: meetingFields.myRole.value,
        location: meetingFields.location.value.trim(),
        decisions: meetingFields.decisions.value.trim(),
        responsible: meetingFields.responsible.value.trim(),
        deadline: meetingFields.deadline.value,
        status: meetingFields.status.value,
        createdAt: meetingFields.id.value
            ? meetings.find(meeting => meeting.id === meetingFields.id.value)?.createdAt
            : new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

function fillMeetingForm(meeting) {
    meetingFields.id.value = meeting.id;
    meetingFields.subject.value = meeting.subject;
    meetingFields.date.value = meeting.date;
    meetingFields.format.value = meeting.format;
    meetingFields.startTime.value = meeting.startTime;
    meetingFields.endTime.value = meeting.endTime;
    meetingFields.duration.value = formatMeetingDuration(meeting.durationMinutes);
    meetingFields.participants.value = meeting.participants;
    meetingFields.myRole.value = meeting.myRole;
    meetingFields.location.value = meeting.location;
    meetingFields.decisions.value = meeting.decisions;
    meetingFields.responsible.value = meeting.responsible;
    meetingFields.deadline.value = meeting.deadline;
    meetingFields.status.value = meeting.status;
    meetingFormTitle.textContent = "Editar reunião";
    document.getElementById("cancelMeetingEditButton").style.display = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateMeetingSummary() {
    const now = new Date();
    const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
    const currentYear = String(now.getFullYear());
    const totalMinutes = meetings.reduce((sum, meeting) => sum + Number(meeting.durationMinutes || 0), 0);

    document.getElementById("totalMeetings").textContent = meetings.length;
    document.getElementById("monthMeetings").textContent = meetings.filter(meeting => {
        return meeting.date?.startsWith(`${currentYear}-${currentMonth}`);
    }).length;
    document.getElementById("totalHours").textContent = formatMeetingDuration(totalMinutes);
}

function getFilteredMeetings() {
    const query = normalizeMeetingText(meetingSearchInput.value);

    return [...meetings]
        .filter(meeting => normalizeMeetingText([
            meeting.subject,
            meeting.participants,
            meeting.status,
            meeting.myRole,
            meeting.responsible,
            meeting.location
        ].join(" ")).includes(query))
        .sort((a, b) => `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`));
}

function renderMeetings() {
    const filteredMeetings = getFilteredMeetings();
    meetingEmptyState.classList.toggle("visible", filteredMeetings.length === 0);

    meetingsTable.innerHTML = filteredMeetings.map(meeting => `
        <tr>
            <td>${formatMeetingDate(meeting.date)}</td>
            <td>${escapeMeetingHTML(meeting.startTime)} - ${escapeMeetingHTML(meeting.endTime)}</td>
            <td>${formatMeetingDuration(meeting.durationMinutes)}</td>
            <td>
                <strong>${escapeMeetingHTML(meeting.subject)}</strong>
                <span class="cell-muted">${escapeMeetingHTML(meeting.format)} · ${escapeMeetingHTML(meeting.myRole)}</span>
                ${meeting.location ? `<span class="cell-muted">${escapeMeetingHTML(meeting.location)}</span>` : ""}
            </td>
            <td>${escapeMeetingHTML(meeting.participants || "Não informado")}</td>
            <td><span class="badge plain-badge">${escapeMeetingHTML(meeting.status)}</span></td>
            <td>
                <div class="row-actions">
                    <button type="button" onclick="editMeeting('${meeting.id}')">Editar</button>
                    <button type="button" class="delete" onclick="deleteMeeting('${meeting.id}')">Excluir</button>
                </div>
            </td>
        </tr>
    `).join("");
}

function renderMeetingArea() {
    updateMeetingSummary();
    renderMeetings();
}

meetingForm.addEventListener("submit", async event => {
    event.preventDefault();

    const submitButton = meetingForm.querySelector("button[type='submit']");
    const originalSubmitText = submitButton?.textContent || "Salvar reunião";
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Salvando...";
    }

    if (meetingFields.endTime.value < meetingFields.startTime.value) {
        alert("O horário de término precisa ser maior ou igual ao horário de início.");
        meetingFields.endTime.focus();
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalSubmitText;
        }
        return;
    }

    const previousMeetings = [...meetings];
    const meeting = getMeetingFormData();

    if (meetingFields.id.value) {
        meetings = meetings.map(item => item.id === meeting.id ? meeting : item);
    } else {
        meetings.push(meeting);
    }

    renderMeetingArea();
    setMeetingsSyncStatus("Salvando...");

    const saved = await saveMeeting(meeting);
    if (saved) {
        resetMeetingForm();
    } else {
        meetings = previousMeetings;
        renderMeetingArea();
    }

    if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalSubmitText;
    }
});

window.editMeeting = function (id) {
    const meeting = meetings.find(item => item.id === id);
    if (meeting) fillMeetingForm(meeting);
};

window.deleteMeeting = async function (id) {
    const meeting = meetings.find(item => item.id === id);
    if (!meeting) return;

    if (confirm(`Excluir a reunião "${meeting.subject}"?`)) {
        const previousMeetings = [...meetings];
        meetings = meetings.filter(item => item.id !== id);
        renderMeetingArea();
        setMeetingsSyncStatus("Excluindo...");

        const removed = await removeMeeting(id);
        if (!removed) {
            meetings = previousMeetings;
            renderMeetingArea();
        }
    }
};

document.getElementById("newMeetingButton").addEventListener("click", () => {
    showTab("meetingsTab");
    resetMeetingForm();
    meetingFields.subject.focus();
});

document.getElementById("clearMeetingFormButton").addEventListener("click", resetMeetingForm);
document.getElementById("cancelMeetingEditButton").addEventListener("click", resetMeetingForm);
meetingSearchInput.addEventListener("input", renderMeetings);
meetingFields.startTime.addEventListener("input", updateMeetingDuration);
meetingFields.endTime.addEventListener("input", updateMeetingDuration);

document.querySelectorAll(".tab").forEach(button => {
    button.addEventListener("click", () => showTab(button.dataset.tab));
});

function showTab(tabId) {
    document.querySelectorAll(".tab").forEach(button => {
        button.classList.toggle("active", button.dataset.tab === tabId);
    });

    document.querySelectorAll(".tab-panel").forEach(panel => {
        panel.classList.toggle("active", panel.id === tabId);
    });
}

window.showTab = showTab;
window.openMeetingFormPopover = openMeetingFormPopover;
window.closeMeetingPopover = closeMeetingPopover;

resetMeetingForm();
window.loadMeetings = loadMeetings;
window.clearMeetingsForSignedOutUser = function () {
    meetings = [];
    renderMeetingArea();
};

if (!MEETINGS_SUPABASE_READY || window.tarefasSafCurrentUser) {
    loadMeetings();
} else {
    renderMeetingArea();
}
