const DAYS = ["日", "月", "火", "水", "木", "金", "土"];
const STORAGE_KEY = "bdo-boss-timer-selected-v1";
const SETTINGS_KEY = "bdo-boss-timer-audio-settings-v2";
const HISTORY_KEY = "bdo-boss-timer-history-v1";
const LAST_SEEN_KEY = "bdo-boss-timer-last-seen-v1";
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
const alarmHistory = loadAlarmHistory();
const firedAlerts = new Set();
const activeAudioNodes = new Set();

let audioContext = null;
let toastTimer = 0;

const elements = {
  currentDate: document.querySelector("#current-date"),
  currentTime: document.querySelector("#current-time"),
  nextBoss: document.querySelector("#next-boss"),
  nextDetail: document.querySelector("#next-detail"),
  nextTime: document.querySelector("#next-time"),
  countdown: document.querySelector("#countdown"),
  bossList: document.querySelector("#boss-list"),
  todayList: document.querySelector("#today-list"),
  laterList: document.querySelector("#later-list"),
  alarmList: document.querySelector("#alarm-list"),
  historyList: document.querySelector("#history-list"),
  todayCount: document.querySelector("#today-count"),
  laterCount: document.querySelector("#later-count"),
  alarmCount: document.querySelector("#alarm-count"),
  selectedCount: document.querySelector("#selected-count"),
  enableAudio: document.querySelector("#enable-audio"),
  testVolume: document.querySelector("#test-volume"),
  stopAlarm: document.querySelector("#stop-alarm"),
  resetSettings: document.querySelector("#reset-settings"),
  exportSettings: document.querySelector("#export-settings"),
  alarmVolume: document.querySelector("#alarm-volume"),
  volumeValue: document.querySelector("#volume-value"),
  alarmSound: document.querySelector("#alarm-sound"),
  notifyToggle: document.querySelector("#notify-toggle"),
  alertOffsets: document.querySelector("#alert-offsets"),
  alertSummary: document.querySelector("#alert-summary"),
  audioStatus: document.querySelector("#audio-status"),
  notificationStatus: document.querySelector("#notification-status"),
  alarmStatus: document.querySelector("#alarm-status"),
  missedStatus: document.querySelector("#missed-status"),
  clearHistory: document.querySelector("#clear-history"),
  toast: document.querySelector("#toast"),
};

renderAudioSettings();
renderAlertOffsetOptions();
renderBossOptions();
renderHistory();
checkMissedEvents();
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

function loadAlarmHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(saved) ? saved.slice(0, 30) : [];
  } catch {
    return [];
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

function saveAlarmHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(alarmHistory.slice(0, 30)));
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

  elements.resetSettings.addEventListener("click", () => {
    selected.clear();
    bosses.forEach((boss) => selected.add(boss));
    audioSettings.volume = DEFAULT_AUDIO_SETTINGS.volume;
    audioSettings.sound = DEFAULT_AUDIO_SETTINGS.sound;
    audioSettings.alertOffsets = [...DEFAULT_AUDIO_SETTINGS.alertOffsets];
    saveSelected();
    saveAudioSettings();
    renderAudioSettings();
    renderAlertOffsetOptions();
    renderBossOptions();
    tick();
    showToast("設定を初期状態に戻しました。");
  });

  elements.exportSettings.addEventListener("click", async () => {
    const snapshot = JSON.stringify({
      selectedBosses: [...selected],
      audioSettings,
      exportedAt: new Date().toISOString(),
    }, null, 2);
    try {
      await navigator.clipboard.writeText(snapshot);
      showToast("設定をクリップボードにコピーしました。");
    } catch {
      showToast("設定コピーに失敗しました。ブラウザの権限を確認してください。");
    }
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
    if (!window.Notification) {
      elements.notifyToggle.checked = false;
      showToast("このブラウザでは通知を使えません。");
      return;
    }
    const permission = await window.Notification.requestPermission();
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

  elements.clearHistory.addEventListener("click", () => {
    alarmHistory.splice(0);
    saveAlarmHistory();
    renderHistory();
    showToast("アラーム履歴を消去しました。");
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
  const upcomingAlarms = getUpcomingAlarms(now, 8);
  const next = upcoming[0];
  elements.selectedCount.textContent = `${selected.size} / ${bosses.length} 選択中`;
  updateStatus(upcomingAlarms);

  if (!next) {
    elements.nextBoss.textContent = "対象なし";
    elements.nextDetail.textContent = "アラームを鳴らすボスを選択してください。";
    elements.nextTime.textContent = "--";
    elements.countdown.textContent = "--:--:--";
    renderUpcoming([], now);
    renderUpcomingAlarms([]);
    return;
  }

  const remainingMs = next.date.getTime() - now.getTime();
  elements.nextBoss.innerHTML = renderBossChips(next.bosses);
  elements.nextTime.textContent = `${formatEventDate(next.date)} ${next.time} 出現`;
  elements.nextDetail.textContent = `あと ${formatDuration(remainingMs)} / ${next.bosses.join(" / ")}`;
  elements.countdown.textContent = formatDuration(Math.max(0, remainingMs));
  renderUpcoming(upcoming, now);
  renderUpcomingAlarms(upcomingAlarms);
  checkAlerts(upcoming, now);
  localStorage.setItem(LAST_SEEN_KEY, String(now.getTime()));
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

function getUpcomingAlarms(now, limit) {
  if (!audioSettings.alertOffsets.length) return [];

  const rows = [];
  getUpcomingEvents(now, 24).forEach((event) => {
    audioSettings.alertOffsets.forEach((minutes) => {
      const date = new Date(event.date.getTime() - minutes * 60 * 1000);
      if (date.getTime() >= now.getTime() - 1000) {
        rows.push({ ...event, alertDate: date, alertLabel: formatAlertOffset(minutes) });
      }
    });
  });
  return rows.sort((a, b) => a.alertDate - b.alertDate).slice(0, limit);
}

function renderUpcomingAlarms(alarms) {
  elements.alarmList.innerHTML = "";
  elements.alarmCount.textContent = `${alarms.length}件`;
  if (!alarms.length) {
    elements.alarmList.innerHTML = `<p class="muted">鳴る予定のアラームはありません。</p>`;
    return;
  }

  alarms.forEach((alarm) => {
    const row = document.createElement("div");
    row.className = "event-row";

    const time = document.createElement("div");
    time.className = "event-time";
    time.textContent = formatTime(alarm.alertDate).slice(0, 5);

    const bossesText = document.createElement("div");
    bossesText.className = "event-bosses";
    bossesText.innerHTML = renderBossChips(alarm.bosses);

    const meta = document.createElement("div");
    meta.className = "event-meta";
    meta.textContent = `${alarm.alertLabel} / ${formatEventDate(alarm.date)} ${alarm.time}`;

    row.append(time, bossesText, meta);
    elements.alarmList.append(row);
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
  recordAlarm(title, body, label);
  playAlarmTone(4);

  if (elements.notifyToggle.checked && window.Notification && window.Notification.permission === "granted") {
    new window.Notification(title, { body });
  }
}

function recordAlarm(title, body, label) {
  alarmHistory.unshift({
    title,
    body,
    label,
    at: new Date().toISOString(),
  });
  alarmHistory.splice(30);
  saveAlarmHistory();
  renderHistory();
}

function renderHistory() {
  elements.historyList.innerHTML = "";
  if (!alarmHistory.length) {
    elements.historyList.innerHTML = `<p class="muted">履歴はまだありません。</p>`;
    return;
  }

  alarmHistory.slice(0, 10).forEach((entry) => {
    const row = document.createElement("div");
    row.className = "history-row";
    const at = new Date(entry.at);
    row.innerHTML = `
      <span>${formatEventDate(at)} ${formatTime(at).slice(0, 5)}</span>
      <strong>${escapeHtml(entry.title)}</strong>
      <span>${escapeHtml(entry.body)}</span>
    `;
    elements.historyList.append(row);
  });
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

function checkMissedEvents() {
  const lastSeen = Number(localStorage.getItem(LAST_SEEN_KEY) || Date.now());
  const now = Date.now();
  if (!Number.isFinite(lastSeen) || now - lastSeen < 10 * 60 * 1000) {
    elements.missedStatus.textContent = "逃し通知: なし";
    return;
  }

  const missed = events.filter((event) => {
    const eventDate = getMostRecentEventDate(event, new Date(now));
    return eventDate && eventDate.getTime() > lastSeen && eventDate.getTime() < now
      && event.bosses.some((boss) => selected.has(boss));
  });

  if (!missed.length) {
    elements.missedStatus.textContent = "逃し通知: なし";
    return;
  }

  elements.missedStatus.textContent = `逃し通知: ${missed.length}件`;
  elements.missedStatus.classList.add("warn");
  showToast(`前回起動後に ${missed.length} 件のボス予定が過ぎています。`);
}

function getMostRecentEventDate(event, now) {
  for (let offset = 0; offset < 8; offset += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - offset);
    if (date.getDay() !== event.day) continue;
    date.setHours(event.hour, event.minute, 0, 0);
    return date;
  }
  return null;
}

function updateStatus(upcomingAlarms) {
  const audioReady = Boolean(audioContext && audioContext.state === "running");
  elements.audioStatus.textContent = `音声: ${audioReady ? "有効" : "未有効"}`;
  elements.audioStatus.classList.toggle("ready", audioReady);
  elements.audioStatus.classList.toggle("warn", !audioReady);

  const notificationState = window.Notification ? window.Notification.permission : "unsupported";
  const notificationLabel = notificationState === "granted" ? "許可済み" : notificationState === "denied" ? "拒否" : notificationState === "unsupported" ? "非対応" : "未許可";
  elements.notificationStatus.textContent = `通知: ${notificationLabel}`;
  elements.notificationStatus.classList.toggle("ready", notificationState === "granted");

  if (upcomingAlarms.length) {
    const nextAlarm = upcomingAlarms[0];
    elements.alarmStatus.textContent = `次回通知: ${formatTime(nextAlarm.alertDate).slice(0, 5)} ${nextAlarm.bosses.join(" / ")}`;
    elements.alarmStatus.classList.add("ready");
  } else {
    elements.alarmStatus.textContent = "次回通知: なし";
    elements.alarmStatus.classList.remove("ready");
  }
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
