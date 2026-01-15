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
let deviceAlpha = 0;   // Горизонтальный поворот (0-360°) - куда смотрит телефон
let deviceBeta = 90;   // Вертикальный наклон (0-180°) - вверх/вниз
let deviceGamma = 0;   // Наклон влево/вправо (-90 до 90)

/* ====== ВИРТУАЛЬНЫЕ ОБЪЕКТЫ ====== */
let virtualObjects = [];

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

/* ====== ГИРОСКОП ====== */
function startGyroscope() {
  if (window.DeviceOrientationEvent) {
    window.addEventListener("deviceorientation", (event) => {
      deviceAlpha = event.alpha || 0;   // 0-360 градусов (горизонталь)
      deviceBeta = event.beta || 90;    // 0-180 градусов (вертикаль)
      deviceGamma = event.gamma || 0;   // -90-90 градусов (наклон)
      updateObjectsPosition();
    });
    console.log("Гироскоп работает");
  } else {
    console.log("Гироскоп не поддерживается");
    // Для теста на компьютере
    deviceAlpha = 0;
    deviceBeta = 90;
    deviceGamma = 0;
  }
}

/* ====== СООБЩЕНИЯ ====== */
function showMessage(text, type = "info") {
  message.textContent = text;
  message.className = type;
  message.classList.add("show");
  setTimeout(() => message.classList.remove("show"), 2000);
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
  // Каждому объекту: горизонтальный угол (alpha) и вертикальный угол (beta)
  const positions = [];

  // Всегда 3 объекта
  for (let i = 0; i < 3; i++) {
    // Генерируем случайные углы для каждого объекта
    // Горизонталь: 0-360° (полный круг)
    // Вертикаль: 30-150° (чтобы не слишком высоко/низко)
    const horizontal = Math.floor(Math.random() * 360); // 0-359°
    const vertical = 30 + Math.floor(Math.random() * 120); // 30-149°

    positions.push({
      horizontal: horizontal,  // Куда смотреть горизонтально
      vertical: vertical,      // Куда смотреть вертикально
      id: i
    });
  }

  // Убедимся что объекты не слишком близко друг к другу
  // Минимальное расстояние: 60° по горизонтали, 40° по вертикали
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      let hDiff = Math.abs(positions[i].horizontal - positions[j].horizontal);
      if (hDiff > 180) hDiff = 360 - hDiff;

      let vDiff = Math.abs(positions[i].vertical - positions[j].vertical);

      // Если слишком близко - перемещаем второй объект
      if (hDiff < 60 && vDiff < 40) {
        positions[j].horizontal = (positions[j].horizontal + 120) % 360;
        positions[j].vertical = Math.min(150, Math.max(30, positions[j].vertical + 50));
      }
    }
  }

  contents.forEach((content, index) => {
    const obj = {
      id: `obj_${Date.now()}_${index}`,
      content: content,
      isCorrect: index === correctIndex,
      position: positions[index], // Фиксированное положение в пространстве
      element: null,
      isVisible: false,
      hasBeenClicked: false
    };

    // Создаём DOM элемент
    const element = document.createElement("div");
    element.className = "ar-object";
    element.textContent = content;
    element.dataset.correct = obj.isCorrect;
    element.dataset.id = obj.id;

    // Начально скрыт
    element.style.opacity = "0";
    element.style.transform = "scale(0)";
    element.style.left = "50%";
    element.style.top = "50%";
    element.style.position = "absolute";

    // Клик
    element.addEventListener("click", (e) => {
      e.stopPropagation();
      if (obj.hasBeenClicked) return;
      obj.hasBeenClicked = true;
      handleObjectClick(element, obj.isCorrect);
    });

    gameScreen.appendChild(element);
    obj.element = element;
    virtualObjects.push(obj);
  });

  updateObjectsPosition();
}

