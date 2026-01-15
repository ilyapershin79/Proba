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

/* ====== ЭКРАНЫ ====== */
function showScreen(screen) {
  [menuScreen, gameScreen, winScreen].forEach(s => s.classList.remove("active"));
  screen.classList.add("active");
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
    console.log("Камера запущена!");
  } catch (e) {
    console.error("Ошибка камеры:", e);
    // Если камера не работает, покажем сообщение
    showMessage("Камера недоступна. Разрешите доступ к камере в настройках браузера.", "error");

    // Покажем заглушку
    camera.style.display = "none";
    gameScreen.style.background = "#000";
    gameScreen.innerHTML += '<div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:white; text-align:center;"><h2>Камера недоступна</h2><p>Разрешите доступ к камере</p></div>';
    return false;
  }
  return true;
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

/* ====== СОЗДАНИЕ ОБЪЕКТОВ ПОВЕРХ КАМЕРЫ ====== */
function createObject(content, isCorrect, index) {
  const obj = document.createElement("div");
  obj.className = "ar-object";
  obj.textContent = content;
  obj.dataset.correct = isCorrect;

  // Позиция на экране (в разных местах)
  const positions = [
    { left: "20%", top: "30%" },   // верхний левый
    { left: "50%", top: "60%" },   // центр
    { left: "70%", top: "40%" }    // правый
  ];

  const pos = positions[index % positions.length];
  obj.style.left = pos.left;
  obj.style.top = pos.top;

  // Анимация появления
  obj.style.opacity = "0";
  obj.style.transform = "scale(0) rotate(-180deg)";

  setTimeout(() => {
    obj.style.transition = "opacity 0.5s ease, transform 0.5s ease";
    obj.style.opacity = "1";
    obj.style.transform = "scale(1) rotate(0deg)";
  }, 100);

  // Наведение
  obj.addEventListener("mouseenter", () => {
    if (!obj.classList.contains("highlighted")) {
      obj.classList.add("highlighted");
      obj.style.transform = "scale(1.2)";
    }
  });

  obj.addEventListener("mouseleave", () => {
    obj.style.transform = "scale(1)";
  });

  // Клик
  obj.addEventListener("click", (e) => {
    e.stopPropagation();
    handleObjectClick(obj, isCorrect);
  });

  gameScreen.appendChild(obj);
  return obj;
}

function handleObjectClick(obj, isCorrect) {
  if (isCorrect) {
    // ПРАВИЛЬНО
    showMessage("Верно! Молодец!", "success");

    // Эффект полёта к цели
    const targetIndex = mode === "words" ? currentIndex : collectedItems.length;
    const target = taskTargets.children[targetIndex];

    if (target) {
      const targetRect = target.getBoundingClientRect();
      const objRect = obj.getBoundingClientRect();

      const flyX = targetRect.left + targetRect.width/2 - objRect.left;
      const flyY = targetRect.top + targetRect.height/2 - objRect.top;

      obj.style.transition = "transform 0.8s cubic-bezier(0.5, 0, 0.5, 1), opacity 0.8s";
      obj.style.transform = `translate(${flyX}px, ${flyY}px) scale(0.1)`;
      obj.style.opacity = "0";
    }

    // Обновление игры
    setTimeout(() => {
      obj.remove();
      if (mode === "words") {
        handleCorrectLetter();
      } else {
        handleCorrectItem();
      }
    }, 800);

  } else {
    // НЕПРАВИЛЬНО
    showMessage("Это не то, что нужно!", "error");

    // Эффект ошибки
    obj.style.transition = "transform 0.5s, opacity 0.5s";
    obj.style.transform = "scale(0) rotate(180deg)";
    obj.style.opacity = "0";

    setTimeout(() => {
      if (obj.parentNode) obj.remove();
    }, 500);
  }
}

function clearObjects() {
  document.querySelectorAll(".ar-object").forEach(el => el.remove());
}

