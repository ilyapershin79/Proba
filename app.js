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

/* ====== ГИРОСКОП ====== */
let deviceAlpha = 0;   // Горизонтальный поворот (0-360°)
let deviceBeta = 90;   // Вертикальный наклон (0-180°)
// Буфер для сглаживания данных
let alphaBuffer = [];
let betaBuffer = [];

/* ====== ВИРТУАЛЬНЫЕ ОБЪЕКТЫ ====== */
let virtualObjects = [];

/* ====== ЦВЕТА ДЛЯ БУКВ ====== */
const LETTER_COLORS = [
  "#FF6B6B", // Красный
  "#4ECDC4", // Бирюзовый
  "#FFD166", // Желтый
  "#06D6A0", // Зеленый
  "#118AB2", // Синий
  "#EF476F", // Розовый
  "#7209B7", // Фиолетовый
  "#F3722C", // Оранжевый
  "#577590", // Серо-синий
  "#90BE6D"  // Салатовый
];

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
    console.log("Камера работает");
    return true;
  } catch (err) {
    console.error("Ошибка камеры:", err);
    alert("Разрешите доступ к камере!");
    return false;
  }
}

/* ====== ГИРОСКОП (СГЛАЖЕННЫЙ) ====== */
function startGyroscope() {
  if (window.DeviceOrientationEvent) {
    window.addEventListener("deviceorientation", (event) => {
      // Добавляем новые значения в буфер
      alphaBuffer.push(event.alpha || 0);
      betaBuffer.push(event.beta || 90);

      // Держим только последние 5 значений
      if (alphaBuffer.length > 5) alphaBuffer.shift();
      if (betaBuffer.length > 5) betaBuffer.shift();

      // Усредняем значения для сглаживания
      deviceAlpha = alphaBuffer.reduce((a, b) => a + b, 0) / alphaBuffer.length;
      deviceBeta = betaBuffer.reduce((a, b) => a + b, 0) / betaBuffer.length;

      updateObjectsPosition();
    });
    console.log("Гироскоп работает (сглаженный)");
  } else {
    console.log("Гироскоп не поддерживается");
    deviceAlpha = 0;
    deviceBeta = 90;
  }
}

/* ====== СООБЩЕНИЯ ====== */
function showMessage(text, type = "info") {
  message.textContent = text;
  message.className = type;
  message.classList.add("show");
  setTimeout(() => message.classList.remove("show"), 2000);
}

/* ====== ПОДСКАЗКА ВНИЗУ ====== */
function updateHint() {
  // Удаляем старую подсказку
  const oldHint = document.getElementById("current-hint");
  if (oldHint) oldHint.remove();

  if (mode === "words") {
    const correctLetter = currentWord[currentIndex];
    const hint = document.createElement("div");
    hint.id = "current-hint";
    hint.className = "hint-box";
    hint.innerHTML = `
      <div class="hint-icon">🔍</div>
      <div class="hint-text">Ищи букву: <span class="hint-target">${correctLetter}</span></div>
    `;
    gameScreen.appendChild(hint);
  } else if (mode === "items") {
    const neededItems = currentCategory.items.filter(item =>
      !collectedItems.some(collected => collected.name === item.name)
    );
    if (neededItems.length > 0) {
      const correctItem = neededItems[0];
      const hint = document.createElement("div");
      hint.id = "current-hint";
      hint.className = "hint-box";
      hint.innerHTML = `
        <div class="hint-icon">🔍</div>
        <div class="hint-text">Ищи: <span class="hint-target">${correctItem.name.toLowerCase()}</span> ${correctItem.emoji}</div>
      `;
      gameScreen.appendChild(hint);
    }
  }
}

