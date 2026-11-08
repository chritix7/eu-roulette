"use strict";

const $ = id => document.getElementById(id);
const NS = "http://www.w3.org/2000/svg";
const STEP = 360 / 37;

// Clockwise wheel order. Sector 0 is centered at twelve o'clock.
const ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13,
  36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20,
  14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

const RED = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18,
  19, 21, 23, 25, 27, 30, 32, 34, 36
]);

let balance = 1000;
let chip = 10;
let bets = {};
let previousBets = {};
let undoStack = [];
let spinning = false;
let ballAngle = 0;
let ballRadius = 258;
let lastNumber = null;
const results = [];

const definitions = new Map();
const cells = new Map();
const pockets = new Map();
const format = n => n.toLocaleString("en-US");
const clone = value => ({ ...value });

function color(n) {
  return n === 0 ? "green" : RED.has(n) ? "red" : "black";
}

function total(value = bets) {
  return Object.values(value).reduce((sum, amount) => sum + amount, 0);
}

function svgNode(tag, attributes = {}, parent = $("wheel")) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) {
    node.setAttribute(key, value);
  }
  parent.appendChild(node);
  return node;
}

function point(angle, radius) {
  const rad = (angle - 90) * Math.PI / 180;
  return [300 + Math.cos(rad) * radius,
          300 + Math.sin(rad) * radius];
}

function ringPath(start, end, inner, outer) {
  const a = point(start, outer);
  const b = point(end, outer);
  const c = point(end, inner);
  const d = point(start, inner);

  return `M ${a.join(" ")}
    A ${outer} ${outer} 0 0 1 ${b.join(" ")}
    L ${c.join(" ")}
    A ${inner} ${inner} 0 0 0 ${d.join(" ")} Z`;
}

