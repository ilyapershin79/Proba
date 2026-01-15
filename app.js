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
let deviceOrientation = { alpha: 0, beta: 0, gamma: 0 };
let gameActive = false;

/* ====== ЭКРАНЫ ====== */
function showScreen(screen) {
  [menuScreen, gameScreen, winScreen].forEach(s => s.classList.remove("active"));
  screen.classList.add("active");

  if (screen === gameScreen) {
    gameActive = true;
    startGameLoop();
  } else {
    gameActive = false;
  }
}

/* ====== КАМЕРА ====== */
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });
    camera.srcObject = stream;
  } catch (e) {
    console.error("Ошибка камеры:", e);
    alert("Не удалось запустить камеру. Разрешите доступ к камере.");
  }
}

/* ====== ОРИЕНТАЦИЯ УСТРОЙСТВА ====== */
function initDeviceOrientation() {
  if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', (event) => {
      deviceOrientation = {
        alpha: event.alpha || 0,  // поворот вокруг Z (0-360)
        beta: event.beta || 0,    // наклон вперед/назад (-180 to 180)
        gamma: event.gamma || 0   // наклон влево/вправо (-90 to 90)
      };
    });
  } else {
    console.warn("Device orientation не поддерживается");
    // Эмуляция для десктопа
    deviceOrientation = { alpha: 0, beta: 0, gamma: 0 };
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
    soundElement.play().catch(e => console.log("Звук не воспроизведён:", e));
  } catch (e) {
    console.log("Ошибка воспроизведения звука:", e);
  }
}

function createParticles(x, y, color = "#ffd700", count = 15) {
  for (let i = 0; i < count; i++) {
    const particle = document.createElement("div");
    particle.className = "effect-particle";
    particle.style.background = color;
    particle.style.left = x + "px";
    particle.style.top = y + "px";

    // Случайное направление
    const angle = Math.random() * Math.PI * 2;
    const distance = 50 + Math.random() * 100;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance;

    particle.style.setProperty("--tx", tx + "px");
    particle.style.setProperty("--ty", ty + "px");

    effectsContainer.appendChild(particle);

    setTimeout(() => {
      if (particle.parentNode) {
        particle.remove();
      }
    }, 1000);
  }
}

function clearARObjects() {
  arContainer.innerHTML = "";
  currentObjects = [];
}

/* ====== ПОЗИЦИОНИРОВАНИЕ В ПРОСТРАНСТВЕ ====== */
function getRandomPositionInSpace() {
  // Глубина (Z-координата) - дальше от пользователя
  const z = 5 + Math.random() * 10;

  // Угол обзора (горизонтальный)
  const angle = Math.random() * Math.PI * 2;

  // Расстояние от центра (X, Y)
  const radius = 2 + Math.random() * 4;
  const x = Math.cos(angle) * radius;
  const y = (Math.random() - 0.5) * 3; // Вертикальное положение

  return { x, y, z };
}

function calculateScreenPosition(worldPos) {
  // Простая проекция 3D -> 2D
  const fov = 60; // Поле зрения
  const aspect = window.innerWidth / window.innerHeight;

  // Учитываем ориентацию устройства
  const tiltX = deviceOrientation.gamma / 90; // -1 to 1
  const tiltY = deviceOrientation.beta / 90;  // -1 to 1
  const rotation = deviceOrientation.alpha / 360; // 0 to 1

  // Корректируем позицию с учётом наклона устройства
  const adjustedX = worldPos.x + tiltX * 2;
  const adjustedY = worldPos.y + tiltY * 2;

  // Проекция на экран
  const screenX = (adjustedX / worldPos.z) * (fov / aspect) * 100 + 50;
  const screenY = (adjustedY / worldPos.z) * fov * 100 + 50;

  return {
    x: Math.min(Math.max(screenX, 10), 90), // Ограничиваем краями экрана
    y: Math.min(Math.max(screenY, 20), 80)
  };
}

