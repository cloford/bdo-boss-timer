const DAYS = ["日", "月", "火", "水", "木", "金", "土"];
const STORAGE_KEY = "bdo-boss-timer-selected-v1";
const SETTINGS_KEY = "bdo-boss-timer-audio-settings-v2";
const DEFAULT_AUDIO_SETTINGS = {
  volume: 60,
  sound: "bell",
  alertOffsets: [15, 5, 0],
};
const ALERT_OFFSET_OPTIONS = [
  { minutes: 30, label: "30分前" },
  { minutes: 15, label: "15分前" },
  { minutes: 5, label: "5分前" },
  { minutes: 1, label: "1分前" },
  { minutes: 0, label: "ちょうど" },
];
const LOML_BOSSES = ["不可殺", "ウトゥリ", "金豚王", "山君"];
const WORLD_BOSSES = ["クザカ", "ヌーベル", "クツム", "カランダ", "オピン", "ギュント", "ムラカ", "ベル", "黒い影"];
const BOSS_COLORS = {
  ガーモス: "red",
  ベル: "blue",
  クザカ: "gold",
  ヌーベル: "sand",
  クツム: "violet",
  カランダ: "sky",
  オピン: "green",
  ギュント: "stone",
  ムラカ: "stone",
  黒い影: "shadow",
  不可殺: "jade",
  ウトゥリ: "jade",
  金豚王: "jade",
  山君: "jade",
};

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
const audioSettings = loadAudioSettings();
const firedAlerts = new Set();
const activeAudioNodes = new Set();

let audioContext = null;
let toastTimer = 0;

const elements = {
  matrixCanvas: document.querySelector("#matrix-bg"),
  currentDate: document.querySelector("#current-date"),
  currentTime: document.querySelector("#current-time"),
  nextBoss: document.querySelector("#next-boss"),
  nextDetail: document.querySelector("#next-detail"),
  nextTime: document.querySelector("#next-time"),
  countdown: document.querySelector("#countdown"),
  bossList: document.querySelector("#boss-list"),
  todayList: document.querySelector("#today-list"),
  laterList: document.querySelector("#later-list"),
  todayCount: document.querySelector("#today-count"),
  laterCount: document.querySelector("#later-count"),
  selectedCount: document.querySelector("#selected-count"),
  enableAudio: document.querySelector("#enable-audio"),
  testVolume: document.querySelector("#test-volume"),
  stopAlarm: document.querySelector("#stop-alarm"),
  alarmVolume: document.querySelector("#alarm-volume"),
  volumeValue: document.querySelector("#volume-value"),
  alarmSound: document.querySelector("#alarm-sound"),
  notifyToggle: document.querySelector("#notify-toggle"),
  alertOffsets: document.querySelector("#alert-offsets"),
  alertSummary: document.querySelector("#alert-summary"),
  toast: document.querySelector("#toast"),
};

startMatrixBackground();
renderAudioSettings();
renderAlertOffsetOptions();
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

function startMatrixBackground() {
  const canvas = elements.matrixCanvas;
  if (!canvas) return;

  const context = canvas.getContext("2d");
  const glyphs = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
    "\u30a2\u30a4\u30a6\u30a8\u30aa\u30ab\u30ad\u30af\u30b1\u30b3\u30b5\u30b7\u30b9\u30bb\u30bd";
  const fontSize = 18;
  let columns = 0;
  let drops = [];

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * ratio);
    canvas.height = Math.floor(window.innerHeight * ratio);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    columns = Math.ceil(window.innerWidth / fontSize);
    drops = Array.from({ length: columns }, () => Math.random() * -window.innerHeight);
  }

  function draw() {
    context.fillStyle = "rgba(5, 8, 6, 0.16)";
    context.fillRect(0, 0, window.innerWidth, window.innerHeight);
    context.font = `${fontSize}px Consolas, 'Courier New', monospace`;

    for (let index = 0; index < columns; index += 1) {
      const text = glyphs[Math.floor(Math.random() * glyphs.length)];
      const x = index * fontSize;
      const y = drops[index];
      context.fillStyle = Math.random() > 0.975 ? "#d8ffe0" : "#25f06a";
      context.fillText(text, x, y);
      drops[index] += fontSize;

      if (drops[index] > window.innerHeight + fontSize && Math.random() > 0.965) {
        drops[index] = Math.random() * -120;
      }
    }

    window.requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener("resize", resize);
  draw();
}

function loadSelected() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (Array.isArray(saved) && saved.length) {
      return saved.filter((boss) => bosses.includes(boss));
    }
  } catch {
    // 壊れた保存値は初期値で復帰する。
  }
  return bosses;
}

function loadAudioSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    return {
      volume: clampVolume(Number(saved?.volume ?? DEFAULT_AUDIO_SETTINGS.volume)),
      sound: ["bell", "chime", "alert"].includes(saved?.sound) ? saved.sound : DEFAULT_AUDIO_SETTINGS.sound,
      alertOffsets: normalizeAlertOffsets(saved?.alertOffsets),
    };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