function buildWheel() {
  const root = $("wheel");
  root.innerHTML = "";

  const defs = svgNode("defs", {}, root);

  defs.innerHTML = `
    <linearGradient id="goldRim" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5c4113"/>
      <stop offset=".18" stop-color="#f8e2a4"/>
      <stop offset=".38" stop-color="#8d671f"/>
      <stop offset=".58" stop-color="#ffe9b0"/>
      <stop offset=".78" stop-color="#8a641d"/>
      <stop offset="1" stop-color="#4c350f"/>
    </linearGradient>

    <linearGradient id="goldRim2" x1="1" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7b5a1a"/>
      <stop offset=".25" stop-color="#ffeab2"/>
      <stop offset=".5" stop-color="#9d7622"/>
      <stop offset=".75" stop-color="#f7dd9a"/>
      <stop offset="1" stop-color="#5b3f10"/>
    </linearGradient>

    <radialGradient id="bowl" cx=".38" cy=".28" r=".85">
      <stop offset="0" stop-color="#7a7d84"/>
      <stop offset=".35" stop-color="#2c2f34"/>
      <stop offset=".72" stop-color="#121418"/>
      <stop offset="1" stop-color="#05070a"/>
    </radialGradient>

    <radialGradient id="hub" cx=".35" cy=".28" r=".8">
      <stop offset="0" stop-color="#fff0bd"/>
      <stop offset=".35" stop-color="#c9a052"/>
      <stop offset=".7" stop-color="#6d4f17"/>
      <stop offset="1" stop-color="#2c2009"/>
    </radialGradient>

    <radialGradient id="innerGlass" cx=".35" cy=".25" r=".8">
      <stop offset="0" stop-color="#ffffff2e"/>
      <stop offset=".35" stop-color="#ffffff08"/>
      <stop offset="1" stop-color="#00000055"/>
    </radialGradient>

    <filter id="wood" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.012 0.09"
        numOctaves="4"
        seed="18"
        result="noise"/>
      <feColorMatrix
        in="noise"
        type="matrix"
        values="0 0 0 0 0.18
                0 0 0 0 0.11
                0 0 0 0 0.05
                0 0 0 0.55 0"
        result="grain"/>
      <feComposite in="grain" in2="SourceGraphic"
        operator="in" result="woodGrain"/>
      <feBlend in="SourceGraphic" in2="woodGrain" mode="multiply"/>
    </filter>

    <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="18"/>
    </filter>

        <filter id="rimShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="14" stdDeviation="16"
        flood-color="#000" flood-opacity=".75"/>
    </filter>

    <radialGradient id="pearl" cx=".32" cy=".26" r=".85">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset=".35" stop-color="#f7f2e6"/>
      <stop offset=".72" stop-color="#c9c4ba"/>
      <stop offset="1" stop-color="#6d6a64"/>
    </radialGradient>

        <filter id="ballGlow" x="-80%" y="-80%" width="260%" height="260%">
      <feDropShadow
        dx="0"
        dy="3"
        stdDeviation="2.5"
        flood-color="#000000"
        flood-opacity=".8"/>
      <feGaussianBlur in="SourceGraphic" stdDeviation=".25" result="soft"/>
      <feMerge>
        <feMergeNode in="soft"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

        <filter id="ballMotion" x="-120%" y="-120%" width="340%" height="340%">
      <feGaussianBlur stdDeviation="2.2 0.4"/>
    </filter>
  `;

  // Large golden under-glow.
  svgNode("circle", {
    cx: 300,
    cy: 316,
    r: 292,
    fill: "#d9a83a",
    opacity: .22,
    filter: "url(#softGlow)"
  }, root);

  // Static base shadow.
  svgNode("ellipse", {
    cx: 300,
    cy: 322,
    rx: 286,
    ry: 276,
    fill: "#000",
    opacity: .55,
    filter: "url(#softGlow)"
  }, root);

  // Slowly rotating outer bowl / wooden track.
  const spinner = svgNode("g", {
    class: "wheel-spinner"
  }, root);

  svgNode("circle", {
    cx: 300,
    cy: 300,
    r: 286,
    fill: "url(#goldRim)",
    filter: "url(#rimShadow)"
  }, spinner);

  svgNode("circle", {
    cx: 300,
    cy: 300,
    r: 272,
    fill: "#2a1a0c",
    filter: "url(#wood)"
  }, spinner);

  svgNode("circle", {
    cx: 300,
    cy: 300,
    r: 272,
    fill: "none",
    stroke: "#f7dc9b",
    "stroke-opacity": .22,
    "stroke-width": 2
  }, spinner);

  svgNode("circle", {
    cx: 300,
    cy: 300,
    r: 258,
    fill: "none",
    stroke: "url(#goldRim2)",
    "stroke-width": 13
  }, spinner);

  svgNode("circle", {
    cx: 300,
    cy: 300,
    r: 250,
    fill: "none",
    stroke: "#ffffff",
    "stroke-opacity": .1,
    "stroke-width": 2
  }, spinner);

  // Static pockets and numbers.
  const pocketsGroup = svgNode("g", {
    class: "wheel-pockets"
  }, root);

  const fills = {
    red: "#a72d3b",
    black: "#15181d",
    green: "#14734f"
  };

  ORDER.forEach((number, index) => {
    const middle = index * STEP;
    const start = middle - STEP / 2;
    const end = middle + STEP / 2;

    svgNode("path", {
      d: ringPath(start, end, 201, 241),
      fill: fills[color(number)],
      stroke: "#d8b772",
      "stroke-width": .7
    }, pocketsGroup);

    const pocket = svgNode("path", {
      d: ringPath(start, end, 166, 199),
      fill: fills[color(number)],
      stroke: "#b59c67",
      "stroke-width": 1.5
    }, pocketsGroup);

    pockets.set(number, pocket);

    const [x, y] = point(middle, 220);

    const label = svgNode("text", {
      x,
      y,
      fill: "#fff9ed",
      "font-size": 16,
      "font-weight": 750,
      "text-anchor": "middle",
      "dominant-baseline": "central",
      transform: `rotate(${middle} ${x} ${y})`
    }, pocketsGroup);

    label.textContent = number;
  });

  // Static inner bowl, separators and hub.
  svgNode("circle", {
    cx: 300,
    cy: 300,
    r: 164,
    fill: "url(#bowl)",
    stroke: "url(#goldRim2)",
    "stroke-width": 5
  }, root);

  for (let i = 0; i < 8; i++) {
    const [x, y] = point(i * 45 + 22.5, 139);

    svgNode("rect", {
      x: x - 3,
      y: y - 10,
      width: 6,
      height: 20,
      rx: 2,
      fill: "url(#goldRim2)",
      transform: `rotate(${i * 45 + 22.5} ${x} ${y})`
    }, root);
  }

  svgNode("circle", {
    cx: 300,
    cy: 300,
    r: 90,
    fill: "url(#hub)",
    filter: "url(#rimShadow)"
  }, root);

  svgNode("circle", {
    cx: 300,
    cy: 300,
    r: 68,
    fill: "url(#bowl)",
    stroke: "#f0d39155",
    "stroke-width": 2
  }, root);

  svgNode("circle", {
    cx: 300,
    cy: 300,
    r: 68,
    fill: "url(#innerGlass)"
  }, root);

  const brand = svgNode("text", {
    x: 300,
    y: 305,
    fill: "#f3d795",
    "font-family": "Georgia, serif",
    "font-size": 15,
    "letter-spacing": 2,
    "text-anchor": "middle"
  }, root);

  brand.textContent = "CHRYSION";

    svgNode("ellipse", {
    id: "ball-shadow",
    rx: 9,
    ry: 5,
    fill: "#000000",
    opacity: .55
  }, root);

  svgNode("circle", {
    id: "ball",
    r: 8.5,
    fill: "url(#pearl)",
    stroke: "#ffffff",
    "stroke-width": 1.2,
    filter: "url(#ballGlow)"
  }, root);

    const ball = $("ball");
  ball.style.willChange = "cx, cy";

  positionBall(0, 258);
}

