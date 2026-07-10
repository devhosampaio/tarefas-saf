const MEETINGS_STORAGE_KEY = "reunioes_cadastradas_v1";

let meetings = JSON.parse(localStorage.getItem(MEETINGS_STORAGE_KEY)) || [];

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

function saveMeetings() {
    localStorage.setItem(MEETINGS_STORAGE_KEY, JSON.stringify(meetings));
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
    document.getElementById("monthMeetings").textContent = meetings.filter(meeting => meeting.date?.startsWith(`${currentYear}-${currentMonth}`)).length;
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

meetingForm.addEventListener("submit", event => {
    event.preventDefault();

    if (meetingFields.endTime.value < meetingFields.startTime.value) {
        alert("O horário de término precisa ser maior ou igual ao horário de início.");
        meetingFields.endTime.focus();
        return;
    }

    const meeting = getMeetingFormData();

    if (meetingFields.id.value) {
        meetings = meetings.map(item => item.id === meeting.id ? meeting : item);
    } else {
        meetings.push(meeting);
    }

    saveMeetings();
    resetMeetingForm();
    renderMeetingArea();
});

window.editMeeting = function (id) {
    const meeting = meetings.find(item => item.id === id);
    if (meeting) fillMeetingForm(meeting);
};

window.deleteMeeting = function (id) {
    const meeting = meetings.find(item => item.id === id);
    if (!meeting) return;

    if (confirm(`Excluir a reunião "${meeting.subject}"?`)) {
        meetings = meetings.filter(item => item.id !== id);
        saveMeetings();
        renderMeetingArea();
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

resetMeetingForm();
renderMeetingArea();
