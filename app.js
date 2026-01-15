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

/* ====== СОСТОЯНИЕ ИГРЫ ====== */
let gameMode = null; // 'words' или 'items'
let currentWord = "";
let currentLetterIndex = 0;
let currentCategory = null;
let collectedItems = [];

/* ====== AR СИСТЕМА ====== */
let cameraStream = null;
let deviceOrientation = { alpha: 0, beta: 90, gamma: 0 };
let virtualObjects = [];
let objectElements = [];

/* ====== УПРАВЛЕНИЕ ЭКРАНАМИ ====== */
function showScreen(screenElement) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    screenElement.classList.add('active');
}

/* ====== КАМЕРА - ПОЛНЫЙ РАБОЧИЙ КОД ====== */
async function initializeCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }

    try {
        const constraints = {
            video: {
                facingMode: "environment",
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        };

        cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        camera.srcObject = cameraStream;

        // Ждём загрузки видео
        await new Promise((resolve) => {
            camera.onloadedmetadata = () => {
                camera.play();
                resolve();
            };
        });

        console.log("✅ Камера успешно запущена");
        return true;
    } catch (cameraError) {
        console.error("❌ Ошибка камеры:", cameraError);

        // Показываем сообщение об ошибке
        let errorMessage = "Не удалось получить доступ к камере. ";
        if (cameraError.name === 'NotAllowedError') {
            errorMessage += "Разрешите доступ к камере в настройках браузера.";
        } else if (cameraError.name === 'NotFoundError') {
            errorMessage += "Камера не найдена на устройстве.";
        } else if (cameraError.name === 'NotReadableError') {
            errorMessage += "Камера используется другим приложением.";
        } else {
            errorMessage += "Неизвестная ошибка.";
        }

        alert(errorMessage);
        return false;
    }
}

/* ====== ГИРОСКОП - ПОЛНЫЙ РАБОЧИЙ КОД ====== */
function initializeGyroscope() {
    if (!window.DeviceOrientationEvent) {
        console.warn("⚠️ Гироскоп не поддерживается браузером");
        showMessage("Поворот телефона не поддерживается. Используйте пальцы для поиска.", "error");
        return false;
    }

    // Запрашиваем разрешение на доступ к гироскопу (нужно для iOS)
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    setupGyroscopeListeners();
                } else {
                    console.warn("❌ Разрешение на гироскоп не получено");
                    showMessage("Разрешите доступ к гироскопу для поиска объектов", "error");
                }
            })
            .catch(error => {
                console.error("Ошибка запроса гироскопа:", error);
            });
    } else {
        // Для Android и других браузеров
        setupGyroscopeListeners();
    }

    return true;
}

function setupGyroscopeListeners() {
    window.addEventListener('deviceorientation', handleDeviceOrientation, true);
    console.log("✅ Гироскоп активирован");
}

function handleDeviceOrientation(event) {
    deviceOrientation = {
        alpha: event.alpha || 0,    // 0-360 градусов, вращение вокруг оси Z
        beta: event.beta || 90,     // -180 до 180, наклон вперед/назад
        gamma: event.gamma || 0     // -90 до 90, наклон влево/вправо
    };

    updateVirtualObjects();
}

/* ====== ВИРТУАЛЬНЫЕ ОБЪЕКТЫ ====== */
function createVirtualObjects(contents, correctIndex) {
    clearVirtualObjects();

    // Создаём 3 виртуальных объекта в разных местах
    const objectPositions = [
        { worldX: -3.0, worldY: 0.5, worldZ: 5.0 },   // Слева
        { worldX: 0.0, worldY: 1.5, worldZ: 4.0 },    // По центру, выше
        { worldX: 3.0, worldY: -0.5, worldZ: 6.0 }    // Справа, ниже
    ];

    contents.forEach((content, index) => {
        const virtualObject = {
            id: `obj_${Date.now()}_${index}`,
            content: content,
            isCorrect: index === correctIndex,
            position: objectPositions[index],
            isVisible: false,
            element: null,
            screenX: 0,
            screenY: 0
        };

        virtualObjects.push(virtualObject);
        createObjectElement(virtualObject);
    });

    // Первое обновление позиций
    updateVirtualObjects();
}

