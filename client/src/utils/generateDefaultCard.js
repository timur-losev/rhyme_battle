/**
 * Этот скрипт добавляет базовое изображение карты (default.png) в DOM,
 * чтобы избежать повторных запросов к серверу
 */

// Base64 данные для минимального изображения карты (1x1 пиксель прозрачный PNG)
const DEFAULT_CARD_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

// Функция для добавления базового изображения в DOM
export function addDefaultCardImage() {
  // Проверяем, существует ли уже элемент
  if (document.getElementById('default-card-image')) {
    return;
  }
  
  // Создаем элемент img
  const img = document.createElement('img');
  img.id = 'default-card-image';
  img.src = DEFAULT_CARD_BASE64;
  img.alt = 'Default Card';
  img.style.display = 'none'; // Скрываем изображение
  
  // Добавляем атрибуты для предзагрузки
  img.setAttribute('data-src', '/images/cards/default.png');
  
  // Добавляем в DOM
  document.body.appendChild(img);
  
  console.log('Базовое изображение карты добавлено в DOM');
}

export default addDefaultCardImage; 