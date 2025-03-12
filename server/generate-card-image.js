const fs = require('fs');
const { createCanvas } = require('canvas');
const path = require('path');

// Создаем директорию, если она не существует
const imagesDir = path.join(__dirname, '../public/images/cards');
if (!fs.existsSync(imagesDir)) {
  console.log('Создаем директорию для карт:', imagesDir);
  fs.mkdirSync(imagesDir, { recursive: true });
}

// Создаем канвас для рисования
const canvas = createCanvas(240, 340);
const ctx = canvas.getContext('2d');

// Функция для рисования карты по умолчанию
function drawDefaultCard() {
  // Очищаем холст
  ctx.clearRect(0, 0, 240, 340);
  
  // Фон
  ctx.fillStyle = '#222';
  ctx.fillRect(0, 0, 240, 340);
  
  // Градиент для фона
  const gradient = ctx.createLinearGradient(0, 0, 240, 340);
  gradient.addColorStop(0, '#333');
  gradient.addColorStop(1, '#111');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(10, 10, 220, 320);
  
  // Знак вопроса в центре
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.font = 'bold 120px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 120, 170);
  
  // Рамка
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, 220, 320);
  
  // Сохраняем в файл
  const buffer = canvas.toBuffer('image/png');
  const outputPath = path.join(imagesDir, 'default.png');
  fs.writeFileSync(outputPath, buffer);
  console.log('Карта по умолчанию сохранена в:', outputPath);
}

// Вызываем функцию для создания карты по умолчанию
try {
  drawDefaultCard();
  console.log('Карта успешно сгенерирована!');
} catch (error) {
  console.error('Ошибка при генерации карты:', error);
} 