function updateObjectsPosition() {
  virtualObjects.forEach(obj => {
    if (!obj.element || obj.hasBeenClicked) return;

    // РАСЧЕТ ВИДИМОСТИ ОБЪЕКТА
    // Объект зафиксирован в пространстве: obj.position.horizontal и obj.position.vertical
    // Телефон смотрит: deviceAlpha и deviceBeta

    // 1. Разница по горизонтали
    let horizontalDiff = Math.abs(deviceAlpha - obj.position.horizontal);
    if (horizontalDiff > 180) {
      horizontalDiff = 360 - horizontalDiff;
    }

    // 2. Разница по вертикали
    let verticalDiff = Math.abs(deviceBeta - obj.position.vertical);

    // 3. Объект виден если телефон смотрит примерно в его направлении
    // ±40° по горизонтали, ±30° по вертикали
    const isVisible = horizontalDiff < 40 && verticalDiff < 30;

    // 4. Позиция на экране зависит от точности наведения
    // Чем точнее смотрим на объект, тем он ближе к центру

    // Горизонтальная позиция: -1 (край левый) до 1 (край правый)
    let horizontalPos = (deviceAlpha - obj.position.horizontal) / 40;
    if (horizontalPos > 1) horizontalPos = 1;
    if (horizontalPos < -1) horizontalPos = -1;

    // Вертикальная позиция: -1 (верх) до 1 (низ)
    let verticalPos = (deviceBeta - obj.position.vertical) / 30;
    if (verticalPos > 1) verticalPos = 1;
    if (verticalPos < -1) verticalPos = -1;

    // Преобразуем в проценты экрана (центр = 50%)
    const screenX = 50 + (horizontalPos * 30);  // 20%..80%
    const screenY = 50 + (verticalPos * 25);    // 25%..75%

    // Объект в центре экрана?
    const isInCenter = horizontalDiff < 20 && verticalDiff < 15;

    // ПОКАЗЫВАЕМ объект
    if (isVisible && !obj.isVisible) {
      obj.isVisible = true;
      obj.element.style.transition = "opacity 0.6s ease, transform 0.6s ease, left 0.4s ease, top 0.4s ease";
      obj.element.style.opacity = "1";
      obj.element.style.transform = "scale(1)";
      obj.element.classList.add("visible");

      obj.element.style.left = `${screenX}%`;
      obj.element.style.top = `${screenY}%`;
    }
    // СКРЫВАЕМ объект
    else if (!isVisible && obj.isVisible) {
      obj.isVisible = false;
      obj.element.style.transition = "opacity 0.4s ease, transform 0.4s ease";
      obj.element.style.opacity = "0";
      obj.element.style.transform = "scale(0)";
      obj.element.classList.remove("visible", "highlighted");
    }
    // ДВИГАЕМ объект на экране (плавно следим)
    else if (isVisible && obj.isVisible) {
      obj.element.style.transition = "left 0.3s ease, top 0.3s ease";
      obj.element.style.left = `${screenX}%`;
      obj.element.style.top = `${screenY}%`;
    }

    // Выделение если объект в центре
    if (isInCenter && obj.isVisible) {
      obj.element.classList.add("highlighted");
    } else {
      obj.element.classList.remove("highlighted");
    }
  });
}

function handleObjectClick(element, isCorrect) {
  if (!element.classList.contains("highlighted")) {
    showMessage("Наведи объект в центр экрана!", "error");
    return;
  }

  if (isCorrect) {
    // ПРАВИЛЬНО
    showMessage("Верно! Молодец!", "success");

    // Анимация полёта к панели
    const targetIndex = mode === "words" ? currentIndex : collectedItems.length;
    const target = taskTargets.children[targetIndex];

    if (target) {
      const targetRect = target.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();

      element.style.transition = "transform 0.8s cubic-bezier(0.2, 0.8, 0.3, 1), opacity 0.8s ease";
      element.style.transform = `translate(
        ${targetRect.left + targetRect.width/2 - elementRect.left}px,
        ${targetRect.top + targetRect.height/2 - elementRect.top}px
      ) scale(0.1)`;
      element.style.opacity = "0";
      element.style.zIndex = "1000";
    }

    setTimeout(() => {
      if (element.parentNode) {
        element.remove();
      }
      if (mode === "words") {
        handleCorrectLetter();
      } else {
        handleCorrectItem();
      }
    }, 800);

  } else {
    // НЕПРАВИЛЬНО
    showMessage("Это не то, что нужно!", "error");

    element.style.transition = "transform 0.5s ease, opacity 0.5s ease";
    element.style.transform = "scale(0) rotate(180deg)";
    element.style.opacity = "0";

    setTimeout(() => {
      if (element.parentNode) {
        element.remove();
      }
    }, 500);
  }
}