function positionBall(angle, radius) {
  const [x, y] = point(angle, radius);

  $("ball").setAttribute("cx", x);
  $("ball").setAttribute("cy", y);

  const shadowOffset = 4 + (258 - radius) * .025;

  $("ball-shadow").setAttribute("cx", x + 2);
  $("ball-shadow").setAttribute("cy", y + shadowOffset);
}

function addBet(id, label, matches, multiplier, column, row,
                width = 1, height = 1, className = "") {
  definitions.set(id, { label, matches, multiplier });

  const button = document.createElement("button");
  button.type = "button";
  button.className = `bet-cell ${className}`;
  button.dataset.bet = id;
  button.style.gridColumn = `${column} / span ${width}`;
  button.style.gridRow = `${row} / span ${height}`;
  button.setAttribute("aria-label", label);
  button.title = label;

  const text = document.createElement("span");
  text.className = "bet-label";
  text.textContent = label;
  button.appendChild(text);

  $("table").appendChild(button);
  cells.set(id, button);
}

function buildTable() {
  addBet("n0", "0", n => n === 0, 36, 1, 1, 1, 3, "green");

  for (let column = 0; column < 12; column++) {
    for (let row = 0; row < 3; row++) {
      const n = column * 3 + 3 - row;
      addBet(`n${n}`, String(n), value => value === n,
             36, column + 2, row + 1, 1, 1, color(n));
    }
  }

  for (let row = 0; row < 3; row++) {
    const columnNumber = 3 - row;
    addBet(
      `c${columnNumber}`, "2:1",
      n => n > 0 && ((n - 1) % 3) + 1 === columnNumber,
      3, 14, row + 1
    );
  }

  for (let dozen = 1; dozen <= 3; dozen++) {
    addBet(
      `d${dozen}`, ["1st 12", "2nd 12", "3rd 12"][dozen - 1],
      n => n >= (dozen - 1) * 12 + 1 && n <= dozen * 12,
      3, 2 + (dozen - 1) * 4, 4, 4
    );
  }

  const outside = [
    ["low", "1–18", n => n >= 1 && n <= 18, ""],
    ["even", "EVEN", n => n > 0 && n % 2 === 0, ""],
    ["red", "RED", n => RED.has(n), "red"],
    ["black", "BLACK", n => n > 0 && !RED.has(n), "black"],
    ["odd", "ODD", n => n > 0 && n % 2 === 1, ""],
    ["high", "19–36", n => n >= 19 && n <= 36, ""]
  ];

  outside.forEach(([id, label, matches, className], index) => {
    addBet(id, label, matches, 2, 2 + index * 2, 5, 2, 1, className);
  });
}

