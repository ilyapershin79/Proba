import { WORDS, CATEGORIES, ALPHABET } from "./data.js";

/* ====== ЭЛЕМЕНТЫ ====== */
const menuScreen = document.getElementById("menu");
const gameScreen = document.getElementById("game");
const winScreen = document.getElementById("win");

const wordsBtn = document.getElementById("words-btn");
const itemsBtn = document.getElementById("items-btn");
const homeBtn = document.getElementById("home-btn");
const playAgainBtn = document.getElementById("play-again-btn");
const backMenuBtn = document.getElementById("back-menu-btn");

const camera = document.getElementById("camera");
const taskText = document.getElementById("task-text");
const taskTargets = document.getElementById("task-targets");
const message = document.getElementById("message");

/* ====== СОСТОЯНИЕ ====== */
let mode = null;
let currentWord = "";
let currentIndex = 0;
let currentCategory = null;
let collectedItems = [];
let cameraStream = null;

/* ====== ЭКРАНЫ ====== */
function showScreen(screen) {
  [menuScreen, gameScreen, winScreen].forEach(s => s.classList.remove("active"));
  screen.classList.add("active");
}

/* ====== КАМЕРА ====== */
async function startCamera() {
  // Останавливаем предыдущую камеру
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment"  // Задняя камера
      },
      audio: false
    });

    camera.srcObject = cameraStream;
    camera.play();
    camera.style.display = "block";

    console.log("Камера запущена!");
    return true;
  } catch (error) {
    console.error("Ошибка камеры:", error);
    alert("Не удалось запустить камеру. Разрешите доступ к камере.");
    return false;
  }
}

/* ====== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====== */
function showMessage(text, type = "info") {
  message.textContent = text;
  message.className = type;
  message.classList.add("show");

  setTimeout(() => {
    message.classList.remove("show");
  }, 1500);
}

function clearObjects() {
  document.querySelectorAll(".ar-object").forEach(el => el.remove());
}

/* ====== СОЗДАНИЕ ОБЪЕКТОВ ====== */
function createObject(content, isCorrect, index) {
  const obj = document.createElement("div");
  obj.className = "ar-object";
  obj.textContent = content;
  obj.dataset.correct = isCorrect;

  // Позиции объектов (по кругу)
  const angle = (index * 120) * Math.PI / 180;
  const radius = Math.min(window.innerWidth, window.innerHeight) * 0.3;
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;

  const x = centerX + Math.cos(angle) * radius - 50;
  const y = centerY + Math.sin(angle) * radius - 50;

  obj.style.left = x + "px";
  obj.style.top = y + "px";

  // Анимация появления
  obj.style.opacity = "0";
  obj.style.transform = "scale(0)";

  // Клик
  obj.addEventListener("click", () => {
    handleObjectClick(obj, isCorrect);
  });

  gameScreen.appendChild(obj);

  // Появление с задержкой
  setTimeout(() => {
    obj.style.transition = "opacity 0.3s, transform 0.3s";
    obj.style.opacity = "1";
    obj.style.transform = "scale(1)";
  }, 100);

  return obj;
}

function handleObjectClick(obj, isCorrect) {
  if (isCorrect) {
    // Правильный выбор
    showMessage("Верно!", "success");

    // Анимация полёта
    const targetIndex = mode === "words" ? currentIndex : collectedItems.length;
    const target = taskTargets.children[targetIndex];

    if (target) {
      const targetRect = target.getBoundingClientRect();
      const objRect = obj.getBoundingClientRect();

      const targetX = targetRect.left + targetRect.width/2 - objRect.left;
      const targetY = targetRect.top + targetRect.height/2 - objRect.top;

      obj.style.transition = "transform 0.5s, opacity 0.5s";
      obj.style.transform = `translate(${targetX}px, ${targetY}px) scale(0)`;
      obj.style.opacity = "0";
    }

    setTimeout(() => {
      obj.remove();
      if (mode === "words") {
        handleCorrectLetter();
      } else {
        handleCorrectItem();
      }
    }, 500);

  } else {
    // Неправильный выбор
    showMessage("Не та буква!", "error");

    obj.style.transition = "transform 0.3s, opacity 0.3s";
    obj.style.transform = "scale(0)";
    obj.style.opacity = "0";

    setTimeout(() => {
      if (obj.parentNode) obj.remove();
    }, 300);
  }
}

