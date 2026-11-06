const numbers = Array.from({ length: 37 }, (_, i) => i);

const redNumbers = new Set([
  1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36
]);

const wheel = document.getElementById("wheel");
const resultEl = document.getElementById("result");
const balanceEl = document.getElementById("balance");
const betAmount = document.getElementById("bet-amount");
const numberBet = document.getElementById("number-bet");
const spinButton = document.getElementById("spin");
const resetButton = document.getElementById("reset");
const historyList = document.getElementById("history-list");

let balance = 1000;
let currentBet = null;
let rotation = 0;
let spinning = false;
const history = [];

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

function drawResult(n) {
  const color = colorOf(n);
  const colorText = { red: "Rouge", black: "Noir", green: "Vert" }[color];
  resultEl.textContent = `Résultat : ${n} — ${colorText}`;
}

function addHistory(n) {
  history.unshift(n);
  if (history.length > 12) history.pop();

  historyList.innerHTML = "";
  history.forEach(value => {
    const chip = document.createElement("div");
    chip.className = `chip ${colorOf(value)}`;
    chip.textContent = value;
    historyList.appendChild(chip);
  });
}

function payout(bet, n, amount) {
  if (bet === "number") {
    return Number(numberBet.value) === n ? amount * 36 : 0;
  }

  if (n === 0) return 0;

  switch (bet) {
    case "red": return colorOf(n) === "red" ? amount * 2 : 0;
    case "black": return colorOf(n) === "black" ? amount * 2 : 0;
    case "even": return n % 2 === 0 ? amount * 2 : 0;
    case "odd": return n % 2 === 1 ? amount * 2 : 0;
    case "low": return n >= 1 && n <= 18 ? amount * 2 : 0;
    case "high": return n >= 19 && n <= 36 ? amount * 2 : 0;
    default: return 0;
  }
}

function setActiveBet(bet) {
  currentBet = bet;
  document.querySelectorAll(".bet").forEach(button => {
    button.classList.toggle("active", button.dataset.bet === bet);
  });
}

document.querySelectorAll(".bet").forEach(button => {
  button.addEventListener("click", () => {
    setActiveBet(button.dataset.bet);
    numberBet.value = "";
  });
});

numberBet.addEventListener("change", () => {
  if (numberBet.value !== "") {
    setActiveBet("number");
  }
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
  balanceEl.textContent = balance;

  const winningNumber = Math.floor(Math.random() * 37);
  const sectorAngle = 360 / 37;
  const targetAngle = 360 * 6 + (360 - winningNumber * sectorAngle);

  rotation += targetAngle;
  wheel.style.transform = `rotate(${rotation}deg)`;

  setTimeout(() => {
    const gain = payout(currentBet, winningNumber, amount);
    balance += gain;
    balanceEl.textContent = balance;

    drawResult(winningNumber);
    addHistory(winningNumber);

    if (gain > 0) {
      resultEl.textContent += ` — Vous gagnez ${gain} jetons !`;
    } else {
      resultEl.textContent += " — Perdu.";
    }

    spinning = false;
    spinButton.disabled = false;

    if (balance < 1) {
      resultEl.textContent = "Plus de jetons. Réinitialisez pour rejouer.";
      spinButton.disabled = true;
    }
  }, 5100);
});

resetButton.addEventListener("click", () => {
  balance = 1000;
  history.length = 0;
  historyList.innerHTML = "";
  balanceEl.textContent = balance;
  resultEl.textContent = "Nouvelle partie — placez votre mise";
  spinButton.disabled = false;
  setActiveBet(null);
  numberBet.value = "";
});

buildWheel();
buildNumberSelect();