function buildChips() {
  [5, 10, 25, 50, 100].forEach(value => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip-choice";
    button.dataset.chip = value;
    button.textContent = value;
    button.setAttribute("aria-label", `${value} chips`);
    $("chips").appendChild(button);
  });
}

function message(text) {
  $("hint").textContent = text;
}

function renderBets() {
  for (const [id, cell] of cells) {
    cell.querySelector(".stake")?.remove();
    cell.classList.remove("selected");

    const amount = bets[id] || 0;

    cell.disabled = spinning;
    cell.setAttribute(
      "aria-label",
      `${definitions.get(id).label}. Bet: ${format(amount)}`
    );

    if (amount > 0) {
      cell.classList.add("selected");

      const stack = document.createElement("span");
      stack.className = "stake";

      // Show up to three visible chips, newest on top.
      const values = [100, 50, 25, 10, 5];
      let remaining = amount;
      const visible = [];

      for (const value of values) {
        while (remaining >= value && visible.length < 3) {
          visible.push(value);
          remaining -= value;
        }
      }

      if (remaining > 0 && visible.length < 3) {
        visible.push(remaining);
      }

      visible.forEach(value => {
        const chip = document.createElement("span");
        chip.className = `stake-chip c${value}`;
        chip.textContent = value;
        stack.appendChild(chip);
      });

      cell.appendChild(stack);
    }
  }

  $("balance").textContent = format(balance - total());
  $("total").textContent = format(total());
  $("spin").disabled = spinning || total() === 0;
  $("spin").textContent = spinning ? "SPINNING" : "SPIN";
  $("undo").disabled = spinning || undoStack.length === 0;
  $("clear").disabled = spinning || total() === 0;
  $("double").disabled =
    spinning || total() === 0 || total() * 2 > balance;
  $("rebet").disabled =
    spinning || total() > 0 ||
    total(previousBets) === 0 || total(previousBets) > balance;

  document.querySelectorAll(".chip-choice").forEach(button => {
    button.disabled = spinning;
    button.setAttribute(
      "aria-pressed",
      String(Number(button.dataset.chip) === chip)
    );
  });

  $("status").textContent = spinning ? "NO MORE BETS" : "BETS OPEN";
}

function updatePayoutHints() {
  for (const [id, cell] of cells) {
    const definition = definitions.get(id);
    cell.title = `${definition.label} · Pays ${definition.multiplier}:1`;
  }
}

function commit(next) {
  if (spinning) return;

  if (total(next) > balance) {
    message("Insufficient balance.");
    return;
  }

  undoStack.push(clone(bets));
  bets = next;
  render();
  message("Bets accepted.");
}

// Delegation also handles number buttons created by buildTable().
$("table").addEventListener("click", event => {
  const cell = event.target.closest("button[data-bet]");
  if (!cell || !$("table").contains(cell) || spinning) return;

  const id = cell.dataset.bet;
  commit({ ...bets, [id]: (bets[id] || 0) + chip });
});

$("chips").addEventListener("click", event => {
  const button = event.target.closest("button[data-chip]");
  if (!button || spinning) return;
  chip = Number(button.dataset.chip);
  render();
});

$("undo").addEventListener("click", () => {
  if (spinning || !undoStack.length) return;
  bets = undoStack.pop();
  render();
  message("Last action undone.");
});

$("clear").addEventListener("click", () => {
  if (total()) commit({});
});

$("double").addEventListener("click", () => {
  if (!total()) return;
  commit(Object.fromEntries(
    Object.entries(bets).map(([id, amount]) => [id, amount * 2])
  ));
});

$("rebet").addEventListener("click", () => {
  if (total() || !total(previousBets)) return;
  commit(clone(previousBets));
});

