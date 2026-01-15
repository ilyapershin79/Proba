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
let deviceGamma = 0; // Наклон влево/вправо (-90 до 90)
let deviceBeta = 90; // Наклон вперед/назад (0 до 180)

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
      deviceGamma = event.gamma || 0; // -90..90
      deviceBeta = event.beta || 90;   // 0..180
      updateObjectsPosition();
    });
    console.log("Гироскоп работает");
  } else {
    console.log("Гироскоп не поддерживается");
    // Для теста на компьютере
    deviceGamma = 0;
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

/* ====== ВИРТУАЛЬНЫЕ ОБЪЕКТЫ ====== */
function createVirtualObjects(contents, correctIndex) {
  // Удаляем старые объекты
  virtualObjects.forEach(obj => {
    if (obj.element && obj.element.parentNode) {
      obj.element.remove();
    }
  });
  virtualObjects = [];

  // 6 разных мест В МИРЕ - каждый в своем направлении
  const positions = [
    { direction: "left", x: -30, y: 0 },     // СЛЕВА
    { direction: "right", x: 30, y: 0 },     // СПРАВА
    { direction: "up", x: 0, y: 25 },        // СВЕРХУ
    { direction: "down", x: 0, y: -20 },     // СНИЗУ
    { direction: "left-up", x: -20, y: 15 }, // СЛЕВА-СВЕРХУ
    { direction: "right-down", x: 20, y: -15 } // СПРАВА-СНИЗУ
  ];

  contents.forEach((content, index) => {
    const obj = {
      id: `obj_${Date.now()}_${index}`,
      content: content,
      isCorrect: index === correctIndex,
      position: positions[index], // Фиксированная позиция в мире
      element: null,
      isVisible: false
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

    // Клик
    element.addEventListener("click", () => {
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
    if (!obj.element) return;

    // КАЖДЫЙ ОБЪЕКТ В СВОЕМ МЕСТЕ МИРА
    // Объект виден ТОЛЬКО когда телефон смотрит в его сторону

    let isVisible = false;
    let screenX = 50;
    let screenY = 50;

    // Определяем видимость по направлению объекта
    switch(obj.position.direction) {
      case "left": // Объект СЛЕВА
        isVisible = deviceGamma < -20; // Телефон повернут влево
        screenX = 30; // Показываем слева на экране
        screenY = 50;
        break;

      case "right": // Объект СПРАВА
        isVisible = deviceGamma > 20; // Телефон повернут вправо
        screenX = 70; // Показываем справа на экране
        screenY = 50;
        break;

      case "up": // Объект СВЕРХУ
        isVisible = deviceBeta < 70; // Телефон смотрит вверх
        screenX = 50;
        screenY = 30; // Показываем вверху на экране
        break;

      case "down": // Объект СНИЗУ
        isVisible = deviceBeta > 110; // Телефон смотрит вниз
        screenX = 50;
        screenY = 70; // Показываем внизу на экране
        break;

      case "left-up": // Объект СЛЕВА-СВЕРХУ
        isVisible = deviceGamma < -10 && deviceBeta < 80;
        screenX = 35;
        screenY = 35;
        break;

      case "right-down": // Объект СПРАВА-СНИЗУ
        isVisible = deviceGamma > 10 && deviceBeta > 100;
        screenX = 65;
        screenY = 65;
        break;
    }

    // Проверяем, в центре ли экрана
    const isInCenter =
      Math.abs(screenX - 50) < 15 &&
      Math.abs(screenY - 50) < 15;

    if (isVisible && !obj.isVisible) {
      // ПОЯВЛЕНИЕ объекта (повернули телефон в его сторону)
      obj.isVisible = true;
      obj.element.style.transition = "opacity 0.5s, transform 0.5s, left 0.3s, top 0.3s";
      obj.element.style.opacity = "1";
      obj.element.style.transform = "scale(1)";
      obj.element.classList.add("visible");

      obj.element.style.left = `${screenX}%`;
      obj.element.style.top = `${screenY}%`;

    } else if (!isVisible && obj.isVisible) {
      // ИСЧЕЗНОВЕНИЕ объекта (отвернули телефон)
      obj.isVisible = false;
      obj.element.style.transition = "opacity 0.3s, transform 0.3s";
      obj.element.style.opacity = "0";
      obj.element.style.transform = "scale(0)";
      obj.element.classList.remove("visible", "highlighted");

    } else if (isVisible && obj.isVisible) {
      // Обновляем позицию на экране
      obj.element.style.transition = "left 0.2s, top 0.2s";
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

      element.style.transition = "transform 0.8s cubic-bezier(0.5, 0, 0.5, 1), opacity 0.8s";
      element.style.transform = `translate(
        ${targetRect.left + targetRect.width/2 - elementRect.left}px,
        ${targetRect.top + targetRect.height/2 - elementRect.top}px
      ) scale(0.1)`;
      element.style.opacity = "0";
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

    element.style.transition = "transform 0.5s, opacity 0.5s";
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
    if (!letters.includes(randomLetter)) {
      letters.push(randomLetter);
    }
  }

  // Перемешиваем
  letters.sort(() => Math.random() - 0.5);

  // Находим индекс правильной буква
  const correctIndex = letters.findIndex(l => l === correctLetter);

  // Создаём виртуальные объекты
  createVirtualObjects(letters, correctIndex);

  showMessage(`Ищи букву "${correctLetter}"! Крути телефон во все стороны`, "info");
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
    }, 500);
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

  const contents = items.map(item => item.emoji);
  const correctIndex = items.findIndex(item => item.name === correctItem.name);

  createVirtualObjects(contents, correctIndex);
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
    }, 500);
  }
}

/* ====== КНОПКИ ====== */
wordsBtn.addEventListener("click", async () => {
  showScreen(gameScreen);
  const cameraOk = await startCamera();
  if (cameraOk) {
    startGyroscope();
    setTimeout(() => startWordsGame(), 300);
  }
});

itemsBtn.addEventListener("click", async () => {
  showScreen(gameScreen);
  const cameraOk = await startCamera();
  if (cameraOk) {
    startGyroscope();
    setTimeout(() => startItemsGame(), 300);
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