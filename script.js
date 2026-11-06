const numbers = Array.from({ length: 37 }, (_, i) => i);

const redNumbers = new Set([
  1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36
]);

const wheel = document.getElementById("wheel");
const deflectors = document.getElementById("deflectors");
const ballOrbit = document.getElementById("ball-orbit");
const resultEl = document.getElementById("result");
const balanceEl = document.getElementById("balance");
const spinButton = document.getElementById("spin");
const clearButton = document.getElementById("clear");
const resetButton = document.getElementById("reset");
const historyList = document.getElementById("history-list");
const activeBetEl = document.getElementById("active-bet");
const numbersGrid = document.getElementById("numbers-grid");

const SVG_NS = "http://www.w3.org/2000/svg";
const CENTER = 250;
const OUTER_RADIUS = 238;
const NUMBER_RADIUS = 198;
const INNER_RADIUS = 150;

let balance = 1000;
let selectedChip = 10;
let bets = [];
let ballRotation = 0;
let spinning = false;
const history = [];

const format = n => n.toLocaleString("fr-FR");

function colorOf(n) {
  if (n === 0) return "green";
  return redNumbers.has(n) ? "red" : "black";
}

function polar(angle, radius) {
  const rad = (angle - 90) * Math.PI / 180;
  return {
    x: CENTER + radius * Math.cos(rad),
    y: CENTER + radius * Math.sin(rad)
  };
}

function createSvgElement(tag, attributes) {
  const element = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  return element;
}

function buildWheel() {
  wheel.innerHTML = "";
  const sectorAngle = 360 / numbers.length;

  wheel.appendChild(createSvgElement("circle", {
    cx: CENTER,
    cy: CENTER,
    r: OUTER_RADIUS,
    fill: "#201809"
  }));

  numbers.forEach((number, index) => {
    const start = index * sectorAngle;
    const end = start + sectorAngle;

    const so = polar(start, OUTER_RADIUS);
    const eo = polar(end, OUTER_RADIUS);
    const ei = polar(end, INNER_RADIUS);
    const si = polar(start, INNER_RADIUS);

    wheel.appendChild(createSvgElement("path", {
      d: [
        `M ${so.x} ${so.y}`,
        `A ${OUTER_RADIUS} ${OUTER_RADIUS} 0 0 1 ${eo.x} ${eo.y}`,
        `L ${ei.x} ${ei.y}`,
        `A ${INNER_RADIUS} ${INNER_RADIUS} 0 0 0 ${si.x} ${si.y}`,
        "Z"
      ].join(" "),
      fill: colorOf(number) === "red" ? "#a91f2a"
        : colorOf(number) === "green" ? "#0b6d38"
        : "#0e0e11",
      stroke: "rgba(212,175,55,.7)",
      "stroke-width": "1.1"
    }));

    const labelAngle = start + sectorAngle / 2;
    const pos = polar(labelAngle, NUMBER_RADIUS);

    const text = createSvgElement("text", {
      x: pos.x,
      y: pos.y,
      fill: "#fff",
      "font-size": "17",
      "font-weight": "800",
      "text-anchor": "middle",
      "dominant-baseline": "middle",
      transform: `rotate(${labelAngle} ${pos.x} ${pos.y})`,
      style: "font-family: Inter, sans-serif; paint-order: stroke; stroke: rgba(0,0,0,.6); stroke-width: 3px;"
    });

    text.textContent = number;
    wheel.appendChild(text);
  });

  wheel.appendChild(createSvgElement("circle", {
    cx: CENTER,
    cy: CENTER,
    r: INNER_RADIUS,
    fill: "none",
    stroke: "rgba(212,175,55,.9)",
    "stroke-width": "6"
  }));
}

function buildDeflectors() {
  deflectors.innerHTML = "";

  for (let i = 0; i < 8; i++) {
    const deflector = document.createElement("div");
    deflector.className = "deflector";
    deflector.style.transform = `
      translate(-50%, -50%)
      rotate(${i * 45 + 22.5}deg)
      translateY(-118px)
    `;
    deflectors.appendChild(deflector);
  }
}

function buildBettingBoard() {
  numbersGrid.innerHTML = "";

  for (let row = 0; row < 12; row++) {
    for (let column = 0; column < 3; column++) {
      const number = row * 3 + column + 1;
      const cell = document.createElement("button");

      cell.className = `table-cell ${colorOf(number)}`;
      cell.dataset.bet = "number";
      cell.dataset.number = number;
      cell.textContent = number;

      numbersGrid.appendChild(cell);
    }
  }
}

function betKey(bet) {
  return `${bet.type}-${bet.value ?? ""}`;
}

function betLabel(bet) {
  if (bet.type === "number") return `Numéro ${bet.value}`;
  if (bet.type === "red") return "Rouge";
  if (bet.type === "black") return "Noir";
  if (bet.type === "even") return "Pair";
  if (bet.type === "odd") return "Impair";
  if (bet.type === "low") return "1 – 18";
  if (bet.type === "high") return "19 – 36";
  if (bet.type === "dozen") return `${bet.value}${bet.value === 1 ? "re" : "e"} douzaine`;
  if (bet.type === "column") return `Colonne ${bet.value}`;
  return "Mise";
}

function totalBet() {
  return bets.reduce((sum, bet) => sum + bet.amount, 0);
}