/* ====== СОЗДАНИЕ AR ОБЪЕКТОВ ====== */
function createARObject(content, isCorrect, worldPosition) {
  const obj = document.createElement("div");
  obj.className = "ar-object";
  obj.textContent = content;
  obj.dataset.correct = isCorrect;
  obj.dataset.worldPos = JSON.stringify(worldPosition);

  // Позиционируем
  updateObjectPosition(obj, worldPosition);

  // Клик на объект
  obj.addEventListener("click", () => handleObjectClick(obj, isCorrect));

  // Наведение на объект
  obj.addEventListener("mouseenter", () => handleObjectHover(obj));
  obj.addEventListener("touchstart", () => handleObjectHover(obj));

  arContainer.appendChild(obj);
  currentObjects.push({ element: obj, worldPosition });

  return obj;
}

function updateObjectPosition(element, worldPosition) {
  const screenPos = calculateScreenPosition(worldPosition);
  element.style.left = screenPos.x + "%";
  element.style.top = screenPos.y + "%";

  // Масштаб в зависимости от расстояния
  const scale = Math.max(0.5, 3 / worldPosition.z);
  element.style.transform += ` scale(${scale})`;

  // Видимость в зависимости от расстояния и ориентации
  const distance = Math.sqrt(worldPosition.x**2 + worldPosition.y**2 + worldPosition.z**2);
  if (distance < 15 && screenPos.x > 5 && screenPos.x < 95 && screenPos.y > 10 && screenPos.y < 90) {
    element.classList.add("visible");
    element.style.opacity = Math.max(0.3, 1.5 / distance);
  } else {
    element.classList.remove("visible");
    element.style.opacity = "0";
  }
}

function handleObjectHover(obj) {
  if (obj.classList.contains("highlighted") || !obj.classList.contains("visible")) return;

  obj.classList.add("highlighted");
  playSound(soundHover);

  // Эффект при наведении
  const rect = obj.getBoundingClientRect();
  createParticles(rect.left + rect.width/2, rect.top + rect.height/2, "#00ffaa", 5);
}

function handleObjectClick(obj, isCorrect) {
  if (!obj.classList.contains("visible")) return;

  if (isCorrect) {
    // Правильный выбор
    playSound(soundCorrect);

    // Анимация полёта к цели
    const target = taskTargets.children[currentIndex];
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

    // Эффект исчезновения
    obj.style.transition = "opacity 0.5s";
    obj.style.opacity = "0";
    setTimeout(() => {
      if (obj.parentNode) obj.remove();
    }, 500);
  }
}

/* ====== ОБНОВЛЕНИЕ ПОЗИЦИЙ ОБЪЕКТОВ ====== */
function startGameLoop() {
  function update() {
    if (!gameActive) return;

    currentObjects.forEach(obj => {
      const worldPos = JSON.parse(obj.element.dataset.worldPos);
      updateObjectPosition(obj.element, worldPos);
    });

    requestAnimationFrame(update);
  }

  update();
}

/* ====== РЕЖИМ СЛОВА ====== */
function startWordsGame() {
  mode = "words";
  currentWord = WORDS[Math.floor(Math.random() * WORDS.length)];
  currentIndex = 0;

  // Показываем задание
  taskText.textContent = `Собери слово:`;

  // Показываем буквы слова
  taskTargets.innerHTML = "";
  for (let i = 0; i < currentWord.length; i++) {
    const span = document.createElement("span");
    span.className = "target-item";
    span.textContent = currentWord[i];
    taskTargets.appendChild(span);
  }

  // Запускаем первую букву
  spawnLetterObjects();
}

function spawnLetterObjects() {
  clearARObjects();

  const correctLetter = currentWord[currentIndex];

  // Собираем массив из 3 разных букв
  const letters = [correctLetter];
  while (letters.length < 3) {
    const randomLetter = ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    if (!letters.includes(randomLetter)) {
      letters.push(randomLetter);
    }
  }

  // Перемешиваем
  letters.sort(() => Math.random() - 0.5);

  // Создаём объекты в пространстве
  letters.forEach((letter, index) => {
    const isCorrect = (letter === correctLetter);
    const worldPos = getRandomPositionInSpace();
    createARObject(letter, isCorrect, worldPos);
  });
}