function normalizeAlertOffsets(value) {
  const allowed = ALERT_OFFSET_OPTIONS.map((option) => option.minutes);
  const offsets = Array.isArray(value) ? value.map(Number).filter((minutes) => allowed.includes(minutes)) : DEFAULT_AUDIO_SETTINGS.alertOffsets;
  return [...new Set(offsets)].sort((a, b) => b - a);
}

function saveSelected() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected]));
}

function saveAudioSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(audioSettings));
}

function renderAudioSettings() {
  elements.alarmVolume.value = String(audioSettings.volume);
  elements.volumeValue.textContent = `${audioSettings.volume}%`;
  elements.alarmSound.value = audioSettings.sound;
}

function renderAlertOffsetOptions() {
  elements.alertOffsets.innerHTML = "";
  ALERT_OFFSET_OPTIONS.forEach((option) => {
    const label = document.createElement("label");
    label.className = "pill-option";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = audioSettings.alertOffsets.includes(option.minutes);
    input.addEventListener("change", () => {
      if (input.checked) {
        audioSettings.alertOffsets.push(option.minutes);
      } else {
        audioSettings.alertOffsets = audioSettings.alertOffsets.filter((minutes) => minutes !== option.minutes);
      }
      audioSettings.alertOffsets = normalizeAlertOffsets(audioSettings.alertOffsets);
      saveAudioSettings();
      renderAlertSummary();
    });

    const text = document.createElement("span");
    text.textContent = option.label;
    label.append(input, text);
    elements.alertOffsets.append(label);
  });
  renderAlertSummary();
}

function renderAlertSummary() {
  elements.alertSummary.textContent = audioSettings.alertOffsets.length
    ? audioSettings.alertOffsets.map(formatAlertOffset).join(" / ")
    : "通知なし";
}

