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
const arContainer = document.getElementById("ar-container");
const effectsContainer = document.getElementById("effects-container");
const compass = document.querySelector(".compass-text");

const soundCorrect = document.getElementById("sound-correct");
const soundWrong = document.getElementById("sound-wrong");
const soundHover = document.getElementById("sound-hover");

/* ====== СОСТОЯНИЕ ====== */
let mode = null;
let currentWord = "";
let currentIndex = 0;
let currentCategory = null;
let collectedItems = [];
let currentObjects = [];
let searchAngle = 0;

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
    console.log("Камера не работает, используем фон");
    camera.style.display = "none";
    gameScreen.style.background = "linear-gradient(135deg, #1a2980, #26d0ce)";
  }
}

/* ====== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====== */
function showMessage(text, type = "info") {
  message.textContent = text;
  message.className = "";
  message.classList.add(type);
  message.classList.add("show");

  setTimeout(() => {
    message.classList.remove("show");
  }, 2000);
}

function playSound(soundElement) {
  try {
    soundElement.currentTime = 0;
    soundElement.play().catch(e => console.log("Звук не воспроизведён"));
  } catch (e) {
    console.log("Ошибка звука");
  }
}

function createParticles(x, y, color = "#ffd700", count = 15) {
  for (let i = 0; i < count; i++) {
    const particle = document.createElement("div");
    particle.className = "effect-particle";
    particle.style.background = color;
    particle.style.left = x + "px";
    particle.style.top = y + "px";

    const angle = Math.random() * Math.PI * 2;
    const distance = 50 + Math.random() * 100;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance;

    particle.style.setProperty("--tx", tx + "px");
    particle.style.setProperty("--ty", ty + "px");

    effectsContainer.appendChild(particle);

    setTimeout(() => {
      if (particle.parentNode) particle.remove();
    }, 1000);
  }
}

function clearARObjects() {
  arContainer.innerHTML = "";
  currentObjects = [];
}

/* ====== ПРОСТАЯ СИМУЛЯЦИЯ ДВИЖЕНИЯ ====== */
function simulateMovement() {
  searchAngle += 0.5;
  const x = Math.sin(searchAngle * Math.PI / 180) * 30;
  compass.textContent = `Ищи! Поверни телефон ${x > 0 ? 'вправо' : 'влево'}`;

  // Обновляем видимость объектов в зависимости от "угла"
  currentObjects.forEach((obj, index) => {
    const objAngle = (index * 120 + searchAngle) % 360;
    const isVisible = Math.abs(objAngle - 180) < 60;

    if (isVisible && !obj.element.classList.contains("visible")) {
      // Появление объекта с анимацией
      obj.element.style.opacity = "0";
      obj.element.classList.add("visible");
      obj.element.style.transform = "scale(0)";

      setTimeout(() => {
        obj.element.style.transition = "opacity 0.5s, transform 0.5s";
        obj.element.style.opacity = "1";
        obj.element.style.transform = "scale(1)";
      }, 50);

    } else if (!isVisible && obj.element.classList.contains("visible")) {
      // Скрытие объекта
      obj.element.style.opacity = "0";
      obj.element.classList.remove("visible");
    }
  });
}

/* ====== СОЗДАНИЕ ОБЪЕКТОВ ====== */
function createARObject(content, isCorrect, positionIndex) {
  const obj = document.createElement("div");
  obj.className = "ar-object";
  obj.textContent = content;
  obj.dataset.correct = isCorrect;

  // Позиция по кругу (симуляция пространства)
  const angle = positionIndex * 120; // 3 объекта по кругу
  const radius = 150;
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;

  const x = centerX + Math.cos(angle * Math.PI / 180) * radius - 50;
  const y = centerY + Math.sin(angle * Math.PI / 180) * radius - 50;

  obj.style.left = x + "px";
  obj.style.top = y + "px";
  obj.style.opacity = "0";

  // Клик
  obj.addEventListener("click", (e) => {
    e.stopPropagation();
    handleObjectClick(obj, isCorrect);
  });

  // Наведение
  obj.addEventListener("mouseenter", () => handleObjectHover(obj));
  obj.addEventListener("touchstart", () => handleObjectHover(obj));

  arContainer.appendChild(obj);
  currentObjects.push({ element: obj, angle });

  return obj;
}

function handleObjectHover(obj) {
  if (!obj.classList.contains("visible") || obj.classList.contains("highlighted")) return;

  obj.classList.add("highlighted");
  playSound(soundHover);

  const rect = obj.getBoundingClientRect();
  createParticles(rect.left + rect.width/2, rect.top + rect.height/2, "#00ffaa", 5);
}