function handleCorrectLetter() {
  // Помечаем найденную букву
  const targetItems = document.querySelectorAll(".target-item");
  if (targetItems[currentIndex]) {
    targetItems[currentIndex].classList.add("found");
  }

  // Переход к следующей букве
  currentIndex++;

  if (currentIndex >= currentWord.length) {
    // Слово собрано!
    setTimeout(() => {
      showScreen(winScreen);
    }, 1000);
  } else {
    // Следующая буква
    setTimeout(() => {
      spawnLetterObjects();
      showMessage(`Теперь ищи букву "${currentWord[currentIndex]}"`, "info");
    }, 500);
  }
}

/* ====== РЕЖИМ ПРЕДМЕТЫ ====== */
function startItemsGame() {
  mode = "items";
  currentCategory = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  collectedItems = [];

  // Показываем задание
  taskText.textContent = currentCategory.question;

  // Показываем предметы, которые нужно найти
  taskTargets.innerHTML = "";
  currentCategory.items.forEach(item => {
    const span = document.createElement("span");
    span.className = "target-item";
    span.textContent = item.emoji;
    span.title = item.name;
    taskTargets.appendChild(span);
  });

  // Запускаем первый предмет
  spawnItemObjects();
}

function spawnItemObjects() {
  clearARObjects();

  // Находим ещё не собранные предметы
  const neededItems = currentCategory.items.filter(item =>
    !collectedItems.some(collected => collected.name === item.name)
  );

  if (neededItems.length === 0) return;

  const correctItem = neededItems[0]; // Берём первый из нужных

  // Собираем массив из 3 разных предметов
  const items = [correctItem];

  // Добавляем случайные предметы из других категорий
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

  // Перемешиваем
  items.sort(() => Math.random() - 0.5);

  // Создаём объекты в пространстве
  items.forEach((item, index) => {
    const isCorrect = (item.name === correctItem.name);
    const worldPos = getRandomPositionInSpace();
    createARObject(item.emoji, isCorrect, worldPos);
  });
}

function handleCorrectItem() {
  // Находим правильный предмет
  const neededItems = currentCategory.items.filter(item =>
    !collectedItems.some(collected => collected.name === item.name)
  );

  if (neededItems.length === 0) return;

  const correctItem = neededItems[0];
  collectedItems.push(correctItem);

  // Помечаем найденный предмет
  const targetItems = document.querySelectorAll(".target-item");
  const itemIndex = currentCategory.items.findIndex(item => item.name === correctItem.name);
  if (targetItems[itemIndex]) {
    targetItems[itemIndex].classList.add("found");
  }

  // Проверяем, все ли собраны
  if (collectedItems.length === currentCategory.items.length) {
    // Все предметы собраны!
    setTimeout(() => {
      showScreen(winScreen);
    }, 1000);
  } else {
    // Следующий предмет
    setTimeout(() => {
      spawnItemObjects();
      const nextItem = currentCategory.items.find(item =>
        !collectedItems.some(collected => collected.name === item.name)
      );
      if (nextItem) {
        showMessage(`Теперь ищи ${nextItem.name.toLowerCase()}`, "info");
      }
    }, 500);
  }
}

/* ====== КНОПКИ ====== */
wordsBtn.addEventListener("click", () => {
  showScreen(gameScreen);
  startCamera();
  initDeviceOrientation();
  setTimeout(() => startWordsGame(), 500);
});

itemsBtn.addEventListener("click", () => {
  showScreen(gameScreen);
  startCamera();
  initDeviceOrientation();
  setTimeout(() => startItemsGame(), 500);
});

homeBtn.addEventListener("click", () => {
  showScreen(menuScreen);
  clearARObjects();
  gameActive = false;
});

playAgainBtn.addEventListener("click", () => {
  showScreen(gameScreen);
  if (mode === "words") startWordsGame();
  if (mode === "items") startItemsGame();
});

backMenuBtn.addEventListener("click", () => {
  showScreen(menuScreen);
  clearARObjects();
  gameActive = false;
});

/* ====== ИНИЦИАЛИЗАЦИЯ ====== */
// При загрузке показываем меню
window.addEventListener('load', () => {
  // Добавляем красивый фон на меню
  menuScreen.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
});