function randomNumber() {
  // Rejection sampling avoids modulo bias.
  const data = new Uint32Array(1);
  const limit = Math.floor(4294967296 / 37) * 37;
  do {
    crypto.getRandomValues(data);
  } while (data[0] >= limit);

  return data[0] % 37;
}

let audio = null;
let rollNoise = null;

function soundContext() {
  if (!audio) {
    audio = new (window.AudioContext || window.webkitAudioContext)({
      latencyHint: "interactive"
    });
  }

  return audio;
}

// Prepare audio as soon as the user interacts with the page.
document.addEventListener(
  "pointerdown",
  () => {
    const context = soundContext();

    if (context.state !== "running") {
      context.resume();
    }
  },
  { once: false }
);

function createRollNoise(context) {
  if (rollNoise) return rollNoise;

  const seconds = 1;
  const length = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);

  let previous = 0;

  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    previous = previous * .96 + white * .04;
    data[i] = previous * 3.2;
  }

  rollNoise = buffer;
  return buffer;
}

let rollSource = null;
let rollGain = null;

function playRoll(duration = 6800) {
  const context = soundContext();

  const start = () => {
    // Stop any previous rolling sound.
    if (rollSource) {
      try {
        rollSource.stop();
      } catch (error) {
        // The previous source may already be stopped.
      }
      rollSource = null;
      rollGain = null;
    }

    const source = context.createBufferSource();
    const lowpass = context.createBiquadFilter();
    const gain = context.createGain();

    source.buffer = createRollNoise(context);
    source.loop = true;

    lowpass.type = "lowpass";
    lowpass.frequency.value = 620;
    lowpass.Q.value = .4;

    const now = context.currentTime;
    const fadeOut = 1.4;

    gain.gain.setValueAtTime(.0001, now);
    gain.gain.linearRampToValueAtTime(.022, now + .5);
    gain.gain.setValueAtTime(.022, now + duration - fadeOut);
    gain.gain.linearRampToValueAtTime(.0001, now + duration);

    source.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(context.destination);

    source.start(now);
    source.stop(now + duration + .05);

    rollSource = source;
    rollGain = gain;
  };

  if (context.state === "running") {
    start();
  } else {
    context.resume().then(start).catch(() => {});
  }
}

function stopRoll() {
  if (!rollSource) return;

  try {
    if (rollGain) {
      const now = audio.currentTime;
      rollGain.gain.cancelScheduledValues(now);
      rollGain.gain.setValueAtTime(rollGain.gain.value, now);
      rollGain.gain.linearRampToValueAtTime(.0001, now + .18);
    }

    rollSource.stop(audio.currentTime + .2);
  } catch (error) {
    // Ignore if the source has already stopped.
  }

  rollSource = null;
  rollGain = null;
}

function playDeflector() {
  const context = soundContext();

  const start = () => {
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(1750 + Math.random() * 500, now);
    osc.frequency.exponentialRampToValueAtTime(720, now + .06);

    gain.gain.setValueAtTime(.0001, now);
    gain.gain.linearRampToValueAtTime(.09, now + .006);
    gain.gain.exponentialRampToValueAtTime(.0001, now + .08);

    osc.connect(gain).connect(context.destination);
    osc.start(now);
    osc.stop(now + .09);
  };

  if (context.state === "running") {
    start();
  } else {
    context.resume().then(start).catch(() => {});
  }
}

function playApproach() {
  const context = soundContext();

  const start = () => {
    const now = context.currentTime;

    // Soft descending roll as the ball leaves the outer track.
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();

    source.buffer = createRollNoise(context);
    source.loop = true;

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1100, now);
    filter.frequency.exponentialRampToValueAtTime(360, now + .55);

    gain.gain.setValueAtTime(.0001, now);
    gain.gain.linearRampToValueAtTime(.028, now + .07);
    gain.gain.setTargetAtTime(.0001, now + .3, .16);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);

    source.start(now);
    source.stop(now + .75);
  };

  if (context.state === "running") {
    start();
  } else {
    context.resume().then(start).catch(() => {});
  }
}