/* ====== РЕЖИМ СЛОВА ====== */
function startWordsGame() {
  mode = "words";
  currentWord = WORDS[Math.floor(Math.random() * WORDS.length)];
  currentIndex = 0;

  // Задание
  taskText.textContent = `Слово: ${currentWord}`;

  // Цели
  taskTargets.innerHTML = "";
  for (let i = 0; i < currentWord.length; i++) {
    const span = document.createElement("span");
    span.className = "target-item";
    span.textContent = currentWord[i];
    taskTargets.appendChild(span);
  }

  spawnLetterObjects();
}

function spawnLetterObjects() {
  clearObjects();

  const correctLetter = currentWord[currentIndex];
  const letters = [correctLetter];

  while (letters.length < 3) {
    const randomLetter = ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    if (!letters.includes(randomLetter)) {
      letters.push(randomLetter);
    }
  }

  letters.sort(() => Math.random() - 0.5);

  letters.forEach((letter, index) => {
    const isCorrect = (letter === correctLetter);
    createObject(letter, isCorrect, index);
  });
}

function handleCorrectLetter() {
  const targetItems = document.querySelectorAll(".target-item");
  if (targetItems[currentIndex]) {
    targetItems[currentIndex].classList.add("found");
  }

  currentIndex++;

  if (currentIndex >= currentWord.length) {
    setTimeout(() => {
      showScreen(winScreen);
    }, 1000);
  } else {
    setTimeout(() => {
      spawnLetterObjects();
    }, 300);
  }
}

/* ====== РЕЖИМ ПРЕДМЕТЫ ====== */
function startItemsGame() {
  mode = "items";
  currentCategory = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  collectedItems = [];

  taskText.textContent = currentCategory.question;

  taskTargets.innerHTML = "";
  currentCategory.items.forEach(item => {
    const span = document.createElement("span");
    span.className = "target-item";
    span.textContent = item.emoji;
    taskTargets.appendChild(span);
  });

  spawnItemObjects();
}

function spawnItemObjects() {
  clearObjects();

  const neededItems = currentCategory.items.filter(item =>
    !collectedItems.some(collected => collected.name === item.name)
  );

  if (neededItems.length === 0) return;

  const correctItem = neededItems[0];
  const items = [correctItem];
  const allItems = [];

  CATEGORIES.forEach(cat => {
    cat.items.forEach(item => {
      if (!items.some(i => i.name === item.name)) {
        allItems.push(item);
      }
    });
  });

  while (items.length < 3 && allItems.length > 0) {
    const randomIndex = Math.floor(Math.random() * allItems.length);
    const randomItem = allItems[randomIndex];

    if (!items.some(i => i.name === randomItem.name)) {
      items.push(randomItem);
    }
  }

  items.sort(() => Math.random() - 0.5);

  items.forEach((item, index) => {
    const isCorrect = (item.name === correctItem.name);
    createObject(item.emoji, isCorrect, index);
  });
}

function handleCorrectItem() {
  const neededItems = currentCategory.items.filter(item =>
    !collectedItems.some(collected => collected.name === item.name)
  );

  if (neededItems.length === 0) return;

  const correctItem = neededItems[0];
  collectedItems.push(correctItem);

  const targetItems = document.querySelectorAll(".target-item");
  const itemIndex = currentCategory.items.findIndex(item => item.name === correctItem.name);
  if (targetItems[itemIndex]) {
    targetItems[itemIndex].classList.add("found");
  }

  if (collectedItems.length === currentCategory.items.length) {
    setTimeout(() => {
      showScreen(winScreen);
    }, 1000);
  } else {
    setTimeout(() => {
      spawnItemObjects();
    }, 300);
  }
}

/* ====== КНОПКИ ====== */
wordsBtn.addEventListener("click", async () => {
  showScreen(gameScreen);
  await startCamera();
  setTimeout(() => startWordsGame(), 300);
});

itemsBtn.addEventListener("click", async () => {
  showScreen(gameScreen);
  await startCamera();
  setTimeout(() => startItemsGame(), 300);
});

homeBtn.addEventListener("click", () => {
  showScreen(menuScreen);
  clearObjects();
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
});

playAgainBtn.addEventListener("click", () => {
  showScreen(gameScreen);
  if (mode === "words") startWordsGame();
  if (mode === "items") startItemsGame();
});

backMenuBtn.addEventListener("click", () => {
  showScreen(menuScreen);
  clearObjects();
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
});

/* ====== ЗАПУСК ====== */
console.log("Игра загружена");