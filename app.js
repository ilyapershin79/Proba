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
let isGameActive = false;

/* ====== ГИРОСКОП ====== */
let deviceGamma = 0; // Наклон влево/вправо
let deviceBeta = 90; // Наклон вперед/назад
let deviceAlpha = 0; // Поворот вокруг оси

/* ====== ВИРТУАЛЬНЫЕ ОБЪЕКТЫ ====== */
let virtualObjects = [];
let objectPositions = [];

/* ====== ЭКРАНЫ ====== */
function showScreen(screen) {
  [menuScreen, gameScreen, winScreen].forEach(s => {
    s.classList.remove("active");
    s.style.display = "none";
  });
  screen.classList.add("active");
  screen.style.display = "flex";
}

/* ====== КАМЕРА ====== */
async function startCamera() {
  try {
    // Останавливаем предыдущую камеру если была
    if (camera.srcObject) {
      camera.srcObject.getTracks().forEach(track => track.stop());
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    camera.srcObject = stream;
    camera.play();

    return new Promise((resolve) => {
      camera.onloadedmetadata = () => {
        console.log("Камера работает, разрешение:", camera.videoWidth, "x", camera.videoHeight);
        resolve(true);
      };

      camera.onerror = () => {
        console.error("Ошибка загрузки видео");
        resolve(false);
      };
    });
  } catch (err) {
    console.error("Ошибка камеры:", err);
    showMessage("Разрешите доступ к камере!", "error");
    return false;
  }
}

/* ====== ГИРОСКОП ====== */
function startGyroscope() {
  if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
    // iOS 13+
    DeviceOrientationEvent.requestPermission()
      .then(permissionState => {
        if (permissionState === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation);
          console.log("Гироскоп разрешён на iOS");
        } else {
          console.log("Гироскоп не разрешён");
          useFallbackGyro();
        }
      })
      .catch(console.error);
  } else if (window.DeviceOrientationEvent) {
    // Android и другие
    window.addEventListener('deviceorientation', handleOrientation);
    console.log("Гироскоп запущен");
  } else {
    console.log("Гироскоп не поддерживается");
    useFallbackGyro();
  }
}

function handleOrientation(event) {
  if (!isGameActive) return;

  deviceGamma = event.gamma || 0; // -90..90 (влево/вправо)
  deviceBeta = event.beta || 90;   // -180..180 (вперёд/назад)
  deviceAlpha = event.alpha || 0;  // 0..360 (поворот)

  updateObjectsPosition();
}

function useFallbackGyro() {
  console.log("Используем эмуляцию гироскопа для теста");

  // Для теста на компьютере - управление мышкой
  if (window.innerWidth > 768) {
    document.addEventListener('mousemove', (e) => {
      if (!isGameActive) return;

      deviceGamma = ((e.clientX / window.innerWidth) * 180) - 90;
      deviceBeta = ((e.clientY / window.innerHeight) * 180) - 90;

      updateObjectsPosition();
    });
  }
}

/* ====== СООБЩЕНИЯ ====== */
function showMessage(text, type = "info") {
  message.textContent = text;
  message.className = type;
  message.classList.add("show");

  setTimeout(() => {
    message.classList.remove("show");
  }, 2500);
}

/* ====== СОЗДАНИЕ ПОЗИЦИЙ ДЛЯ ОБЪЕКТОВ ====== */
function generateObjectPositions() {
  // 6 разных позиций вокруг пользователя
  return [
    { x: -8, y: 0, z: 5 },   // Слева
    { x: 8, y: 0, z: 5 },    // Справа
    { x: 0, y: 6, z: 4 },    // Сверху
    { x: 0, y: -4, z: 6 },   // Снизу
    { x: -5, y: 3, z: 7 },   // Слева-сверху
    { x: 5, y: -2, z: 8 },   // Справа-снизу
    { x: -6, y: -3, z: 5 },  // Слева-снизу
    { x: 6, y: 3, z: 6 }     // Справа-сверху
  ];
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

  // Генерируем новые позиции
  objectPositions = generateObjectPositions();

  // Перемешиваем позиции
  const shuffledPositions = [...objectPositions].sort(() => Math.random() - 0.5);

  contents.forEach((content, index) => {
    const obj = {
      id: `obj_${Date.now()}_${index}`,
      content: content,
      isCorrect: index === correctIndex,
      position: shuffledPositions[index] || shuffledPositions[0],
      element: null,
      isVisible: false,
      hasBeenClicked: false
    };

    // Создаём DOM элемент
    const element = document.createElement("div");
    element.className = "ar-object";
    element.textContent = content;
    element.dataset.id = obj.id;
    element.dataset.correct = obj.isCorrect;

    // Начально скрыт
    element.style.opacity = "0";
    element.style.transform = "scale(0)";
    element.style.left = "50%";
    element.style.top = "50%";

    // Клик
    element.addEventListener("click", (e) => {
      e.stopPropagation();
      if (obj.hasBeenClicked) return;
      obj.hasBeenClicked = true;
      handleObjectClick(element, obj.isCorrect, obj.content);
    });

    gameScreen.appendChild(element);
    obj.element = element;
    virtualObjects.push(obj);
  });

  // Первое обновление позиций
  updateObjectsPosition();
}

