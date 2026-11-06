const numbers = Array.from({ length: 37 }, (_, i) => i);

const redNumbers = new Set([
  1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36
]);

const wheel = document.getElementById("wheel");
const ball = document.getElementById("ball");
const resultEl = document.getElementById("result");
const balanceEl = document.getElementById("balance");
const betAmount = document.getElementById("bet-amount");
const numberBet = document.getElementById("number-bet");
const spinButton = document.getElementById("spin");
const resetButton = document.getElementById("reset");
const historyList = document.getElementById("history-list");

const SVG_NS = "http://www.w3.org/2000/svg";
const CENTER = 250;
const OUTER_RADIUS = 245;
const NUMBER_RADIUS = 205;
const INNER_RADIUS = 155;

let balance = 1000;
let currentBet = null;
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

  const outerCircle = createSvgElement("circle", {
    cx: CENTER,
    cy: CENTER,
    r: OUTER_RADIUS,
    fill: "#1b1508"
  });
  wheel.appendChild(outerCircle);

  numbers.forEach((number, index) => {
    const startAngle = index * sectorAngle;
    const endAngle = startAngle + sectorAngle;

    const startOuter = polar(startAngle, OUTER_RADIUS);
    const endOuter = polar(endAngle, OUTER_RADIUS);
    const endInner = polar(endAngle, INNER_RADIUS);
    const startInner = polar(startAngle, INNER_RADIUS);

    const path = createSvgElement("path", {
      d: [
        `M ${startOuter.x} ${startOuter.y}`,
        `A ${OUTER_RADIUS} ${OUTER_RADIUS} 0 0 1 ${endOuter.x} ${endOuter.y}`,
        `L ${endInner.x} ${endInner.y}`,
        `A ${INNER_RADIUS} ${INNER_RADIUS} 0 0 0 ${startInner.x} ${startInner.y}`,
        "Z"
      ].join(" "),
      fill: colorOf(number) === "red" ? "#b3202c"
        : colorOf(number) === "green" ? "#0d7a3f"
        : "#101013",
      stroke: "rgba(212,175,55,.75)",
      "stroke-width": "1.2"
    });

    wheel.appendChild(path);

    const labelAngle = startAngle + sectorAngle / 2;
    const labelPosition = polar(labelAngle, NUMBER_RADIUS);

    const text = createSvgElement("text", {
      x: labelPosition.x,
      y: labelPosition.y,
      fill: "#fff",
      "font-size": "17",
      "font-weight": "800",
      "text-anchor": "middle",
      "dominant-baseline": "middle",
      transform: `rotate(${labelAngle} ${labelPosition.x} ${labelPosition.y})`,
      style: "font-family: Inter, sans-serif; paint-order: stroke; stroke: rgba(0,0,0,.55); stroke-width: 3px;"
    });

    text.textContent = number;
    wheel.appendChild(text);
  });

  const innerRing = createSvgElement("circle", {
    cx: CENTER,
    cy: CENTER,
    r: INNER_RADIUS,
    fill: "none",
    stroke: "rgba(212,175,55,.85)",
    "stroke-width": "5"
  });
  wheel.appendChild(innerRing);
}

function buildNumberSelect() {
  numbers.forEach(number => {
    const option = document.createElement("option");
    option.value = number;
    option.textContent = number;
    numberBet.appendChild(option);
  });
}

function setActiveBet(bet) {
  currentBet = bet;

  document.querySelectorAll(".bet").forEach(button => {
    button.classList.toggle("active", button.dataset.bet === bet);
  });
}

function payout(bet, number, amount) {
  if (bet === "number") {
    return Number(numberBet.value) === number ? amount * 36 : 0;
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

  return rules[bet] ? amount * 2 : 0;
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

document.querySelectorAll(".bet").forEach(button => {
  button.addEventListener("click", () => {
    setActiveBet(button.dataset.bet);
    numberBet.value = "";
  });
});

numberBet.addEventListener("change", () => {
  if (numberBet.value !== "") setActiveBet("number");
});

document.querySelectorAll("[data-step]").forEach(button => {
  button.addEventListener("click", () => {
    const next = Math.max(1, Number(betAmount.value) + Number(button.dataset.step));
    betAmount.value = next;
  });
});

spinButton.addEventListener("click", () => {
  if (spinning) return;

  const amount = Math.floor(Number(betAmount.value));

  if (!currentBet) {
    resultEl.textContent = "Choisissez d’abord une mise.";
    return;
  }

  if (!Number.isFinite(amount) || amount < 1) {
    resultEl.textContent = "Entrez une mise valide.";
    return;
  }

  if (amount > balance) {
    resultEl.textContent = "Solde insuffisant.";
    return;
  }

  spinning = true;
  spinButton.disabled = true;
  balance -= amount;
  balanceEl.textContent = format(balance);
  resultEl.textContent = "La roue tourne…";

  const winningNumber = Math.floor(Math.random() * 37);
  const sectorAngle = 360 / 37;

  wheelRotation += 1800 + Math.random() * 540;
  ballRotation -= 2600 + Math.random() * 900;

  wheel.style.transform = `rotate(${wheelRotation}deg)`;
  ball.style.transform = `translateX(-50%) rotate(${ballRotation}deg)`;

  setTimeout(() => {
    const gain = payout(currentBet, winningNumber, amount);
    balance += gain;
    balanceEl.textContent = format(balance);

    const colorName = {
      red: "Rouge",
      black: "Noir",
      green: "Zéro"
    }[colorOf(winningNumber)];

    resultEl.textContent = `Résultat : ${winningNumber} · ${colorName}`;
    addHistory(winningNumber);

    if (gain > 0) {
      resultEl.textContent += ` — Gain : ${format(gain)} jetons`;
    } else {
      resultEl.textContent += " — Aucun gain";
    }

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
  history.length = 0;
  historyList.innerHTML = "";
  balanceEl.textContent = format(balance);
  resultEl.textContent = "Nouvelle partie — placez votre mise";
  spinButton.disabled = false;
  setActiveBet(null);
  numberBet.value = "";
});

buildWheel();
buildNumberSelect();