function createObjectElement(virtualObject) {
    const element = document.createElement('div');
    element.id = virtualObject.id;
    element.className = 'ar-object';
    element.textContent = virtualObject.content;
    element.dataset.correct = virtualObject.isCorrect;

    // Начальное состояние - скрыт
    element.style.opacity = '0';
    element.style.transform = 'scale(0) rotate(180deg)';
    element.style.pointerEvents = 'none';

    // Анимация при наведении
    element.addEventListener('mouseenter', () => {
        if (element.classList.contains('visible')) {
            element.classList.add('highlighted');
        }
    });

    element.addEventListener('mouseleave', () => {
        element.classList.remove('highlighted');
    });

    // Обработка клика
    element.addEventListener('click', (event) => {
        event.stopPropagation();
        handleObjectClick(element, virtualObject.isCorrect);
    });

    // Для мобильных устройств
    element.addEventListener('touchstart', (event) => {
        event.preventDefault();
        if (element.classList.contains('visible')) {
            element.classList.add('highlighted');
        }
    });

    element.addEventListener('touchend', (event) => {
        event.preventDefault();
        if (element.classList.contains('visible')) {
            handleObjectClick(element, virtualObject.isCorrect);
        }
    });

    gameScreen.appendChild(element);
    virtualObject.element = element;
    objectElements.push({ element, virtualObject });
}

function updateVirtualObjects() {
    virtualObjects.forEach((obj) => {
        if (!obj.element) return;

        // Преобразуем мировые координаты в экранные с учётом поворота телефона
        const screenCoords = worldToScreen(
            obj.position.worldX,
            obj.position.worldY,
            obj.position.worldZ,
            deviceOrientation.gamma,
            deviceOrientation.beta
        );

        obj.screenX = screenCoords.x;
        obj.screenY = screenCoords.y;

        const isObjectVisible = screenCoords.isVisible;

        if (isObjectVisible && !obj.isVisible) {
            // Объект появляется в поле зрения
            showObject(obj);
        } else if (!isObjectVisible && obj.isVisible) {
            // Объект уходит из поля зрения
            hideObject(obj);
        } else if (isObjectVisible && obj.isVisible) {
            // Обновляем позицию видимого объекта
            updateObjectPosition(obj);
        }
    });
}

function worldToScreen(worldX, worldY, worldZ, gamma, beta) {
    // Упрощённое преобразование 3D координат в 2D экранные
    const gammaRad = (gamma * Math.PI) / 180;
    const betaRad = ((beta - 90) * Math.PI) / 180;

    // Учитываем поворот устройства
    const rotatedX = worldX * Math.cos(gammaRad) - worldZ * Math.sin(gammaRad);
    const rotatedZ = worldX * Math.sin(gammaRad) + worldZ * Math.cos(gammaRad);
    const rotatedY = worldY + Math.sin(betaRad) * 3;

    // Проекция на экран
    const fov = 60; // Поле зрения
    const aspectRatio = window.innerWidth / window.innerHeight;

    const screenX = 50 + (rotatedX / rotatedZ) * (fov / aspectRatio) * 100;
    const screenY = 50 + (rotatedY / rotatedZ) * fov * 100;

    // Проверяем, находится ли объект в поле зрения
    const isVisible =
        rotatedZ > 0.5 && // Объект не слишком близко
        screenX >= 10 && screenX <= 90 &&
        screenY >= 15 && screenY <= 85;

    return {
        x: Math.max(10, Math.min(90, screenX)),
        y: Math.max(15, Math.min(85, screenY)),
        isVisible: isVisible
    };
}