function updateObjectsPosition() {
  if (!isGameActive || virtualObjects.length === 0) return;

  virtualObjects.forEach(obj => {
    if (!obj.element || obj.hasBeenClicked) return;

    // Преобразуем мировые координаты в экранные
    // deviceGamma влияет на горизонталь, deviceBeta на вертикаль
    let screenX = 50 + (obj.position.x * 1.5) - (deviceGamma * 0.5);
    let screenY = 50 + (obj.position.y * 1.2) - ((deviceBeta - 90) * 0.5);

    // Ограничиваем границы экрана
    screenX = Math.max(5, Math.min(95, screenX));
    screenY = Math.max(10, Math.min(90, screenY));

    // Объект виден если он в пределах экрана
    const isVisible = true; // Всегда видим, если создан

    // Проверяем, в центре ли экрана (для выделения)
    const distanceToCenter = Math.sqrt(
      Math.pow(screenX - 50, 2) + Math.pow(screenY - 50, 2)
    );
    const isInCenter = distanceToCenter < 20; // 20% от центра

    if (isVisible && !obj.isVisible) {
      // ПОЯВЛЕНИЕ объекта
      obj.isVisible = true;
      obj.element.style.transition = "opacity 0.6s ease, transform 0.6s ease";
      obj.element.style.opacity = "1";
      obj.element.style.transform = "scale(1)";

      // Плавная установка позиции
      requestAnimationFrame(() => {
        obj.element.style.transition = "left 0.3s ease, top 0.3s ease";
        obj.element.style.left = `${screenX}%`;
        obj.element.style.top = `${screenY}%`;
      });

    } else if (!isVisible && obj.isVisible) {
      // ИСЧЕЗНОВЕНИЕ объекта
      obj.isVisible = false;
      obj.element.style.transition = "opacity 0.4s ease, transform 0.4s ease";
      obj.element.style.opacity = "0";
      obj.element.style.transform = "scale(0)";
      obj.element.classList.remove("highlighted");

    } else if (isVisible && obj.isVisible) {
      // Обновление позиции
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

function handleObjectClick(element, isCorrect, content) {
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

      const deltaX = (targetRect.left + targetRect.width/2) - (elementRect.left + elementRect.width/2);
      const deltaY = (targetRect.top + targetRect.height/2) - (elementRect.top + elementRect.height/2);

      element.style.transition = "transform 0.8s cubic-bezier(0.2, 0.8, 0.3, 1), opacity 0.8s ease";
      element.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(0.1)`;
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
  isGameActive = true;
  currentWord = WORDS[Math.floor(Math.random() * WORDS.length)];
  currentIndex = 0;

  // Маленькая панель задания
  taskText.textContent = `Собери слово:`;
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
    isGameActive = false;
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
  isGameActive = true;
  currentCategory = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  collectedItems = [];

  // Панель задания
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
  const neededItems = currentCategory.items.filter(item =>
    !collectedItems.some(collected => collected.name === item.name)
  );

  if (neededItems.length === 0) return;

  const correctItem = neededItems[0];
  const items = [correctItem];

  // Собираем другие случайные предметы из других категорий
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
    // Все предметы собраны
    isGameActive = false;
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

/* ====== ОЧИСТКА ИГРЫ ====== */
function cleanupGame() {
  isGameActive = false;

  virtualObjects.forEach(obj => {
    if (obj.element && obj.element.parentNode) {
      obj.element.remove();
    }
  });
  virtualObjects = [];

  if (camera.srcObject) {
    camera.srcObject.getTracks().forEach(track => track.stop());
    camera.srcObject = null;
  }

  // Убираем слушатели гироскопа
  window.removeEventListener('deviceorientation', handleOrientation);
  document.removeEventListener('mousemove', useFallbackGyro);
}

/* ====== КНОПКИ ====== */
wordsBtn.addEventListener("click", async () => {
  showScreen(gameScreen);
  const cameraOk = await startCamera();
  if (cameraOk) {
    startGyroscope();
    setTimeout(() => startWordsGame(), 500);
  } else {
    showScreen(menuScreen);
  }
});

itemsBtn.addEventListener("click", async () => {
  showScreen(gameScreen);
  const cameraOk = await startCamera();
  if (cameraOk) {
    startGyroscope();
    setTimeout(() => startItemsGame(), 500);
  } else {
    showScreen(menuScreen);
  }
});

homeBtn.addEventListener("click", () => {
  cleanupGame();
  showScreen(menuScreen);
});

playAgainBtn.addEventListener("click", () => {
  showScreen(gameScreen);
  cleanupGame();

  setTimeout(async () => {
    const cameraOk = await startCamera();
    if (cameraOk) {
      startGyroscope();
      if (mode === "words") {
        startWordsGame();
      } else if (mode === "items") {
        startItemsGame();
      }
    }
  }, 300);
});

backMenuBtn.addEventListener("click", () => {
  cleanupGame();
  showScreen(menuScreen);
});

/* ====== ЗАПУСК ====== */
console.log("AR игра 'Слова и предметы' загружена");

// Автоматическое тестирование на ПК
if (window.innerWidth > 768) {
  console.log("Режим тестирования на ПК активирован");
  console.log("Двигайте мышкой для имитации гироскопа");
}