function playImpact() {
  const context = soundContext();

  const start = () => {
    const now = context.currentTime;

    // Felt-like first contact.
    const contact = context.createBufferSource();
    const contactFilter = context.createBiquadFilter();
    const contactGain = context.createGain();

    contact.buffer = createRollNoise(context);
    contactFilter.type = "bandpass";
    contactFilter.frequency.value = 520;
    contactFilter.Q.value = 1.1;

    contactGain.gain.setValueAtTime(.0001, now);
    contactGain.gain.linearRampToValueAtTime(.07, now + .006);
    contactGain.gain.setTargetAtTime(.0001, now + .012, .045);

    contact.connect(contactFilter);
    contactFilter.connect(contactGain);
    contactGain.connect(context.destination);
    contact.start(now);
    contact.stop(now + .22);

    // Warm wooden resonance.
    const wood = context.createOscillator();
    const woodGain = context.createGain();

    wood.type = "sine";
    wood.frequency.setValueAtTime(238, now + .012);
    wood.frequency.exponentialRampToValueAtTime(158, now + .16);

    woodGain.gain.setValueAtTime(.0001, now + .012);
    woodGain.gain.linearRampToValueAtTime(.055, now + .018);
    woodGain.gain.setTargetAtTime(.0001, now + .028, .09);

    wood.connect(woodGain);
    woodGain.connect(context.destination);
    wood.start(now + .012);
    wood.stop(now + .32);

    // Very subtle metallic sparkle.
    const sparkle = context.createOscillator();
    const sparkleGain = context.createGain();
    const sparkleFilter = context.createBiquadFilter();

    sparkle.type = "triangle";
    sparkle.frequency.setValueAtTime(2450, now + .022);
    sparkle.frequency.exponentialRampToValueAtTime(1480, now + .1);

    sparkleFilter.type = "bandpass";
    sparkleFilter.frequency.value = 2200;
    sparkleFilter.Q.value = 2.2;

    sparkleGain.gain.setValueAtTime(.0001, now + .022);
    sparkleGain.gain.linearRampToValueAtTime(.022, now + .027);
    sparkleGain.gain.setTargetAtTime(.0001, now + .032, .07);

    sparkle.connect(sparkleFilter);
    sparkleFilter.connect(sparkleGain);
    sparkleGain.connect(context.destination);
    sparkle.start(now + .022);
    sparkle.stop(now + .24);
  };

  if (context.state === "running") {
    start();
  } else {
    context.resume().then(start).catch(() => {});
  }
}

function playWin() {
  const context = soundContext();

  const start = () => {
    const now = context.currentTime;

    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      const osc = context.createOscillator();
      const gain = context.createGain();
      const time = now + index * .08;

      osc.type = "triangle";
      osc.frequency.value = frequency;

      gain.gain.setValueAtTime(.0001, time);
      gain.gain.linearRampToValueAtTime(.07, time + .015);
      gain.gain.exponentialRampToValueAtTime(.0001, time + .5);

      osc.connect(gain).connect(context.destination);
      osc.start(time);
      osc.stop(time + .55);
    });
  };

  if (context.state === "running") {
    start();
  } else {
    context.resume().then(start).catch(() => {});
  }
}

