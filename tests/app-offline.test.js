const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");

const results = [];

function test(name, fn) {
  try {
    fn();
    results.push({ name, status: "PASS" });
  } catch (error) {
    results.push({ name, status: "FAIL", message: error.message });
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function querySelector(selector) {
  const idMatch = selector.match(/^#([\w-]+)$/);
  if (idMatch) {
    return createElement(idMatch[1]);
  }
  if (selector === ".source-table img") {
    return {
      getAttribute(name) {
        return name === "src" ? "assets/boss-schedule.png" : null;
      },
    };
  }
  return createElement(selector);
}

function createElement(id) {
  return {
    id,
    className: "",
    checked: false,
    disabled: false,
    innerHTML: "",
    textContent: "",
    style: {},
    classList: {
      add() {},
      remove() {},
    },
    append() {},
    addEventListener() {},
    getContext() {
      return {
        setTransform() {},
        fillRect() {},
        fillText() {},
        fillStyle: "",
        font: "",
      };
    },
  };
}

const intervalCallbacks = [];
const timeoutCallbacks = [];
const context = {
  console,
  Date,
  Math,
  Set,
  Array,
  JSON,
  localStorage: {
    getItem() {
      return null;
    },
    setItem() {},
  },
  document: {
    querySelector,
    createElement() {
      return createElement("created");
    },
    querySelectorAll() {
      return [];
    },
  },
  window: {
    devicePixelRatio: 1,
    innerWidth: 1280,
    innerHeight: 720,
    addEventListener() {},
    requestAnimationFrame() {},
    setInterval(fn) {
      intervalCallbacks.push(fn);
      return intervalCallbacks.length;
    },
    clearInterval() {},
    setTimeout(fn) {
      timeoutCallbacks.push(fn);
      return timeoutCallbacks.length;
    },
    clearTimeout() {},
    AudioContext: function AudioContext() {
      this.state = "running";
      this.currentTime = 0;
      this.resume = async () => {};
      this.createGain = () => ({
        gain: {
          setValueAtTime() {},
          exponentialRampToValueAtTime() {},
        },
        connect() {},
      });
      this.createOscillator = () => ({
        frequency: { setValueAtTime() {} },
        type: "sine",
        connect() {},
        start() {},
        stop() {},
      });
      this.destination = {};
    },
  },
  Notification: undefined,
};

context.window.window = context.window;
context.window.document = context.document;
context.window.localStorage = context.localStorage;
context.window.Notification = context.Notification;
context.window.requestAnimationFrame = context.window.requestAnimationFrame;
context.window.setInterval = context.window.setInterval;
context.window.clearInterval = context.window.clearInterval;
context.window.setTimeout = context.window.setTimeout;
context.window.clearTimeout = context.window.clearTimeout;

vm.createContext(context);
vm.runInContext(`${appJs}\nthis.__testState = { events, ALERT_OFFSETS };`, context, { filename: "app.js" });

test("HTML includes required application controls", () => {
  [
    'id="matrix-bg"',
    'id="next-boss"',
    'id="countdown"',
    'id="enable-audio"',
    'id="test-volume"',
    'id="alarm-volume"',
    'id="alarm-sound"',
    'id="notify-toggle"',
    'id="boss-list"',
    'id="upcoming-list"',
  ].forEach((needle) => assert(html.includes(needle), `${needle} is missing`));
});

test("Offline assets are present and referenced", () => {
  assert(fs.existsSync(path.join(root, "assets", "boss-schedule.png")), "boss schedule image is missing");
  assert(fs.existsSync(path.join(root, "assets", "app-icon.svg")), "SVG icon is missing");
  assert(fs.existsSync(path.join(root, "assets", "app-icon.ico")), "ICO icon is missing");
  assert(html.includes('href="assets/app-icon.svg"'), "favicon does not use local SVG");
  assert(html.includes('src="assets/boss-schedule.png"'), "source table does not use local image");
});

test("Matrix rain background is configured locally", () => {
  assert(css.includes(".matrix-bg"), "matrix background CSS is missing");
  assert(appJs.includes("startMatrixBackground"), "matrix background script is missing");
  assert(!css.includes("url(\"assets/boss-schedule.png\")"), "schedule image should not be used as page background");
});

test("Boss schedule contains expected Garmoth slots", () => {
  const garmothEvents = context.__testState.events.filter((event) => event.bosses.includes("ガーモス"));
  const slots = garmothEvents.map((event) => `${event.day}:${event.time}`).sort();
  [
    "0:0:15",
    "1:0:15",
    "1:14:00",
    "1:20:00",
    "2:14:00",
    "2:20:00",
    "3:0:15",
    "3:14:00",
    "3:20:00",
    "4:14:00",
    "5:0:15",
    "5:14:00",
    "5:20:00",
    "6:14:00",
  ].forEach((slot) => assert(slots.includes(slot), `missing Garmoth slot ${slot}`));
});

test("All alarm offsets are configured", () => {
  const offsets = context.__testState.ALERT_OFFSETS.map((offset) => offset.minutes).sort((a, b) => a - b);
  assert(JSON.stringify(offsets) === JSON.stringify([0, 5, 15]), "alarm offsets should be 0, 5, and 15 minutes");
});

test("Alarm volume and sound selection are implemented", () => {
  assert(html.includes('id="alarm-volume"'), "alarm volume control is missing");
  assert(html.includes('id="alarm-sound"'), "alarm sound selector is missing");
  assert(html.includes('id="test-volume"'), "volume test button is missing");
  assert(appJs.includes("DEFAULT_AUDIO_SETTINGS"), "default audio settings are missing");
  assert(appJs.includes("getSoundPattern"), "sound pattern selection is missing");
  assert(appJs.includes("audioSettings.volume / 100"), "alarm volume is not applied to playback");
});

const failed = results.filter((result) => result.status === "FAIL");
for (const result of results) {
  const suffix = result.message ? ` - ${result.message}` : "";
  console.log(`${result.status}: ${result.name}${suffix}`);
}

if (failed.length) {
  process.exitCode = 1;
}
