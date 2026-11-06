const numbers = Array.from({ length: 37 }, (_, i) => i);

const redNumbers = new Set([
  1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36
]);

const wheel = document.getElementById("wheel");
const ball = document.getElementById("ball");
const resultEl = document.getElementById("result");
const balanceEl = document.getElementById("balance");
const spinButton = document.getElementById("spin");
const resetButton = document.getElementById("reset");
const historyList = document.getElementById("history-list");
const activeBetEl = document.getElementById("active-bet");
const numbersGrid = document.getElementById("numbers-grid");

const SVG_NS = "http://www.w3.org/2000/svg";
const CENTER = 250;
const OUTER_RADIUS = 245;
const NUMBER_RADIUS = 205;
const INNER_RADIUS = 155;

let balance = 1000;
let selectedChip = 10;
let bets = [];
let wheelRotation = 0;
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
    fill: "#1b1508"
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
      fill: colorOf(number) === "red" ? "#b3202c"
        : colorOf(number) === "green" ? "#0d7a3f"
        : "#101013",
      stroke: "rgba(212,175,55,.75)",
      "stroke-width": "1.2"
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
      style: "font-family: Inter, sans-serif; paint-order: stroke; stroke: rgba(0,0,0,.55); stroke-width: 3px;"
    });

    text.textContent = number;
    wheel.appendChild(text);
  });

  wheel.appendChild(createSvgElement("circle", {
    cx: CENTER,
    cy: CENTER,
    r: INNER_RADIUS,
    fill: "none",
    stroke: "rgba(212,175,55,.85)",
    "stroke-width": "5"
  }));
}

function buildBettingBoard() {
  numbersGrid.innerHTML = "";

  for (let row = 0; row < 12; row++) {
    for (let column = 0; column < 3; column++) {
      const number = row * 3 + (3 - column);
      const cell = document.createElement("button");

      cell.className = `table-cell ${colorOf(number)}`;
      cell.dataset.bet = "number";
      cell.dataset.number = number;
      cell.textContent = number;

      numbersGrid.appendChild(cell);
    }
  }
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

function updateActiveBet() {
  if (bets.length === 0) {
    activeBetEl.textContent = "Aucune mise placée";
    return;
  }

  const total = bets.reduce((sum, bet) => sum + bet.amount, 0);
  activeBetEl.textContent = `${bets.length} mise${bets.length > 1 ? "s" : ""} · Total : ${format(total)} jetons`;
}

function clearSelection() {
  document.querySelectorAll(".table-cell").forEach(cell => {
    cell.classList.remove("selected");
    const stake = cell.querySelector(".stake");
    if (stake) stake.remove();
  });
}

function placeBet(cell) {
  const type = cell.dataset.bet;
  const value = cell.dataset.number || cell.dataset.dozen || cell.dataset.column || null;

  const existing = bets.find(bet =>
    bet.type === type && String(bet.value) === String(value)
  );

  if (existing) {
    existing.amount += selectedChip;
  } else {
    bets.push({ type, value, amount: selectedChip });
  }

  clearSelection();
  cell.classList.add("selected");

  const stake = document.createElement("span");
  stake.className = "stake";
  stake.textContent = bets.find(bet =>
    bet.type === type && String(bet.value) === String(value)
  ).amount;

  cell.appendChild(stake);
  updateActiveBet();
}

function totalBet() {
  return bets.reduce((sum, bet) => sum + bet.amount, 0);
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
  resultEl.textContent = "La roue tourne…";

  const winningNumber = Math.floor(Math.random() * 37);
  const sectorAngle = 360 / 37;

  const currentMod = ((wheelRotation % 360) + 360) % 360;
  const targetMod = ((360 - winningNumber * sectorAngle) % 360 + 360) % 360;
  let delta = targetMod - currentMod;

  if (delta < 0) delta += 360;

  wheelRotation += 1800 + delta;
  ballRotation -= 2600 + Math.random() * 900;

  wheel.style.transform = `rotate(${wheelRotation}deg)`;
  ball.style.transform = `translateX(-50%) rotate(${ballRotation}deg)`;

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

    resultEl.textContent = `Résultat : ${winningNumber} · ${colorName}`;
    addHistory(winningNumber);

    if (totalGain > 0) {
      resultEl.textContent += ` — Gain total : ${format(totalGain)} jetons`;
    } else {
      resultEl.textContent += " — Aucun gain";
    }

    bets = [];
    clearSelection();
    updateActiveBet();

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
  clearSelection();
  updateActiveBet();
});

buildWheel();
buildBettingBoard();