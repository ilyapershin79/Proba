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

// Новые переменные для AR
let deviceOrientation = { beta: 90, gamma: 0 }; // Положение телефона
let objects3D = []; // Виртуальные объекты в 3D пространстве
let objectElements = []; // DOM элементы объектов
let cameraStream = null;

/* ====== ЭКРАНЫ ====== */
function showScreen(screen) {
  [menuScreen, gameScreen, winScreen].forEach(s => s.classList.remove("active"));
  screen.classList.add("active");
}

/* ====== КАМЕРА ====== */
async function startCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });

    camera.srcObject = cameraStream;
    camera.play();
    console.log("Камера запущена");
    return true;
  } catch (error) {
    console.error("Ошибка камеры:", error);
    alert("Разрешите доступ к камере");
    return false;
  }
}

/* ====== ГИРОСКОП ====== */
function initDeviceOrientation() {
  if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', (event) => {
      deviceOrientation.beta = event.beta || 90;  // Наклон вперед/назад
      deviceOrientation.gamma = event.gamma || 0; // Наклон влево/вправо
      updateObjectsPosition(); // Обновляем объекты при повороте
    });
    console.log("Гироскоп запущен");
  } else {
    console.log("Гироскоп не поддерживается");
    // Эмуляция для теста
    deviceOrientation = { beta: 90, gamma: 0 };
  }
}

/* ====== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====== */
function showMessage(text, type = "info") {
  message.textContent = text;
  message.className = type;
  message.classList.add("show");
  setTimeout(() => message.classList.remove("show"), 1500);
}

function clearObjects() {
  objectElements.forEach(obj => {
    if (obj.element && obj.element.parentNode) {
      obj.element.remove();
    }
  });
  objects3D = [];
  objectElements = [];
}

/* ====== AR ОБЪЕКТЫ ====== */
function createARObjects(contents, correctIndex) {
  clearObjects();

  // 3 виртуальные позиции в пространстве
  const positions = [
    { x: -2, y: 0, z: 5 },   // Слева
    { x: 0, y: 1, z: 4 },    // По центру, выше
    { x: 2, y: -1, z: 6 }    // Справа, ниже
  ];

  contents.forEach((content, index) => {
    const obj3D = {
      ...positions[index],
      content: content,
      isCorrect: index === correctIndex,
      element: null,
      isVisible: false
    };

    objects3D.push(obj3D);
    createObjectElement(obj3D, index);
  });

  updateObjectsPosition(); // Первая отрисовка
}

function createObjectElement(obj3D, index) {
  const obj = document.createElement("div");
  obj.className = "ar-object";
  obj.textContent = obj3D.content;
  obj.dataset.index = index;
  obj.dataset.correct = obj3D.isCorrect;

  // Начальное состояние - скрыт
  obj.style.opacity = "0";
  obj.style.transform = "scale(0)";

  // Клик
  obj.addEventListener("click", () => {
    handleObjectClick(obj, obj3D.isCorrect);
  });

  gameScreen.appendChild(obj);
  obj3D.element = obj;
  objectElements.push({ element: obj, data: obj3D });

  return obj;
}

function updateObjectsPosition() {
  // Гамма (-90 до 90) - наклон влево/вправо
  // Бета (0 до 180) - наклон вперед/назад

  objects3D.forEach((obj, index) => {
    if (!obj.element) return;

    const gamma = deviceOrientation.gamma; // -90..90
    const beta = deviceOrientation.beta;   // 0..180

    // Вычисляем, виден ли объект при текущем повороте
    const objectAngleX = obj.x * 20; // Преобразуем X в угол
    const objectAngleY = obj.y * 15; // Преобразуем Y в угол

    // Проверяем, попадает ли объект в поле зрения
    const isInViewX = Math.abs(gamma - objectAngleX) < 45;
    const isInViewY = Math.abs((beta - 90) - objectAngleY) < 45;
    const isInView = isInViewX && isInViewY;

    if (isInView && !obj.isVisible) {
      // ПОЯВЛЕНИЕ объекта
      obj.isVisible = true;
      obj.element.style.transition = "opacity 0.5s, transform 0.5s";
      obj.element.style.opacity = "1";
      obj.element.style.transform = "scale(1)";
      obj.element.classList.add("visible");

      // Позиция на экране
      const screenX = 50 + (obj.x * 10) - (gamma * 0.5);
      const screenY = 50 + (obj.y * 8) - ((beta - 90) * 0.5);

      obj.element.style.left = `${Math.max(10, Math.min(90, screenX))}%`;
      obj.element.style.top = `${Math.max(20, Math.min(80, screenY))}%`;

    } else if (!isInView && obj.isVisible) {
      // ИСЧЕЗНОВЕНИЕ объекта
      obj.isVisible = false;
      obj.element.style.transition = "opacity 0.3s, transform 0.3s";
      obj.element.style.opacity = "0";
      obj.element.style.transform = "scale(0)";
      obj.element.classList.remove("visible");
      obj.element.classList.remove("highlighted");
    }

    // Выделение если виден
    if (isInView && obj.isVisible) {
      if (!obj.element.classList.contains("highlighted")) {
        obj.element.classList.add("highlighted");
      }
    }
  });
}