/* ====== РЕЖИМ СЛОВА ====== */
function startWordsGame() {
  mode = "words";
  currentWord = WORDS[Math.floor(Math.random() * WORDS.length)];
  currentIndex = 0;

  // Задание
  taskText.textContent = `Собери слово:`;

  // Цели (буквы слова)
  taskTargets.innerHTML = "";
  for (let i = 0; i < currentWord.length; i++) {
    const span = document.createElement("span");
    span.className = "target-item";
    span.textContent = currentWord[i];
    span.title = `Буква ${currentWord[i]}`;
    taskTargets.appendChild(span);
  }

  showMessage(`Найди букву "${currentWord[0]}" на экране!`, "info");
  spawnLetterObjects();
}

function spawnLetterObjects() {
  clearObjects();

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

  // Создаём объекты
  letters.forEach((letter, index) => {
    const isCorrect = (letter === correctLetter);
    createObject(letter, isCorrect, index);
  });
}

function handleCorrectLetter() {
  // Отмечаем найденную букву
  const targetItems = document.querySelectorAll(".target-item");
  if (targetItems[currentIndex]) {
    targetItems[currentIndex].classList.add("found");
  }

  // Следующая буква
  currentIndex++;

  if (currentIndex >= currentWord.length) {
    // Слово собрано!
    setTimeout(() => {
      showScreen(winScreen);
    }, 1000);
  } else {
    // Ищем следующую букву
    setTimeout(() => {
      spawnLetterObjects();
      showMessage(`Теперь найди букву "${currentWord[currentIndex]}"`, "info");
    }, 500);
  }
}

/* ====== РЕЖИМ ПРЕДМЕТЫ ====== */
function startItemsGame() {
  mode = "items";
  currentCategory = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  collectedItems = [];

  // Задание с вопросом
  taskText.textContent = currentCategory.question;

  // Показываем все предметы, которые нужно найти
  taskTargets.innerHTML = "";
  currentCategory.items.forEach(item => {
    const span = document.createElement("span");
    span.className = "target-item";
    span.textContent = item.emoji;
    span.title = item.name;
    taskTargets.appendChild(span);
  });

  showMessage(`Найди ${currentCategory.items[0].name.toLowerCase()} на экране!`, "info");
  spawnItemObjects();
}

function spawnItemObjects() {
  clearObjects();

  // Находим ещё не собранные предметы
  const neededItems = currentCategory.items.filter(item =>
    !collectedItems.some(collected => collected.name === item.name)
  );

  if (neededItems.length === 0) return;

  const correctItem = neededItems[0];

  // Собираем 3 разных предмета
  const items = [correctItem];
  const allItems = [];

  // Все предметы из других категорий
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

  // Создаём объекты
  items.forEach((item, index) => {
    const isCorrect = (item.name === correctItem.name);
    createObject(item.emoji, isCorrect, index);
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

  // Отмечаем найденный предмет
  const targetItems = document.querySelectorAll(".target-item");
  const itemIndex = currentCategory.items.findIndex(item => item.name === correctItem.name);
  if (targetItems[itemIndex]) {
    targetItems[itemIndex].classList.add("found");
  }

  // Проверяем, все ли собраны
  if (collectedItems.length === currentCategory.items.length) {
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
        showMessage(`Теперь найди ${nextItem.name.toLowerCase()}`, "info");
      }
    }, 500);
  }
}

/* ====== КНОПКИ ====== */
wordsBtn.addEventListener("click", async () => {
  showScreen(gameScreen);
  const cameraStarted = await startCamera();
  if (cameraStarted) {
    setTimeout(() => startWordsGame(), 500);
  }
});

itemsBtn.addEventListener("click", async () => {
  showScreen(gameScreen);
  const cameraStarted = await startCamera();
  if (cameraStarted) {
    setTimeout(() => startItemsGame(), 500);
  }
});

homeBtn.addEventListener("click", () => {
  showScreen(menuScreen);
  clearObjects();

  // Останавливаем камеру
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
  clearObjects();

  // Останавливаем камеру
  if (camera.srcObject) {
    camera.srcObject.getTracks().forEach(track => track.stop());
  }
});

/* ====== ИНИЦИАЛИЗАЦИЯ ====== */
console.log("🎮 AR игра с камерой загружена!");

// Тестовый клик по камере
gameScreen.addEventListener("click", (e) => {
  if (e.target === camera || e.target === gameScreen) {
    showMessage("Нажми на букву или предмет на экране!", "info");
  }
});