function animateBall(number) {
  return new Promise(resolve => {
    const index = ORDER.indexOf(number);
    const target = index * STEP;

    const current = ((ballAngle % 360) + 360) % 360;
    const delta = (target - current + 360) % 360;

    const startAngle = ballAngle;
    const endAngle = startAngle + 360 * 7 + delta;

    const startRadius = ballRadius;
    const trackRadius = 258;
    const pocketRadius = 182.5;

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 500 : 6800;
    const startTime = performance.now();

    const ball = $("ball");
    let lastDeflector = -1;
    let approachPlayed = false;

    if (!reduced) {
      ball.setAttribute("filter", "url(#ballMotion)");
    }

    playRoll(duration);

    function frame(now) {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);

      const eased = 1 - Math.pow(1 - t, 2.35);
      const angle = startAngle + (endAngle - startAngle) * eased;

      let radius;

      if (t < .16) {
        const k = t / .16;
        radius = startRadius + (trackRadius - startRadius) * k;
      } else if (t < .62) {
        radius = trackRadius;
      } else if (t < .84) {
        const k = (t - .62) / .22;
        const smooth = k * k * (3 - 2 * k);

        radius = trackRadius + (196 - trackRadius) * smooth;
        radius += Math.sin(k * Math.PI * 3) * 7 * (1 - k);
      } else {
        const k = (t - .84) / .16;
        const smooth = k * k * (3 - 2 * k);

        radius = 196 + (pocketRadius - 196) * smooth;
        radius += Math.sin(k * Math.PI * 2) * 4 * (1 - k);
      }

      positionBall(angle, radius);

      if (!reduced) {
        if (t < .55) {
          ball.setAttribute("filter", "url(#ballMotion)");
        } else {
          ball.setAttribute("filter", "url(#ballGlow)");
        }
      }

            if (!reduced && t >= .58) {
        const deflectorIndex = Math.floor((t - .58) / .08);

        if (deflectorIndex > lastDeflector && deflectorIndex < 2) {
          lastDeflector = deflectorIndex;
          playDeflector();
        }
      }

      if (!reduced && t >= .8 && !approachPlayed) {
        approachPlayed = true;
        playApproach();
      }

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        ballAngle = target;
        ballRadius = pocketRadius;

        positionBall(ballAngle, ballRadius);
        ball.setAttribute("filter", "url(#ballGlow)");

        stopRoll();
        playImpact();
        pulsePocket(number);

        resolve();
      }
    }

    requestAnimationFrame(frame);
  });
}

function pulsePocket(number) {
  const pocket = pockets.get(number);

  if (!pocket) return;

  pocket.classList.add("winning");

  setTimeout(() => {
    pocket.classList.remove("winning");
  }, 2000);
}

function showResult(number, net) {
  const badge = $("result-number");
  badge.className = `result-number ${color(number)}`;
  badge.textContent = number;

  if (net > 0) {
    playWin();
  }

  const colorName = number === 0 ? "GREEN" : color(number).toUpperCase();

  $("result").textContent = `${number} ${colorName} · ${
    net > 0 ? `NET WIN +${format(net)}` :
    net === 0 ? "BREAK EVEN" : `NET LOSS ${format(-net)}`
  }`;

  $("net").textContent = `${net > 0 ? "+" : ""}${format(net)}`;

  for (const [id, cell] of cells) {
    cell.classList.toggle("winner", id === `n${number}`);
  }

  for (const [value, pocket] of pockets) {
    pocket.setAttribute("stroke", value === number ? "#fff2bd" : "#b59c67");
    pocket.setAttribute("stroke-width", value === number ? 3 : 1.5);
  }

  results.unshift(number);
  results.splice(12);
  $("history").replaceChildren();

  results.forEach(value => {
    const item = document.createElement("span");
    item.className = color(value);
    item.textContent = value;
    $("history").appendChild(item);
  });

  lastNumber = number;
}

$("spin").addEventListener("click", async () => {
  if (spinning || total() === 0 || total() > balance) return;

  const roundBets = clone(bets);
  const stake = total(roundBets);
  const number = randomNumber();

  spinning = true;
  message("Ball in play.");
  $("table").classList.add("ball-in-play");
  $("result").textContent = "Ball in play";
  render();

  await animateBall(number);

  let returned = 0;
  for (const [id, amount] of Object.entries(roundBets)) {
    const definition = definitions.get(id);
    if (definition.matches(number)) {
      returned += amount * definition.multiplier;
    }
  }

  balance = balance - stake + returned;
  previousBets = roundBets;
  bets = {};
  undoStack = [];
  spinning = false;

  $("table").classList.remove("ball-in-play");
  showResult(number, returned - stake);
  render();
  message(balance < 5
    ? "Balance too low for the minimum chip."
    : "Place your bets. Rebet repeats your last round.");
});

buildWheel();
buildTable();
buildChips();
renderBets();
updatePayoutHints();