function handleObjectClick(obj, isCorrect) {
  if (!obj.classList.contains("visible")) return;

  const rect = obj.getBoundingClientRect();

  if (isCorrect) {
    // ПРАВИЛЬНО
    showMessage("Верно!", "success");

    // Полёт к цели
    const targetIndex = mode === "words" ? currentIndex : collectedItems.length;
    const target = taskTargets.children[targetIndex];

    if (target) {
      const targetRect = target.getBoundingClientRect();
      const flyX = targetRect.left + targetRect.width/2 - rect.left;
      const flyY = targetRect.top + targetRect.height/2 - rect.top;

      obj.style.transition = "transform 0.8s, opacity 0.8s";
      obj.style.transform = `translate(${flyX}px, ${flyY}px) scale(0)`;
      obj.style.opacity = "0";
    }

    setTimeout(() => {
      if (obj.parentNode) obj.remove();
      if (mode === "words") {
        handleCorrectLetter();
      } else {
        handleCorrectItem();
      }
    }, 800);

  } else {
    // НЕПРАВИЛЬНО
    showMessage("Не то!", "error");

    obj.style.transition = "transform 0.3s, opacity 0.3s";
    obj.style.transform = "scale(0) rotate(180deg)";
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

  // ЗАДАНИЕ - МАЛЕНЬКАЯ СТРОКА
  taskText.textContent = `Собери: ${currentWord}`;
  taskText.style.fontSize = "18px"; // Мелкий текст

  // Цели
  taskTargets.innerHTML = "";
  for (let i = 0; i < currentWord.length; i++) {
    const span = document.createElement("span");
    span.className = "target-item";
    span.textContent = currentWord[i];
    span.style.fontSize = "24px"; // Меньше чем было
    taskTargets.appendChild(span);
  }

  // Первая буква
  spawnLetterObjects();
}

function spawnLetterObjects() {
  const correctLetter = currentWord[currentIndex];

  // 3 разные буквы
  const letters = [correctLetter];
  while (letters.length < 3) {
    const randomLetter = ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    if (!letters.includes(randomLetter)) {
      letters.push(randomLetter);
    }
  }

  // Находим индекс правильной буквы
  const correctIndex = letters.findIndex(l => l === correctLetter);

  // Создаём AR объекты
  createARObjects(letters, correctIndex);
  showMessage(`Ищи букву "${correctLetter}"! Крути телефон`, "info");
}

function handleCorrectLetter() {
  const targetItems = document.querySelectorAll(".target-item");
  if (targetItems[currentIndex]) {
    targetItems[currentIndex].classList.add("found");
  }

  currentIndex++;

  if (currentIndex >= currentWord.length) {
    setTimeout(() => showScreen(winScreen), 1000);
  } else {
    setTimeout(() => {
      spawnLetterObjects();
      showMessage(`Теперь ищи "${currentWord[currentIndex]}"`, "info");
    }, 500);
  }
}

/* ====== РЕЖИМ ПРЕДМЕТЫ ====== */
function startItemsGame() {
  mode = "items";
  currentCategory = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  collectedItems = [];

  // ЗАДАНИЕ - МАЛЕНЬКАЯ СТРОКА
  taskText.textContent = `Для ${currentCategory.name.toLowerCase()}:`;
  taskText.style.fontSize = "18px";

  // Эмодзи предметов
  taskTargets.innerHTML = "";
  currentCategory.items.forEach(item => {
    const span = document.createElement("span");
    span.className = "target-item";
    span.textContent = item.emoji;
    span.style.fontSize = "24px";
    taskTargets.appendChild(span);
  });

  spawnItemObjects();
}

function spawnItemObjects() {
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

  const contents = items.map(item => item.emoji);
  const correctIndex = items.findIndex(item => item.name === correctItem.name);

  createARObjects(contents, correctIndex);
  showMessage(`Ищи ${correctItem.name.toLowerCase()}! Крути телефон`, "info");
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
    setTimeout(() => showScreen(winScreen), 1000);
  } else {
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
wordsBtn.addEventListener("click", async () => {
  showScreen(gameScreen);
  const cameraOk = await startCamera();
  if (cameraOk) {
    initDeviceOrientation();
    setTimeout(() => startWordsGame(), 300);
  }
});

itemsBtn.addEventListener("click", async () => {
  showScreen(gameScreen);
  const cameraOk = await startCamera();
  if (cameraOk) {
    initDeviceOrientation();
    setTimeout(() => startItemsGame(), 300);
  }
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
console.log("AR игра с поворотом телефона загружена!");