/* ====== ВИРТУАЛЬНЫЕ ОБЪЕКТЫ ====== */
function createVirtualObjects(contents, correctIndex) {
  // Удаляем старые объекты
  virtualObjects.forEach(obj => {
    if (obj.element && obj.element.parentNode) {
      obj.element.remove();
    }
  });
  virtualObjects = [];

  // Создаем 3 объекта в РАЗНЫХ местах пространства
  const positions = [];

  for (let i = 0; i < 3; i++) {
    // Горизонталь: 0-360° (полный круг)
    // Вертикаль: 30-150° (чтобы не слишком высоко/низко)
    const horizontal = Math.floor(Math.random() * 360);
    const vertical = 30 + Math.floor(Math.random() * 120);

    positions.push({
      horizontal: horizontal,
      vertical: vertical,
      id: i,
      color: LETTER_COLORS[i % LETTER_COLORS.length] // Цвет для объекта
    });
  }

  // Убедимся что объекты далеко друг от друга
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      let hDiff = Math.abs(positions[i].horizontal - positions[j].horizontal);
      if (hDiff > 180) hDiff = 360 - hDiff;

      let vDiff = Math.abs(positions[i].vertical - positions[j].vertical);

      if (hDiff < 100 && vDiff < 80) {
        positions[j].horizontal = (positions[j].horizontal + 180) % 360;
        positions[j].vertical = Math.min(150, Math.max(30, positions[j].vertical + 90));
      }
    }
  }

  contents.forEach((content, index) => {
    const obj = {
      id: `obj_${Date.now()}_${index}`,
      content: content,
      isCorrect: index === correctIndex,
      position: positions[index],
      element: null,
      isVisible: false,
      hasBeenClicked: false,
      isHighlighted: false,
      lastSeenAlpha: null,
      lastSeenBeta: null
    };

    // Создаём DOM элемент С ЦВЕТОМ
    const element = document.createElement("div");
    element.className = "ar-object";
    element.textContent = content;
    element.dataset.correct = obj.isCorrect;
    element.dataset.id = obj.id;
    element.dataset.objectId = obj.id;

    // Применяем цвет
    element.style.color = positions[index].color;
    element.style.textShadow = `0 0 10px ${positions[index].color}, 0 0 20px ${positions[index].color}`;

    // Начально скрыт
    element.style.opacity = "0";
    element.style.transform = "scale(0)";
    element.style.left = "50%";
    element.style.top = "50%";

    // Клик
    element.addEventListener("click", (e) => {
      e.stopPropagation();
      if (obj.hasBeenClicked) return;

      // Проверяем СЕЙЧАС
      const currentHDiff = calculateHorizontalDiff(deviceAlpha, obj.position.horizontal);
      const currentVDiff = Math.abs(deviceBeta - obj.position.vertical);
      const isCurrentlyInCenter = currentHDiff < 30 && currentVDiff < 25;

      if (!isCurrentlyInCenter) {
        showMessage("Наведи объект точно в центр!", "error");
        return;
      }

      obj.hasBeenClicked = true;
      handleObjectClick(element, obj.isCorrect, obj.id);
    });

    gameScreen.appendChild(element);
    obj.element = element;
    virtualObjects.push(obj);
  });

  // Обновляем подсказку
  updateHint();
  updateObjectsPosition();
}

function calculateHorizontalDiff(alpha1, alpha2) {
  let diff = Math.abs(alpha1 - alpha2);
  if (diff > 180) diff = 360 - diff;
  return diff;
}

