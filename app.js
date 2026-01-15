import { WORDS, CATEGORIES } from "./data.js";

/* ====== ЭЛЕМЕНТЫ ====== */
const menuScreen = document.getElementById("menu");
const gameScreen = document.getElementById("game");
const winScreen = document.getElementById("win");

const wordsBtn = document.getElementById("words-btn");
const itemsBtn = document.getElementById("items-btn");
const homeBtn = document.getElementById("home-btn");
const playAgainBtn = document.getElementById("play-again-btn");

const camera = document.getElementById("camera");
const taskPanel = document.getElementById("task-panel");
const message = document.getElementById("message");

/* ====== СОСТОЯНИЕ ====== */
let mode = null;
let currentWord = "";
let currentIndex = 0;

let currentCategory = null;
let collectedItems = [];

/* ====== ЭКРАНЫ ====== */
function showScreen(screen) {
  [menuScreen, gameScreen, winScreen].forEach(s => s.classList.remove("active"));
  screen.classList.add("active");
}

/* ====== КАМЕРА ====== */
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });
    camera.srcObject = stream;
  } catch (e) {
    alert("Не удалось запустить камеру");
  }
}

/* ====== ВСПОМОГАТЕЛЬНОЕ ====== */
function showMessage(text) {
  message.textContent = text;
  message.classList.add("show");
  setTimeout(() => message.classList.remove("show"), 1500);
}

function randomPosition() {
  return {
    x: Math.random() * (window.innerWidth - 100),
    y: Math.random() * (window.innerHeight - 200) + 100
  };
}

function clearObjects() {
  document.querySelectorAll(".ar-object").forEach(el => el.remove());
}

/* ====== AR ОБЪЕКТ ====== */
function createObject(content, onClick) {
  const div = document.createElement("div");
  div.className = "ar-object";
  div.textContent = content;

  const pos = randomPosition();
  div.style.left = pos.x + "px";
  div.style.top = pos.y + "px";

  div.addEventListener("click", onClick);
  gameScreen.appendChild(div);
}

/* ====== РЕЖИМ СЛОВА ====== */
function startWordsGame() {
  mode = "words";
  currentWord = WORDS[Math.floor(Math.random() * WORDS.length)];
  currentIndex = 0;

  taskPanel.textContent = "Собери слово: " + currentWord;
  clearObjects();
  spawnLetters();
}

function spawnLetters() {
  clearObjects();

  const correctLetter = currentWord[currentIndex];
  const alphabet = "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЫЭЮЯ";

  const letters = [correctLetter];
  while (letters.length < 3) {
    const l = alphabet[Math.floor(Math.random() * alphabet.length)];
    if (!letters.includes(l)) letters.push(l);
  }

  letters.sort(() => Math.random() - 0.5);

  letters.forEach(letter => {
    createObject(letter, () => {
      if (letter === correctLetter) {
        currentIndex++;
        if (currentIndex >= currentWord.length) {
          showScreen(winScreen);
        } else {
          spawnLetters();
        }
      } else {
        showMessage("Эта буква не нужна сейчас");
      }
    });
  });
}

/* ====== РЕЖИМ ПРЕДМЕТЫ ====== */
function startItemsGame() {
  mode = "items";
  currentCategory = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  collectedItems = [];

  taskPanel.textContent =
    "Найди: " + currentCategory.items.map(i => i.emoji).join(" ");

  clearObjects();
  spawnItems();
}

function spawnItems() {
  clearObjects();

  const needed = currentCategory.items.filter(
    i => !collectedItems.includes(i)
  );

  const correctItem = needed[Math.floor(Math.random() * needed.length)];

  const pool = [];
  CATEGORIES.forEach(cat => cat.items.forEach(i => pool.push(i)));

  const items = [correctItem];
  while (items.length < 3) {
    const it = pool[Math.floor(Math.random() * pool.length)];
    if (!items.includes(it)) items.push(it);
  }

  items.sort(() => Math.random() - 0.5);

  items.forEach(item => {
    createObject(item.emoji, () => {
      if (item === correctItem) {
        collectedItems.push(item);
        if (collectedItems.length === currentCategory.items.length) {
          showScreen(winScreen);
        } else {
          spawnItems();
        }
      } else {
        showMessage("Этот предмет используется для другого дела");
      }
    });
  });
}

/* ====== КНОПКИ ====== */
wordsBtn.addEventListener("click", () => {
  showScreen(gameScreen);
  startCamera();
  startWordsGame();
});

itemsBtn.addEventListener("click", () => {
  showScreen(gameScreen);
  startCamera();
  startItemsGame();
});

homeBtn.addEventListener("click", () => {
  showScreen(menuScreen);
  clearObjects();
});

playAgainBtn.addEventListener("click", () => {
  showScreen(gameScreen);
  if (mode === "words") startWordsGame();
  if (mode === "items") startItemsGame();
});