function showObject(virtualObject) {
    virtualObject.isVisible = true;
    const element = virtualObject.element;

    element.style.transition = 'opacity 0.6s ease, transform 0.6s ease, left 0.3s ease, top 0.3s ease';
    element.style.opacity = '1';
    element.style.transform = 'scale(1) rotate(0deg)';
    element.style.pointerEvents = 'auto';
    element.classList.add('visible');

    updateObjectPosition(virtualObject);

    // Задержка перед выделением
    setTimeout(() => {
        if (virtualObject.isVisible) {
            element.classList.add('highlighted');
        }
    }, 300);
}

function hideObject(virtualObject) {
    virtualObject.isVisible = false;
    const element = virtualObject.element;

    element.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    element.style.opacity = '0';
    element.style.transform = 'scale(0) rotate(180deg)';
    element.style.pointerEvents = 'none';
    element.classList.remove('visible', 'highlighted');
}

function updateObjectPosition(virtualObject) {
    const element = virtualObject.element;
    element.style.left = `${virtualObject.screenX}%`;
    element.style.top = `${virtualObject.screenY}%`;
}

function handleObjectClick(element, isCorrect) {
    if (!element.classList.contains('visible')) return;

    const rect = element.getBoundingClientRect();

    if (isCorrect) {
        // ПРАВИЛЬНЫЙ ВЫБОР
        playSuccessAnimation(element);
        showMessage('Отлично! Правильно!', 'success');

        const targetIndex = gameMode === 'words' ? currentLetterIndex : collectedItems.length;
        const targetElement = taskTargets.children[targetIndex];

        if (targetElement) {
            animateObjectToTarget(element, targetElement);
        }

        setTimeout(() => {
            if (element.parentNode) {
                element.remove();
            }
            if (gameMode === 'words') {
                processCorrectLetter();
            } else {
                processCorrectItem();
            }
        }, 1000);

    } else {
        // НЕПРАВИЛЬНЫЙ ВЫБОР
        playErrorAnimation(element);
        showMessage('Не та буква/предмет!', 'error');

        element.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        element.style.opacity = '0';
        element.style.transform = 'scale(0) rotate(360deg)';

        setTimeout(() => {
            if (element.parentNode) {
                element.remove();
            }
        }, 500);
    }
}

function playSuccessAnimation(element) {
    element.style.transition = 'all 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
    element.style.transform += ' scale(1.5)';
    element.style.filter = 'brightness(1.5) drop-shadow(0 0 20px gold)';
}

function playErrorAnimation(element) {
    element.style.transition = 'all 0.5s ease';
    element.style.transform += ' rotate(180deg)';
    element.style.filter = 'brightness(0.5)';
}

