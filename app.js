const DAYS = ["日", "月", "火", "水", "木", "金", "土"];
const STORAGE_KEY = "bdo-boss-timer-selected-v1";
const ALERT_OFFSETS = [
  { minutes: 15, label: "15分前" },
  { minutes: 5, label: "5分前" },
  { minutes: 0, label: "ちょうど" },
];

const scheduleRows = [
  ["0:15", { 1: ["ガーモス"], 3: ["ガーモス"], 5: ["ガーモス"], 0: ["ガーモス"] }],
  ["1:30", { 1: ["クザカ", "不可殺"], 2: ["ヌーベル", "ウトゥリ"], 3: ["オピン", "金豚王"], 4: ["カランダ", "金豚王"], 5: ["クツム", "山君"], 6: ["クツム", "不可殺"], 0: ["ヌーベル", "山君"] }],
  ["11:00", { 1: ["ヌーベル", "ウトゥリ"], 2: ["クツム", "金豚王"], 3: ["クザカ", "山君"], 5: ["カランダ", "不可殺"], 6: ["カランダ", "ウトゥリ"], 0: ["クツム", "不可殺"] }],
  ["14:00", { 1: ["ガーモス"], 2: ["ガーモス"], 3: ["ガーモス"], 4: ["ガーモス"], 5: ["ガーモス"], 6: ["ガーモス"], 0: ["ベル"] }],
  ["16:00", { 1: ["クツム", "金豚王"], 2: ["ヌーベル", "山君"], 3: ["カランダ", "山君"], 4: ["ヌーベル", "不可殺"], 5: ["クザカ", "ウトゥリ"], 6: ["クザカ", "金豚王"], 0: ["カランダ", "ウトゥリ"] }],
  ["17:00", { 6: ["黒い影"] }],
  ["19:00", { 1: ["カランダ", "山君"], 2: ["クザカ", "不可殺"], 3: ["ギュント", "ムラカ"], 4: ["ヌーベル", "ウトゥリ"], 5: ["ヌーベル", "金豚王"], 6: ["ギュント", "ムラカ"], 0: ["クザカ", "山君"] }],
  ["20:00", { 1: ["ガーモス"], 2: ["ガーモス"], 3: ["ガーモス"], 4: ["クザカ", "ウトゥリ"], 5: ["ガーモス"], 0: ["クツム", "不可殺"] }],
  ["23:15", { 1: ["オピン", "不可殺"], 2: ["カランダ", "ウトゥリ"], 3: ["ベル"], 4: ["クツム", "金豚王"], 5: ["オピン", "山君"], 0: ["ヌーベル", "金豚王"] }],
];

const events = buildEvents(scheduleRows);
const bosses = [...new Set(events.flatMap((event) => event.bosses))].sort((a, b) => a.localeCompare(b, "ja"));
const selected = new Set(loadSelected());
const firedAlerts = new Set();

let audioContext = null;
let toastTimer = 0;

const elements = {
  currentDate: document.querySelector("#current-date"),
  currentTime: document.querySelector("#current-time"),
  nextBoss: document.querySelector("#next-boss"),
  nextDetail: document.querySelector("#next-detail"),
  countdown: document.querySelector("#countdown"),
  bossList: document.querySelector("#boss-list"),
  upcomingList: document.querySelector("#upcoming-list"),
  selectedCount: document.querySelector("#selected-count"),
  enableAudio: document.querySelector("#enable-audio"),
  notifyToggle: document.querySelector("#notify-toggle"),
  selectAll: document.querySelector("#select-all"),
  clearAll: document.querySelector("#clear-all"),
  toast: document.querySelector("#toast"),
};

renderBossOptions();
bindControls();
tick();
window.setInterval(tick, 1000);

function buildEvents(rows) {
  return rows.flatMap(([time, dayMap]) => {
    const [hour, minute] = time.split(":").map(Number);
    return Object.entries(dayMap).map(([day, bossesForSlot]) => ({
      day: Number(day),
      hour,
      minute,
      time,
      bosses: bossesForSlot,
    }));
  });
}

function loadSelected() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (Array.isArray(saved) && saved.length) {
      return saved.filter((boss) => bosses.includes(boss));
    }
  } catch {
    // localStorageが壊れていても全選択で復帰させる。
  }
  return bosses;
}

function saveSelected() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected]));
}

function renderBossOptions() {
  elements.bossList.innerHTML = "";
  bosses.forEach((boss) => {
    const label = document.createElement("label");
    label.className = "boss-option";

    const name = document.createElement("span");
    name.textContent = boss;

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = selected.has(boss);
    input.addEventListener("change", () => {
      input.checked ? selected.add(boss) : selected.delete(boss);
      saveSelected();
      tick();
    });

    label.append(name, input);
    elements.bossList.append(label);
  });
}

