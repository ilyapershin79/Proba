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
let objects = [];
let cameraStream = null;

/* ====== ЭКРАНЫ ====== */
function showScreen(screen) {
  [menuScreen, gameScreen, winScreen].forEach(s => s.classList.remove("active"));
  screen.classList.add("active");
}

/* ====== КАМЕРА (РАБОЧАЯ) ====== */
async function startCamera() {
  console.log("Запуск камеры...");

  // Останавливаем предыдущую камеру если есть
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    camera.srcObject = cameraStream;
    camera.play();

    console.log("Камера запущена успешно!");
    return true;

  } catch (error) {
    console.error("ОШИБКА КАМЕРЫ:", error);

    // Показываем ошибку пользователю
    let errorMsg = "Не удалось запустить камеру. ";

    if (error.name === 'NotAllowedError') {
      errorMsg += "Разрешите доступ к камере в настройках браузера.";
    } else if (error.name === 'NotFoundError') {
      errorMsg += "Камера не найдена.";
    } else if (error.name === 'NotReadableError') {
      errorMsg += "Камера уже используется другим приложением.";
    } else {
      errorMsg += "Попробуйте перезагрузить страницу.";
    }

    alert(errorMsg);

    // Фолбэк - чёрный фон
    camera.style.display = "none";
    gameScreen.style.background = "#000";

    return false;
  }
}

/* ====== ЭФФЕКТЫ ====== */
function showMessage(text, type = "info") {
  message.textContent = text;
  message.className = "";
  message.classList.add(type, "show");

  setTimeout(() => message.classList.remove("show"), 2000);
}

function playSound(sound) {
  if (!sound) return;
  try {
    sound.currentTime = 0;
    sound.play().catch(e => console.log("Звук не воспроизведён:", e));
  } catch (e) {
    console.log("Ошибка звука:", e);
  }
}