function renderBossOptions() {
  elements.bossList.innerHTML = "";
  bosses.forEach((boss) => {
    const label = document.createElement("label");
    label.className = "boss-option";

    const name = document.createElement("span");
    name.className = `boss-chip ${getBossColorClass(boss)}`;
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

  elements.testVolume.addEventListener("click", async () => {
    await enableAudio(false);
    playAlarmTone(1.4);
    showToast(`音量テスト: ${audioSettings.volume}% / ${getSoundLabel(audioSettings.sound)}`);
  });

  elements.stopAlarm.addEventListener("click", () => {
    stopAlarmSound();
    showToast("アラームを停止しました。");
  });

  elements.alarmVolume.addEventListener("input", () => {
    audioSettings.volume = clampVolume(Number(elements.alarmVolume.value));
    elements.volumeValue.textContent = `${audioSettings.volume}%`;
    saveAudioSettings();
  });

  elements.alarmSound.addEventListener("change", () => {
    audioSettings.sound = elements.alarmSound.value;
    saveAudioSettings();
    showToast(`アラーム音: ${getSoundLabel(audioSettings.sound)}`);
  });

  elements.notifyToggle.addEventListener("change", async () => {
    if (!elements.notifyToggle.checked) return;
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

  document.querySelectorAll("[data-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      applyPreset(button.dataset.preset);
    });
  });
}

async function enableAudio(playConfirmation = true) {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
  if (playConfirmation) {
    playAlarmTone(0.08);
  }
}

function applyPreset(preset) {
  selected.clear();
  const presetBosses = {
    all: bosses,
    none: [],
    garmoth: ["ガーモス"],
    loml: LOML_BOSSES,
    world: WORLD_BOSSES,
  }[preset] || bosses;

  presetBosses.filter((boss) => bosses.includes(boss)).forEach((boss) => selected.add(boss));
  saveSelected();
  renderBossOptions();
  tick();
  showToast(`プリセットを適用しました: ${getPresetLabel(preset)}`);
}

function tick() {
  const now = new Date();
  elements.currentDate.textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 (${DAYS[now.getDay()]})`;
  elements.currentTime.textContent = formatTime(now);

  const upcoming = getUpcomingEvents(now, 18);
  const next = upcoming[0];
  elements.selectedCount.textContent = `${selected.size} / ${bosses.length} 選択中`;

  if (!next) {
    elements.nextBoss.textContent = "対象なし";
    elements.nextDetail.textContent = "アラームを鳴らすボスを選択してください。";
    elements.nextTime.textContent = "--";
    elements.countdown.textContent = "--:--:--";
    renderUpcoming([], now);
    return;
  }

  const remainingMs = next.date.getTime() - now.getTime();
  elements.nextBoss.innerHTML = renderBossChips(next.bosses);
  elements.nextTime.textContent = `${formatEventDate(next.date)} ${next.time} 出現`;
  elements.nextDetail.textContent = `あと ${formatDuration(remainingMs)} / ${next.bosses.join(" / ")}`;
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
      if (date.getDay() !== event.day) continue;
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
  elements.todayList.innerHTML = "";
  elements.laterList.innerHTML = "";

  const today = upcoming.filter((event) => isSameDate(event.date, now));
  const later = upcoming.filter((event) => !isSameDate(event.date, now));

  elements.todayCount.textContent = `${today.length}件`;
  elements.laterCount.textContent = `${later.length}件`;

  renderEventRows(elements.todayList, today, now, "今日の予定はありません。");
  renderEventRows(elements.laterList, later, now, "明日以降の予定はありません。");
}

function renderEventRows(container, rows, now, emptyText) {
  if (!rows.length) {
    container.innerHTML = `<p class="muted">${emptyText}</p>`;
    return;
  }

  rows.forEach((event) => {
    const row = document.createElement("div");
    row.className = "event-row";

    const time = document.createElement("div");
    time.className = "event-time";
    time.textContent = event.time;

    const bossesText = document.createElement("div");
    bossesText.className = "event-bosses";
    bossesText.innerHTML = renderBossChips(event.bosses);

    const meta = document.createElement("div");
    meta.className = "event-meta";
    meta.textContent = `${formatEventDate(event.date)} あと ${formatDuration(event.date - now)}`;

    row.append(time, bossesText, meta);
    container.append(row);
  });
}

function checkAlerts(upcoming, now) {
  if (!audioSettings.alertOffsets.length) return;

  const nowMs = now.getTime();
  upcoming.forEach((event) => {
    audioSettings.alertOffsets.forEach((minutes) => {
      const alertAt = event.date.getTime() - minutes * 60 * 1000;
      const diff = nowMs - alertAt;
      const key = `${event.date.toISOString()}-${event.bosses.join("+")}-${minutes}`;
      if (diff >= 0 && diff < 1000 && !firedAlerts.has(key)) {
        firedAlerts.add(key);
        fireAlarm(event, formatAlertOffset(minutes));
      }
    });
  });
}

function fireAlarm(event, label) {
  const title = `${event.bosses.join(" / ")} ${label}`;
  const body = `${formatEventDate(event.date)} ${event.time} 出現`;
  showToast(`${title} - ${body}`);
  playAlarmTone(4);

  if (elements.notifyToggle.checked && "Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

function playAlarmTone(seconds) {
  if (!audioContext || audioContext.state !== "running") return;

  stopAlarmSound();
  const start = audioContext.currentTime;
  const gain = audioContext.createGain();
  const volume = Math.max(0.0001, audioSettings.volume / 100);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.32 * volume, start + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  gain.connect(audioContext.destination);
  activeAudioNodes.add(gain);
  window.setTimeout(() => {
    activeAudioNodes.delete(gain);
    try {
      gain.disconnect();
    } catch {
      // 停止済みノードは無視する。
    }
    if (!activeAudioNodes.size) {
      elements.stopAlarm.disabled = true;
    }
  }, seconds * 1000 + 100);

  getSoundPattern(audioSettings.sound).forEach((frequency, index) => {
    const osc = audioContext.createOscillator();
    osc.type = audioSettings.sound === "alert" ? "square" : "sine";
    const noteStart = start + index * 0.12;
    osc.frequency.setValueAtTime(frequency, noteStart);
    osc.connect(gain);
    osc.start(noteStart);
    osc.stop(start + seconds);
    osc.addEventListener("ended", () => {
      activeAudioNodes.delete(osc);
      if (!activeAudioNodes.size) {
        elements.stopAlarm.disabled = true;
      }
    });
    activeAudioNodes.add(osc);
  });

  elements.stopAlarm.disabled = false;
}

function stopAlarmSound() {
  activeAudioNodes.forEach((node) => {
    try {
      if (typeof node.stop === "function") node.stop();
      if (typeof node.disconnect === "function") node.disconnect();
    } catch {
      // 停止済みノードは無視する。
    }
  });
  activeAudioNodes.clear();
  elements.stopAlarm.disabled = true;
}

function getSoundPattern(sound) {
  if (sound === "chime") return [523, 659, 784, 1046];
  if (sound === "alert") return [880, 880, 740, 880, 740];
  return [440, 660, 880];
}

function getSoundLabel(sound) {
  if (sound === "chime") return "チャイム";
  if (sound === "alert") return "警告";
  return "ベル";
}

function getPresetLabel(preset) {
  if (preset === "garmoth") return "ガーモスだけ";
  if (preset === "loml") return "朝鮮ボス";
  if (preset === "world") return "ワールドボス";
  if (preset === "none") return "全部OFF";
  return "全部ON";
}

function getBossColorClass(boss) {
  return `boss-${BOSS_COLORS[boss] || "default"}`;
}

function renderBossChips(bossesForEvent) {
  return bossesForEvent
    .map((boss) => `<span class="boss-chip ${getBossColorClass(boss)}">${boss}</span>`)
    .join("");
}

function formatAlertOffset(minutes) {
  return minutes === 0 ? "ちょうど" : `${minutes}分前`;
}

function clampVolume(value) {
  if (!Number.isFinite(value)) return DEFAULT_AUDIO_SETTINGS.volume;
  return Math.min(100, Math.max(0, Math.round(value)));
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

function isSameDate(left, right) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}