function bindControls() {
  elements.enableAudio.addEventListener("click", async () => {
    await enableAudio();
    showToast("アラームを有効化しました。ブラウザを開いたままにしておくと鳴ります。");
  });

  elements.notifyToggle.addEventListener("change", async () => {
    if (!elements.notifyToggle.checked) {
      return;
    }
    if (!("Notification" in window)) {
      elements.notifyToggle.checked = false;
      showToast("このブラウザでは通知を使えません。");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      elements.notifyToggle.checked = false;
      showToast("通知が許可されませんでした。");
    }
  });

  elements.selectAll.addEventListener("click", () => {
    bosses.forEach((boss) => selected.add(boss));
    saveSelected();
    renderBossOptions();
    tick();
  });

  elements.clearAll.addEventListener("click", () => {
    selected.clear();
    saveSelected();
    renderBossOptions();
    tick();
  });
}

async function enableAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
  playAlarmTone(0.08);
}

function tick() {
  const now = new Date();
  elements.currentDate.textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 (${DAYS[now.getDay()]})`;
  elements.currentTime.textContent = formatTime(now);

  const upcoming = getUpcomingEvents(now, 14);
  const next = upcoming[0];
  elements.selectedCount.textContent = `${selected.size} / ${bosses.length} 選択中`;

  if (!next) {
    elements.nextBoss.textContent = "対象なし";
    elements.nextDetail.textContent = "アラームを鳴らすボスを選択してください。";
    elements.countdown.textContent = "--:--:--";
    elements.upcomingList.innerHTML = `<p class="muted">表示できる予定がありません。</p>`;
    return;
  }

  const remainingMs = next.date.getTime() - now.getTime();
  elements.nextBoss.textContent = next.bosses.join(" / ");
  elements.nextDetail.textContent = `${formatEventDate(next.date)} ${next.time} 出現`;
  elements.countdown.textContent = formatDuration(Math.max(0, remainingMs));
  renderUpcoming(upcoming, now);
  checkAlerts(upcoming, now);
}

function getUpcomingEvents(now, limit) {
  const upcoming = [];
  const selectedEvents = events
    .map((event) => ({ ...event, bosses: event.bosses.filter((boss) => selected.has(boss)) }))
    .filter((event) => event.bosses.length);

  for (let offset = 0; offset < 8; offset += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() + offset);
    for (const event of selectedEvents) {
      if (date.getDay() !== event.day) {
        continue;
      }
      const eventDate = new Date(date);
      eventDate.setHours(event.hour, event.minute, 0, 0);
      if (eventDate.getTime() >= now.getTime() - 1000) {
        upcoming.push({ ...event, date: eventDate });
      }
    }
  }

  return upcoming.sort((a, b) => a.date - b.date).slice(0, limit);
}

function renderUpcoming(upcoming, now) {
  elements.upcomingList.innerHTML = "";
  upcoming.forEach((event) => {
    const row = document.createElement("div");
    row.className = "event-row";

    const time = document.createElement("div");
    time.className = "event-time";
    time.textContent = event.time;

    const bossesText = document.createElement("div");
    bossesText.className = "event-bosses";
    bossesText.textContent = event.bosses.join(" / ");

    const meta = document.createElement("div");
    meta.className = "event-meta";
    meta.textContent = `${formatEventDate(event.date)} あと ${formatDuration(event.date - now)}`;

    row.append(time, bossesText, meta);
    elements.upcomingList.append(row);
  });
}

function checkAlerts(upcoming, now) {
  const nowMs = now.getTime();
  upcoming.forEach((event) => {
    ALERT_OFFSETS.forEach((offset) => {
      const alertAt = event.date.getTime() - offset.minutes * 60 * 1000;
      const diff = nowMs - alertAt;
      const key = `${event.date.toISOString()}-${event.bosses.join("+")}-${offset.minutes}`;
      if (diff >= 0 && diff < 1000 && !firedAlerts.has(key)) {
        firedAlerts.add(key);
        fireAlarm(event, offset.label);
      }
    });
  });
}

function fireAlarm(event, label) {
  const title = `${event.bosses.join(" / ")} ${label}`;
  const body = `${formatEventDate(event.date)} ${event.time} 出現`;
  showToast(`${title} - ${body}`);
  playAlarmTone(1.8);

  if (elements.notifyToggle.checked && "Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

function playAlarmTone(seconds) {
  if (!audioContext || audioContext.state !== "running") {
    return;
  }

  const start = audioContext.currentTime;
  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.24, start + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  gain.connect(audioContext.destination);

  [440, 660, 880].forEach((frequency, index) => {
    const osc = audioContext.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, start + index * 0.08);
    osc.connect(gain);
    osc.start(start + index * 0.08);
    osc.stop(start + seconds);
  });
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 5200);
}

function formatTime(date) {
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function formatEventDate(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target - today) / 86400000);
  const prefix = diffDays === 0 ? "今日" : diffDays === 1 ? "明日" : `${date.getMonth() + 1}/${date.getDate()}`;
  return `${prefix}(${DAYS[date.getDay()]})`;
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}