/* ====== РЕЖИМ "СЛОВА" ====== */
function startWordsGame() {
  mode = "words";
  currentWord = WORDS[Math.floor(Math.random() * WORDS.length)];
  currentIndex = 0;

  // МАЛЕНЬКАЯ ПАНЕЛЬ ЗАДАНИЯ
  taskText.textContent = `Собери слово:`;
  taskText.style.fontSize = "18px";
  taskText.style.marginBottom = "5px";

  taskTargets.innerHTML = "";
  for (let i = 0; i < currentWord.length; i++) {
    const span = document.createElement("span");
    span.className = "target-item";
    span.textContent = currentWord[i];
    span.style.fontSize = "24px";
    taskTargets.appendChild(span);
  }

  spawnLetterObjects();
}

function spawnLetterObjects() {
  const correctLetter = currentWord[currentIndex];

  // 3 разные буквы
  const letters = [correctLetter];
  while (letters.length < 3) {
    const randomLetter = ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    if (!letters.includes(randomLetter) && randomLetter !== correctLetter) {
      letters.push(randomLetter);
    }
  }

  // Перемешиваем
  letters.sort(() => Math.random() - 0.5);

  // Находим индекс правильной буквы
  const correctIndex = letters.findIndex(l => l === correctLetter);

  // Создаём виртуальные объекты
  createVirtualObjects(letters, correctIndex);

  showMessage(`Ищи букву "${correctLetter}"! Поворачивай телефон во все стороны`, "info");
}

function handleCorrectLetter() {
  const targetItems = document.querySelectorAll(".target-item");
  if (targetItems[currentIndex]) {
    targetItems[currentIndex].classList.add("found");
  }

  currentIndex++;

  if (currentIndex >= currentWord.length) {
    // Слово собрано
    setTimeout(() => {
      showScreen(winScreen);
    }, 1000);
  } else {
    // Следующая буква
    setTimeout(() => {
      spawnLetterObjects();
      showMessage(`Теперь ищи букву "${currentWord[currentIndex]}"`, "info");
    }, 600);
  }
}

/* ====== РЕЖИМ "ПРЕДМЕТЫ" ====== */
function startItemsGame() {
  mode = "items";
  currentCategory = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  collectedItems = [];

  // ПАНЕЛЬ ЗАДАНИЯ С ВОПРОСОМ
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

  // Собираем другие случайные предметы
  const allOtherItems = [];
  CATEGORIES.forEach(cat => {
    if (cat.name !== currentCategory.name) {
      cat.items.forEach(item => {
        if (!items.some(i => i.name === item.name) &&
            !collectedItems.some(col => col.name === item.name)) {
          allOtherItems.push(item);
        }
      });
    }
  });

  // Добавляем случайные неправильные предметы
  while (items.length < 3 && allOtherItems.length > 0) {
    const randomIndex = Math.floor(Math.random() * allOtherItems.length);
    const randomItem = allOtherItems[randomIndex];
    if (!items.some(i => i.name === randomItem.name)) {
      items.push(randomItem);
      allOtherItems.splice(randomIndex, 1);
    }
  }

  // Перемешиваем
  items.sort(() => Math.random() - 0.5);

  const contents = items.map(item => item.emoji);
  const correctIndex = items.findIndex(item => item.name === correctItem.name);

  createVirtualObjects(contents, correctIndex);
  showMessage(`Ищи ${correctItem.name.toLowerCase()}! Поворачивай телефон`, "info");
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
      const nextItem = currentCategory.items.find(item =>
        !collectedItems.some(collected => collected.name === item.name)
      );
      if (nextItem) {
        showMessage(`Теперь ищи ${nextItem.name.toLowerCase()}`, "info");
      }
    }, 600);
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

// Кнопка домой ВНИЗУ
homeBtn.addEventListener("click", () => {
  showScreen(menuScreen);
  virtualObjects.forEach(obj => {
    if (obj.element && obj.element.parentNode) {
      obj.element.remove();
    }
  });
  virtualObjects = [];

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

  if (camera.srcObject) {
    camera.srcObject.getTracks().forEach(track => track.stop());
  }
});

/* ====== ЗАПУСК ====== */
console.log("AR игра 'Слова и предметы' загружена");