function handleObjectClick(obj, isCorrect) {
  if (!obj.classList.contains("visible")) {
    showMessage("Поверни телефон, чтобы увидеть объект!", "error");
    return;
  }

  if (isCorrect) {
    // Правильный выбор
    playSound(soundCorrect);

    // Анимация полёта
    const target = taskTargets.children[mode === "words" ? currentIndex : collectedItems.length];
    if (target) {
      const targetRect = target.getBoundingClientRect();
      const objRect = obj.getBoundingClientRect();

      const targetX = targetRect.left + targetRect.width/2 - objRect.left;
      const targetY = targetRect.top + targetRect.height/2 - objRect.top;

      obj.style.setProperty("--target-x", targetX + "px");
      obj.style.setProperty("--target-y", targetY + "px");
      obj.classList.add("collecting");
    }

    // Частицы
    const rect = obj.getBoundingClientRect();
    createParticles(rect.left + rect.width/2, rect.top + rect.height/2, "#ffd700", 20);

    // Обновление игры
    setTimeout(() => {
      if (mode === "words") {
        handleCorrectLetter();
      } else if (mode === "items") {
        handleCorrectItem();
      }
    }, 800);

  } else {
    // Неправильный выбор
    playSound(soundWrong);
    showMessage("Это не то, что нужно!", "error");

    obj.style.transition = "opacity 0.5s, transform 0.5s";
    obj.style.opacity = "0";
    obj.style.transform = "scale(0) rotate(180deg)";

    setTimeout(() => {
      if (obj.parentNode) obj.remove();
    }, 500);
  }
}

/* ====== РЕЖИМ СЛОВА ====== */
function startWordsGame() {
  mode = "words";
  currentWord = WORDS[Math.floor(Math.random() * WORDS.length)];
  currentIndex = 0;

  taskText.textContent = `Собери слово:`;

  taskTargets.innerHTML = "";
  for (let i = 0; i < currentWord.length; i++) {
    const span = document.createElement("span");
    span.className = "target-item";
    span.textContent = currentWord[i];
    taskTargets.appendChild(span);
  }

  showMessage(`Ищи букву "${currentWord[0]}"! Двигай телефоном`, "info");
  spawnLetterObjects();
}

function spawnLetterObjects() {
  clearARObjects();

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
    createARObject(letter, isCorrect, index);
  });

  // Запускаем симуляцию движения
  if (!window.movementInterval) {
    window.movementInterval = setInterval(simulateMovement, 50);
  }
}

function handleCorrectLetter() {
  const targetItems = document.querySelectorAll(".target-item");
  if (targetItems[currentIndex]) {
    targetItems[currentIndex].classList.add("found");
  }

  currentIndex++;

  if (currentIndex >= currentWord.length) {
    clearInterval(window.movementInterval);
    window.movementInterval = null;

    setTimeout(() => {
      showScreen(winScreen);
    }, 1000);
  } else {
    setTimeout(() => {
      spawnLetterObjects();
      showMessage(`Теперь ищи букву "${currentWord[currentIndex]}"!`, "info");
    }, 500);
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
    span.title = item.name;
    taskTargets.appendChild(span);
  });

  showMessage(`Ищи ${currentCategory.items[0].name.toLowerCase()}! Двигай телефоном`, "info");
  spawnItemObjects();
}

function spawnItemObjects() {
  clearARObjects();

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
      allItems.splice(randomIndex, 1);
    }
  }

  items.sort(() => Math.random() - 0.5);

  items.forEach((item, index) => {
    const isCorrect = (item.name === correctItem.name);
    createARObject(item.emoji, isCorrect, index);
  });

  if (!window.movementInterval) {
    window.movementInterval = setInterval(simulateMovement, 50);
  }
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
    clearInterval(window.movementInterval);
    window.movementInterval = null;

    setTimeout(() => {
      showScreen(winScreen);
    }, 1000);
  } else {
    setTimeout(() => {
      spawnItemObjects();
      const nextItem = currentCategory.items.find(item =>
        !collectedItems.some(collected => collected.name === item.name)
      );
      if (nextItem) {
        showMessage(`Теперь ищи ${nextItem.name.toLowerCase()}!`, "info");
      }
    }, 500);
  }
}

/* ====== КНОПКИ ====== */
wordsBtn.addEventListener("click", () => {
  showScreen(gameScreen);
  startCamera();
  setTimeout(() => startWordsGame(), 300);
});

itemsBtn.addEventListener("click", () => {
  showScreen(gameScreen);
  startCamera();
  setTimeout(() => startItemsGame(), 300);
});

homeBtn.addEventListener("click", () => {
  showScreen(menuScreen);
  clearARObjects();
  clearInterval(window.movementInterval);
  window.movementInterval = null;
});

playAgainBtn.addEventListener("click", () => {
  showScreen(gameScreen);
  if (mode === "words") startWordsGame();
  if (mode === "items") startItemsGame();
});

backMenuBtn.addEventListener("click", () => {
  showScreen(menuScreen);
  clearARObjects();
  clearInterval(window.movementInterval);
  window.movementInterval = null;
});

/* ====== КЛИК ПО ЭКРАНУ ДЛЯ ТЕСТА ====== */
gameScreen.addEventListener("click", (e) => {
  if (e.target === gameScreen || e.target === camera) {
    showMessage("Двигай телефоном в разные стороны, чтобы найти объекты!", "info");
  }
});

/* ====== ЗАПУСК ====== */
console.log("AR игра загружена!");