function createParticles(x, y, color = "#ffd700", count = 15) {
  for (let i = 0; i < count; i++) {
    const particle = document.createElement("div");
    particle.style.cssText = `
      position: absolute;
      width: 8px;
      height: 8px;
      background: ${color};
      border-radius: 50%;
      left: ${x}px;
      top: ${y}px;
      pointer-events: none;
      z-index: 1000;
    `;

    effectsContainer.appendChild(particle);

    const angle = Math.random() * Math.PI * 2;
    const distance = 30 + Math.random() * 70;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance;

    particle.animate([
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${tx}px, ${ty}px) scale(0)`, opacity: 0 }
    ], {
      duration: 800,
      easing: 'ease-out'
    });

    setTimeout(() => particle.remove(), 800);
  }
}

function createSparkle(element) {
  const rect = element.getBoundingClientRect();
  createParticles(rect.left + rect.width/2, rect.top + rect.height/2, "#00ffaa", 8);
}

/* ====== СОЗДАНИЕ AR ОБЪЕКТОВ ====== */
function createObject(content, isCorrect, index) {
  const obj = document.createElement("div");
  obj.className = "ar-object";
  obj.textContent = content;
  obj.dataset.correct = isCorrect;

  // Разные позиции на экране
  const positions = [
    { left: "15%", top: "30%" },
    { left: "50%", top: "60%" },
    { left: "75%", top: "35%" }
  ];

  const pos = positions[index % positions.length];
  obj.style.left = pos.left;
  obj.style.top = pos.top;

  // Анимация появления
  obj.style.opacity = "0";
  obj.style.transform = "scale(0) rotate(-180deg)";

  // Наведение
  obj.addEventListener("mouseenter", () => {
    if (!obj.classList.contains("highlighted")) {
      obj.classList.add("highlighted");
      playSound(soundHover);
      createSparkle(obj);
    }
  });

  obj.addEventListener("mouseleave", () => {
    obj.classList.remove("highlighted");
  });

  // Клик
  obj.addEventListener("click", (e) => {
    e.stopPropagation();
    handleObjectClick(obj, isCorrect);
  });

  // Для мобильных
  obj.addEventListener("touchstart", (e) => {
    e.preventDefault();
    obj.classList.add("highlighted");
    playSound(soundHover);
    createSparkle(obj);
  });

  obj.addEventListener("touchend", (e) => {
    e.preventDefault();
    handleObjectClick(obj, isCorrect);
  });

  arContainer.appendChild(obj);
  objects.push(obj);

  // Анимация появления
  setTimeout(() => {
    obj.style.transition = "opacity 0.5s ease, transform 0.5s ease";
    obj.style.opacity = "1";
    obj.style.transform = "scale(1) rotate(0deg)";
  }, 100 + index * 200);

  return obj;
}

function handleObjectClick(obj, isCorrect) {
  const rect = obj.getBoundingClientRect();

  if (isCorrect) {
    // ПРАВИЛЬНО
    playSound(soundCorrect);
    showMessage("Верно! Отлично!", "success");
    createParticles(rect.left + rect.width/2, rect.top + rect.height/2, "#2ecc71", 20);

    // Полёт к цели
    const targetIndex = mode === "words" ? currentIndex : collectedItems.length;
    const target = taskTargets.children[targetIndex];

    if (target) {
      const targetRect = target.getBoundingClientRect();
      const targetX = targetRect.left + targetRect.width/2 - rect.left;
      const targetY = targetRect.top + targetRect.height/2 - rect.top;

      obj.style.transition = "transform 0.8s cubic-bezier(0.5, 0, 0.5, 1), opacity 0.8s";
      obj.style.transform = `translate(${targetX}px, ${targetY}px) scale(0.1)`;
      obj.style.opacity = "0";
      obj.style.zIndex = "1000";
    }

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
    playSound(soundWrong);
    showMessage("Это не то, что нужно!", "error");
    createParticles(rect.left + rect.width/2, rect.top + rect.height/2, "#e74c3c", 10);

    obj.style.transition = "transform 0.5s, opacity 0.5s";
    obj.style.transform = "scale(0.5) rotate(180deg)";
    obj.style.opacity = "0";

    setTimeout(() => {
      if (obj.parentNode) obj.remove();
    }, 500);
  }
}

function clearObjects() {
  objects.forEach(obj => {
    if (obj.parentNode) obj.remove();
  });
  objects = [];
  arContainer.innerHTML = "";
}

/* ====== РЕЖИМ СЛОВА ====== */
function startWordsGame() {
  mode = "words";
  currentWord = WORDS[Math.floor(Math.random() * WORDS.length)];
  currentIndex = 0;

  taskText.textContent = "Собери слово:";

  taskTargets.innerHTML = "";
  for (let i = 0; i < currentWord.length; i++) {
    const span = document.createElement("span");
    span.className = "target-item";
    span.textContent = currentWord[i];
    taskTargets.appendChild(span);
  }

  showMessage(`Найди букву "${currentWord[0]}"!`, "info");
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
      showMessage(`Теперь найди букву "${currentWord[currentIndex]}"`, "info");
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

  showMessage(`Найди ${currentCategory.items[0].name.toLowerCase()}!`, "info");
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
      allItems.splice(randomIndex, 1);
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
      const nextItem = currentCategory.items.find(item =>
        !collectedItems.some(collected => collected.name === item.name)
      );
      if (nextItem) {
        showMessage(`Теперь найди ${nextItem.name.toLowerCase()}!`, "info");
      }
    }, 500);
  }
}

/* ====== КНОПКИ ====== */
wordsBtn.addEventListener("click", async () => {
  showScreen(gameScreen);
  const cameraOk = await startCamera();
  if (cameraOk) {
    setTimeout(() => startWordsGame(), 500);
  }
});

itemsBtn.addEventListener("click", async () => {
  showScreen(gameScreen);
  const cameraOk = await startCamera();
  if (cameraOk) {
    setTimeout(() => startItemsGame(), 500);
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

/* ====== КЛИК ПО КАМЕРЕ ====== */
gameScreen.addEventListener("click", (e) => {
  if (e.target === camera || e.target === gameScreen) {
    showMessage("Нажимай на буквы и предметы на экране!", "info");
  }
});

/* ====== АДАПТАЦИЯ ПОД МОБИЛЬНЫЕ ====== */
document.addEventListener('touchmove', (e) => {
  if (e.target === camera || e.target === gameScreen) {
    e.preventDefault();
  }
}, { passive: false });

/* ====== ЗАПУСК ====== */
console.log("AR игра с камерой и эффектами загружена!");