function updateActiveBet() {
  if (bets.length === 0) {
    activeBetEl.textContent = "Aucune mise placée";
    return;
  }

  activeBetEl.textContent =
    `${bets.length} mise${bets.length > 1 ? "s" : ""} · Total : ${format(totalBet())} jetons`;
}

function renderBets() {
  document.querySelectorAll(".table-cell").forEach(cell => {
    cell.classList.remove("selected");
    const oldChip = cell.querySelector(".bet-chip");
    if (oldChip) oldChip.remove();
  });

  bets.forEach(bet => {
    const selector = bet.type === "number"
      ? `[data-number="${bet.value}"]`
      : bet.type === "dozen"
        ? `[data-dozen="${bet.value}"]`
        : bet.type === "column"
          ? `[data-column="${bet.value}"]`
          : `[data-bet="${bet.type}"]`;

    const cell = document.querySelector(selector);
    if (!cell) return;

    cell.classList.add("selected");

    const chip = document.createElement("span");
    chip.className = "bet-chip";
    chip.textContent = bet.amount;
    cell.appendChild(chip);
  });

  updateActiveBet();
}

function placeBet(cell) {
  const type = cell.dataset.bet;
  const value =
    cell.dataset.number ??
    cell.dataset.dozen ??
    cell.dataset.column ??
    null;

  const key = `${type}-${value ?? ""}`;
  const existing = bets.find(bet => betKey(bet) === key);

  if (existing) {
    existing.amount += selectedChip;
  } else {
    bets.push({ type, value, amount: selectedChip });
  }

  renderBets();
}

function payoutForBet(bet, number) {
  const amount = bet.amount;

  if (bet.type === "number") {
    return Number(bet.value) === number ? amount * 36 : 0;
  }

  if (bet.type === "column") {
    const column = Number(bet.value);
    const matches = number !== 0 && number % 3 === column % 3;
    return matches ? amount * 3 : 0;
  }

  if (bet.type === "dozen") {
    const dozen = Number(bet.value);
    const matches = number >= (dozen - 1) * 12 + 1 && number <= dozen * 12;
    return matches ? amount * 3 : 0;
  }

  if (number === 0) return 0;

  const rules = {
    red: colorOf(number) === "red",
    black: colorOf(number) === "black",
    even: number % 2 === 0,
    odd: number % 2 === 1,
    low: number <= 18,
    high: number >= 19
  };

  return rules[bet.type] ? amount * 2 : 0;
}

function addHistory(number) {
  history.unshift(number);
  if (history.length > 16) history.pop();

  historyList.innerHTML = "";

  history.forEach(value => {
    const chip = document.createElement("div");
    chip.className = `chip ${colorOf(value)}`;
    chip.textContent = value;
    historyList.appendChild(chip);
  });
}

document.querySelectorAll(".chip-btn").forEach(button => {
  button.addEventListener("click", () => {
    selectedChip = Number(button.dataset.chip);

    document.querySelectorAll(".chip-btn").forEach(item => {
      item.classList.toggle("active", item === button);
    });
  });
});

document.querySelectorAll(".table-cell").forEach(cell => {
  cell.addEventListener("click", () => {
    if (spinning) return;
    placeBet(cell);
  });
});

clearButton.addEventListener("click", () => {
  if (spinning) return;
  bets = [];
  renderBets();
});

spinButton.addEventListener("click", () => {
  if (spinning) return;

  const amount = totalBet();

  if (bets.length === 0) {
    resultEl.textContent = "Placez au moins un jeton sur le tapis.";
    return;
  }

  if (amount > balance) {
    resultEl.textContent = "Solde insuffisant pour cette mise.";
    return;
  }

  spinning = true;
  spinButton.disabled = true;
  balance -= amount;
  balanceEl.textContent = format(balance);
  resultEl.textContent = "La bille tourne…";

  const winningNumber = Math.floor(Math.random() * 37);
  const sectorAngle = 360 / 37;

  const currentMod = ((ballRotation % 360) + 360) % 360;
  const targetMod = (winningNumber * sectorAngle) % 360;
  let delta = targetMod - currentMod;

  if (delta < 0) delta += 360;

  ballRotation += 2160 + delta;
  ballOrbit.style.transform = `rotate(${ballRotation}deg)`;

  setTimeout(() => {
    const totalGain = bets.reduce(
      (sum, bet) => sum + payoutForBet(bet, winningNumber),
      0
    );

    balance += totalGain;
    balanceEl.textContent = format(balance);

    const colorName = {
      red: "Rouge",
      black: "Noir",
      green: "Zéro"
    }[colorOf(winningNumber)];

    resultEl.textContent = `La bille s’arrête sur ${winningNumber} · ${colorName}`;
    addHistory(winningNumber);

    if (totalGain > 0) {
      resultEl.textContent += ` — Gain total : ${format(totalGain)} jetons`;
    } else {
      resultEl.textContent += " — Aucun gain";
    }

    bets = [];
    renderBets();

    spinning = false;
    spinButton.disabled = false;

    if (balance < 1) {
      resultEl.textContent = "Plus de jetons. Réinitialisez la table.";
      spinButton.disabled = true;
    }
  }, 6600);
});

resetButton.addEventListener("click", () => {
  balance = 1000;
  bets = [];
  history.length = 0;
  historyList.innerHTML = "";
  balanceEl.textContent = format(balance);
  resultEl.textContent = "Nouvelle partie — placez vos jetons";
  spinButton.disabled = false;
  renderBets();
});

buildWheel();
buildDeflectors();
buildBettingBoard();
renderBets();