function updateObjectsPosition() {
  virtualObjects.forEach(obj => {
    if (!obj.element || obj.hasBeenClicked) return;

    // РАСЧЕТ С ГИСТЕРЕЗИСОМ (чтобы не мигало)
    const horizontalDiff = calculateHorizontalDiff(deviceAlpha, obj.position.horizontal);
    const verticalDiff = Math.abs(deviceBeta - obj.position.vertical);

    // ШИРОКОЕ ПОЛЕ ЗРЕНИЯ: ±80° по горизонтали, ±70° по вертикали
    const shouldBeVisible = horizontalDiff < 80 && verticalDiff < 70;

    // ГИСТЕРЕЗИС: объект остается видимым дольше
    // Если был виден и сейчас почти не виден - все еще показываем
    const almostVisible = horizontalDiff < 100 && verticalDiff < 90;
    const wasRecentlyVisible = obj.lastSeenAlpha !== null &&
      calculateHorizontalDiff(deviceAlpha, obj.lastSeenAlpha) < 20 &&
      Math.abs(deviceBeta - obj.lastSeenBeta) < 20;

    const isVisible = shouldBeVisible || (obj.isVisible && almostVisible && wasRecentlyVisible);

    // Сохраняем где последний раз видели
    if (isVisible) {
      obj.lastSeenAlpha = deviceAlpha;
      obj.lastSeenBeta = deviceBeta;
    }

    // Позиция на экране
    let horizontalPos = (deviceAlpha - obj.position.horizontal) / 80;
    if (horizontalPos > 1) horizontalPos = 1;
    if (horizontalPos < -1) horizontalPos = -1;

    let verticalPos = (deviceBeta - obj.position.vertical) / 70;
    if (verticalPos > 1) verticalPos = 1;
    if (verticalPos < -1) verticalPos = -1;

    const screenX = 50 + (horizontalPos * 40);
    const screenY = 50 + (verticalPos * 35);

    // Объект в центре экрана? (±30° по горизонтали, ±25° по вертикали)
    const isInCenter = horizontalDiff < 30 && verticalDiff < 25;

    // ПОКАЗЫВАЕМ/СКРЫВАЕМ
    if (isVisible && !obj.isVisible) {
      obj.isVisible = true;
      obj.element.style.transition = "opacity 0.8s ease, transform 0.8s ease";
      obj.element.style.opacity = "1";
      obj.element.style.transform = "scale(1)";
      obj.element.classList.add("visible");

      obj.element.style.left = `${screenX}%`;
      obj.element.style.top = `${screenY}%`;
    }
    else if (!isVisible && obj.isVisible) {
      obj.isVisible = false;
      obj.element.style.transition = "opacity 1s ease, transform 1s ease";
      obj.element.style.opacity = "0";
      obj.element.style.transform = "scale(0)";
      obj.element.classList.remove("visible", "highlighted");
      obj.isHighlighted = false;
    }
    else if (isVisible && obj.isVisible) {
      obj.element.style.transition = "left 0.5s ease, top 0.5s ease";
      obj.element.style.left = `${screenX}%`;
      obj.element.style.top = `${screenY}%`;
    }

    // Выделение
    if (isInCenter && obj.isVisible && !obj.isHighlighted) {
      obj.isHighlighted = true;
      obj.element.classList.add("highlighted");
      obj.element.style.transform = "scale(1.4)";
      obj.element.style.boxShadow = `0 0 30px ${obj.element.style.color}`;
    }
    else if ((!isInCenter || !obj.isVisible) && obj.isHighlighted) {
      obj.isHighlighted = false;
      obj.element.classList.remove("highlighted");
      obj.element.style.transform = "scale(1)";
      obj.element.style.boxShadow = "none";
    }
  });
}

function handleObjectClick(element, isCorrect, objectId) {
  const obj = virtualObjects.find(o => o.id === objectId);
  if (!obj || !obj.isHighlighted) {
    showMessage("Объект не в центре!", "error");
    if (obj) obj.hasBeenClicked = false;
    return;
  }

  if (isCorrect) {
    showMessage("Верно! Молодец!", "success");

    const targetIndex = mode === "words" ? currentIndex : collectedItems.length;
    const target = taskTargets.children[targetIndex];

    if (target) {
      const targetRect = target.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();

      element.style.transition = "transform 1s cubic-bezier(0.2, 0.8, 0.3, 1), opacity 1s ease";
      element.style.transform = `translate(
        ${targetRect.left + targetRect.width/2 - elementRect.left}px,
        ${targetRect.top + targetRect.height/2 - elementRect.top}px
      ) scale(0.1)`;
      element.style.opacity = "0";
    }

    setTimeout(() => {
      if (element.parentNode) element.remove();
      if (mode === "words") {
        handleCorrectLetter();
      } else {
        handleCorrectItem();
      }

      const index = virtualObjects.findIndex(o => o.id === objectId);
      if (index > -1) virtualObjects.splice(index, 1);
    }, 1000);

  } else {
    showMessage("Это не то, что нужно!", "error");

    element.style.transition = "transform 0.7s ease, opacity 0.7s ease";
    element.style.transform = "scale(0) rotate(180deg)";
    element.style.opacity = "0";

    setTimeout(() => {
      if (element.parentNode) element.remove();
      const index = virtualObjects.findIndex(o => o.id === objectId);
      if (index > -1) virtualObjects.splice(index, 1);
    }, 700);
  }
}

