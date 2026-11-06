const numbers = Array.from({ length: 37 }, (_, i) => i);
const redNumbers = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

const wheel = document.getElementById("wheel");
const ball = document.getElementById("ball");
const resultEl = document.getElementById("result");
const balanceEl = document.getElementById("balance");
const betAmount = document.getElementById("bet-amount");
const numberBet = document.getElementById("number-bet");
const spinButton = document.getElementById("spin");
const resetButton = document.getElementById("reset");
const historyList = document.getElementById("history-list");

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

function buildWheel() {
  wheel.innerHTML = "";
  const angle = 360 / numbers.length;

  numbers.forEach((n, i) => {
    const sector = document.createElement("div");
    sector.className = `sector ${colorOf(n)}`;
    sector.style.transform = `rotate(${i * angle}deg)`;

    const label = document.createElement("span");
    label.textContent = n;
    sector.appendChild(label);
    wheel.appendChild(sector);
  });
}

function buildNumberSelect() {
  numbers.forEach(n => {
    const option = document.createElement("option");
    option.value = n;
    option.textContent = n;
    numberBet.appendChild(option);
  });
}

function setActiveBet(bet) {
  currentBet = bet;
  document.querySelectorAll(".bet").forEach(button => {
    button.classList.toggle("active", button.dataset.bet === bet);
  });
}

function payout(bet, n, amount) {
  if (bet === "number") {
    return Number(numberBet.value) === n ? amount * 36 : 0;
  }

  if (n === 0) return 0;

  const rules = {
    red: colorOf(n) === "red",
    black: colorOf(n) === "black",
    even: n % 2 === 0,
    odd: n % 2 === 1,
    low: n <= 18,
    high: n >= 19
  };

  return rules[bet] ? amount * 2 : 0;
}

function addHistory(n) {
  history.unshift(n);
  if (history.length > 14) history.pop();

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
    const value = Math.max(1, Number(betAmount.value) + Number(button.dataset.step));
    betAmount.value = value;
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

  wheelRotation += 1440 + Math.random() * 360;
  ballRotation -= 2160 + Math.random() * 720;

  wheel.style.transform = `rotate(${wheelRotation}deg)`;
  ball.style.transform = `translateX(-50%) rotate(${ballRotation}deg)`;

  setTimeout(() => {
    const gain = payout(currentBet, winningNumber, amount);
    balance += gain;
    balanceEl.textContent = format(balance);

    const colorName = { red: "Rouge", black: "Noir", green: "Zéro" }[colorOf(winningNumber)];
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
  }, 6100);
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