function animateObjectToTarget(sourceElement, targetElement) {
    const sourceRect = sourceElement.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();

    const deltaX = targetRect.left + targetRect.width / 2 - sourceRect.left;
    const deltaY = targetRect.top + targetRect.height / 2 - sourceRect.top;

    sourceElement.style.zIndex = '1000';
    sourceElement.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(0.2)`;
    sourceElement.style.opacity = '0.5';
}

/* ====== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====== */
function showMessage(text, type = 'info') {
    message.textContent = text;
    message.className = type;
    message.classList.add('show');

    setTimeout(() => {
        message.classList.remove('show');
    }, 2000);
}

function clearVirtualObjects() {
    virtualObjects.forEach(obj => {
        if (obj.element && obj.element.parentNode) {
            obj.element.remove();
        }
    });
    virtualObjects = [];
    objectElements = [];
}

/* ====== РЕЖИМ "СЛОВА" ====== */
function startWordsGame() {
    gameMode = 'words';
    currentWord = WORDS[Math.floor(Math.random() * WORDS.length)];
    currentLetterIndex = 0;

    // МАЛЕНЬКАЯ ПАНЕЛЬ ЗАДАНИЯ
    taskText.textContent = `Собери слово:`;
    taskText.style.fontSize = '18px';
    taskText.style.marginBottom = '5px';
    taskText.style.padding = '0';

    taskTargets.innerHTML = '';
    for (let i = 0; i < currentWord.length; i++) {
        const letterSpan = document.createElement('span');
        letterSpan.className = 'target-item';
        letterSpan.textContent = currentWord[i];
        letterSpan.title = `Буква ${currentWord[i]}`;
        letterSpan.style.fontSize = '24px';
        letterSpan.style.width = '35px';
        letterSpan.style.height = '35px';
        taskTargets.appendChild(letterSpan);
    }

    showMessage(`Ищи букву "${currentWord[0]}"! Поворачивай телефон`, 'info');
    generateLetterObjects();
}

function generateLetterObjects() {
    const neededLetter = currentWord[currentLetterIndex];

    // Создаём массив из 3 разных букв
    const lettersArray = [neededLetter];
    while (lettersArray.length < 3) {
        const randomLetter = ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
        if (!lettersArray.includes(randomLetter)) {
            lettersArray.push(randomLetter);
        }
    }

    // Перемешиваем буквы
    lettersArray.sort(() => Math.random() - 0.5);

    // Находим индекс правильной буквы
    const correctIndex = lettersArray.findIndex(letter => letter === neededLetter);

    // Создаём виртуальные объекты
    createVirtualObjects(lettersArray, correctIndex);
}

function processCorrectLetter() {
    const targetElements = taskTargets.querySelectorAll('.target-item');
    if (targetElements[currentLetterIndex]) {
        targetElements[currentLetterIndex].classList.add('found');
    }

    currentLetterIndex++;

    if (currentLetterIndex >= currentWord.length) {
        // Слово собрано!
        showMessage('Ура! Слово собрано!', 'success');
        setTimeout(() => {
            showScreen(winScreen);
        }, 1500);
    } else {
        // Переходим к следующей букве
        setTimeout(() => {
            generateLetterObjects();
            showMessage(`Теперь ищи букву "${currentWord[currentLetterIndex]}"`, 'info');
        }, 800);
    }
}

/* ====== РЕЖИМ "ПРЕДМЕТЫ" ====== */
function startItemsGame() {
    gameMode = 'items';
    currentCategory = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    collectedItems = [];

    // МАЛЕНЬКАЯ ПАНЕЛЬ ЗАДАНИЯ
    taskText.textContent = currentCategory.question;
    taskText.style.fontSize = '18px';
    taskText.style.marginBottom = '5px';
    taskText.style.padding = '0';

    taskTargets.innerHTML = '';
    currentCategory.items.forEach(item => {
        const itemSpan = document.createElement('span');
        itemSpan.className = 'target-item';
        itemSpan.textContent = item.emoji;
        itemSpan.title = item.name;
        itemSpan.style.fontSize = '24px';
        itemSpan.style.width = '35px';
        itemSpan.style.height = '35px';
        taskTargets.appendChild(itemSpan);
    });

    showMessage(`Ищи ${currentCategory.items[0].name.toLowerCase()}! Поворачивай телефон`, 'info');
    generateItemObjects();
}

function generateItemObjects() {
    const neededItems = currentCategory.items.filter(item =>
        !collectedItems.some(collected => collected.name === item.name)
    );

    if (neededItems.length === 0) return;

    const targetItem = neededItems[0];
    const itemsArray = [targetItem];

    // Собираем случайные предметы из других категорий
    const allItems = [];
    CATEGORIES.forEach(category => {
        category.items.forEach(item => {
            if (!itemsArray.some(i => i.name === item.name)) {
                allItems.push(item);
            }
        });
    });

    // Добавляем случайные предметы пока не наберём 3
    while (itemsArray.length < 3 && allItems.length > 0) {
        const randomIndex = Math.floor(Math.random() * allItems.length);
        const randomItem = allItems[randomIndex];

        if (!itemsArray.some(item => item.name === randomItem.name)) {
            itemsArray.push(randomItem);
            allItems.splice(randomIndex, 1);
        }
    }

    // Перемешиваем
    itemsArray.sort(() => Math.random() - 0.5);

    // Находим индекс правильного предмета
    const correctIndex = itemsArray.findIndex(item => item.name === targetItem.name);
    const emojiArray = itemsArray.map(item => item.emoji);

    // Создаём виртуальные объекты
    createVirtualObjects(emojiArray, correctIndex);
}

function processCorrectItem() {
    const neededItems = currentCategory.items.filter(item =>
        !collectedItems.some(collected => collected.name === item.name)
    );

    if (neededItems.length === 0) return;

    const foundItem = neededItems[0];
    collectedItems.push(foundItem);

    const targetElements = taskTargets.querySelectorAll('.target-item');
    const itemIndex = currentCategory.items.findIndex(item => item.name === foundItem.name);

    if (targetElements[itemIndex]) {
        targetElements[itemIndex].classList.add('found');
    }

    if (collectedItems.length === currentCategory.items.length) {
        // Все предметы собраны!
        showMessage('Все предметы найдены! Молодец!', 'success');
        setTimeout(() => {
            showScreen(winScreen);
        }, 1500);
    } else {
        // Ищем следующий предмет
        setTimeout(() => {
            generateItemObjects();
            const nextItem = currentCategory.items.find(item =>
                !collectedItems.some(collected => collected.name === item.name)
            );
            if (nextItem) {
                showMessage(`Теперь ищи ${nextItem.name.toLowerCase()}`, 'info');
            }
        }, 800);
    }
}

/* ====== ОБРАБОТЧИКИ СОБЫТИЙ ====== */
wordsBtn.addEventListener('click', async () => {
    showScreen(gameScreen);

    // Запускаем камеру
    const cameraStarted = await initializeCamera();
    if (!cameraStarted) return;

    // Запускаем гироскоп
    initializeGyroscope();

    // Запускаем игру
    setTimeout(() => {
        startWordsGame();
    }, 500);
});

itemsBtn.addEventListener('click', async () => {
    showScreen(gameScreen);

    const cameraStarted = await initializeCamera();
    if (!cameraStarted) return;

    initializeGyroscope();

    setTimeout(() => {
        startItemsGame();
    }, 500);
});

homeBtn.addEventListener('click', () => {
    showScreen(menuScreen);
    clearVirtualObjects();

    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
});

playAgainBtn.addEventListener('click', () => {
    showScreen(gameScreen);
    if (gameMode === 'words') {
        startWordsGame();
    } else if (gameMode === 'items') {
        startItemsGame();
    }
});

backMenuBtn.addEventListener('click', () => {
    showScreen(menuScreen);
    clearVirtualObjects();

    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
});

/* ====== ИНИЦИАЛИЗАЦИЯ ====== */
console.log('🚀 AR игра "Слова и предметы" загружена и готова к работе!');

// Добавляем обработчик для тестирования на десктопе
if (!window.DeviceOrientationEvent) {
    console.log('Десктоп: эмулируем поворот телефона клавишами');

    let simulatedGamma = 0;
    let simulatedBeta = 90;

    document.addEventListener('keydown', (event) => {
        switch(event.key) {
            case 'ArrowLeft':
                simulatedGamma = Math.max(-90, simulatedGamma - 5);
                deviceOrientation.gamma = simulatedGamma;
                updateVirtualObjects();
                break;
            case 'ArrowRight':
                simulatedGamma = Math.min(90, simulatedGamma + 5);
                deviceOrientation.gamma = simulatedGamma;
                updateVirtualObjects();
                break;
            case 'ArrowUp':
                simulatedBeta = Math.max(0, simulatedBeta - 5);
                deviceOrientation.beta = simulatedBeta;
                updateVirtualObjects();
                break;
            case 'ArrowDown':
                simulatedBeta = Math.min(180, simulatedBeta + 5);
                deviceOrientation.beta = simulatedBeta;
                updateVirtualObjects();
                break;
        }
    });
}