/* ====== РЕЖИМ "СЛОВА" ====== */
function startWordsGame() {
  mode = "words";
  currentWord = WORDS[Math.floor(Math.random() * WORDS.length)];
  currentIndex = 0;

  taskText.textContent = `Собери слово:`;
  taskText.style.fontSize = "18px";
  taskText.style.marginBottom = "5px";

  taskTargets.innerHTML = "";
  for (let i = 0; i < currentWord.length; i++) {
    const span = document.createElement("span");
    span.className = "target-item";
    span.textContent = currentWord[i];
    span.style.fontSize = "24px";
    span.style.color = LETTER_COLORS[i % LETTER_COLORS.length];
    taskTargets.appendChild(span);
  }

  spawnLetterObjects();
}

function spawnLetterObjects() {
  const correctLetter = currentWord[currentIndex];
  const letters = [correctLetter];

  while (letters.length < 3) {
    const randomLetter = ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    if (!letters.includes(randomLetter)) {
      letters.push(randomLetter);
    }
  }

  letters.sort(() => Math.random() - 0.5);
  const correctIndex = letters.findIndex(l => l === correctLetter);

  createVirtualObjects(letters, correctIndex);
  showMessage(`Ищи букву "${correctLetter}"! Смотри подсказку внизу`, "info");
}

function handleCorrectLetter() {
  const targetItems = document.querySelectorAll(".target-item");
  if (targetItems[currentIndex]) {
    targetItems[currentIndex].classList.add("found");
  }

  currentIndex++;

  if (currentIndex >= currentWord.length) {
    setTimeout(() => showScreen(winScreen), 1500);
  } else {
    setTimeout(() => {
      spawnLetterObjects();
    }, 1000);
  }
}

/* ====== РЕЖИМ "ПРЕДМЕТЫ" ====== */
function startItemsGame() {
  mode = "items";
  currentCategory = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  collectedItems = [];

  taskText.textContent = currentCategory.question;
  taskText.style.fontSize = "18px";
  taskText.style.marginBottom = "5px";

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
  const allOtherItems = [];

  CATEGORIES.forEach(cat => {
    cat.items.forEach(item => {
      if (!items.some(i => i.name === item.name)) {
        allOtherItems.push(item);
      }
    });
  });

  while (items.length < 3 && allOtherItems.length > 0) {
    const randomIndex = Math.floor(Math.random() * allOtherItems.length);
    const randomItem = allOtherItems[randomIndex];
    if (!items.some(i => i.name === randomItem.name)) {
      items.push(randomItem);
    }
  }

  items.sort(() => Math.random() - 0.5);
  const contents = items.map(item => item.emoji);
  const correctIndex = items.findIndex(item => item.name === correctItem.name);

  createVirtualObjects(contents, correctIndex);
  showMessage(`Ищи ${correctItem.name.toLowerCase()}! Смотри подсказку внизу`, "info");
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
    setTimeout(() => showScreen(winScreen), 1500);
  } else {
    setTimeout(() => {
      spawnItemObjects();
    }, 1000);
  }
}

/* ====== КНОПКИ ====== */
wordsBtn.addEventListener("click", async () => {
  showScreen(gameScreen);
  const cameraOk = await startCamera();
  if (cameraOk) {
    startGyroscope();
    setTimeout(() => startWordsGame(), 500);
  }
});

itemsBtn.addEventListener("click", async () => {
  showScreen(gameScreen);
  const cameraOk = await startCamera();
  if (cameraOk) {
    startGyroscope();
    setTimeout(() => startItemsGame(), 500);
  }
});

homeBtn.addEventListener("click", () => {
  showScreen(menuScreen);
  virtualObjects.forEach(obj => {
    if (obj.element && obj.element.parentNode) {
      obj.element.remove();
    }
  });
  virtualObjects = [];
  alphaBuffer = [];
  betaBuffer = [];

  if (camera.srcObject) {
    camera.srcObject.getTracks().forEach(track => track.stop());
  }
});

playAgainBtn.addEventListener("click", () => {
  showScreen(gameScreen);
  if (mode === "words") startWordsGame();
  if (mode === "items") startItemsGame();
});

backMenuBtn.addEventListener("click", () => {
  showScreen(menuScreen);
  virtualObjects.forEach(obj => {
    if (obj.element && obj.element.parentNode) {
      obj.element.remove();
    }
  });
  virtualObjects = [];
  alphaBuffer = [];
  betaBuffer = [];

  if (camera.srcObject) {
    camera.srcObject.getTracks().forEach(track => track.stop());
  }
});

/* ====== ЗАПУСК ====== */
console.log("AR игра 'Слова и предметы' загружена");