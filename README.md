# 🔐 Crypto Tools

> Набор криптографических инструментов: стеганография, спектрограмма, азбука Морзе и QR-коды

[![GitHub Pages](https://img.shields.io/badge/demo-live-brightgreen)](https://ArabKustam.github.io/cryptography/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## ✨ Возможности

### 🖼️ Стеганография
- Скрытие текста в изображениях (метод LSB)
- Извлечение скрытых сообщений из изображений
- Поддержка любых форматов изображений

### 🎵 Спектрограмма
- Конвертация изображений в WAV аудио
- Извлечение изображений из аудио (спектральный анализ)
- Настраиваемые частотные диапазоны и цветовые схемы

### 📡 Азбука Морзе
- Текст → Морзе (с визуализацией и аудио)
- Морзе → Текст
- Распознавание морзянки из аудио файлов
- Справочник символов

### 📱 QR-код генератор
- Генерация QR-кодов с кастомизацией
- Различные стили точек и углов
- Градиенты и цвета
- Добавление логотипа в центр
- Сканирование QR-кодов из изображений

## 🚀 Быстрый старт

### Локально

1. Клонируйте репозиторий:
```bash
git clone https://github.com/ArabKustam/cryptography.git
cd cryptography
```

2. Откройте `index.html` в браузере

Или используйте локальный сервер:
```bash
npx serve .
```

### GitHub Pages

Сайт автоматически деплоится на GitHub Pages при пуше в `main` ветку.

## 🛠️ Технологии

- **HTML5** — семантическая разметка
- **CSS3** — Glassmorphism, анимации, адаптивный дизайн
- **JavaScript** — ванильный JS, ES6+ модули
- **[QR Code Styling](https://github.com/nickvision/qr-code-styling)** — генерация QR-кодов
- **[jsQR](https://github.com/cozmo/jsQR)** — сканирование QR-кодов

## 📁 Структура проекта

```
crypto-tools/
├── index.html          # Главная страница
├── styles.css          # Стили
├── app.js              # Логика приложения
├── README.md           # Документация
├── LICENSE             # MIT лицензия
└── .github/
    └── workflows/
        └── deploy.yml  # GitHub Actions для деплоя
```

## 🎨 Особенности дизайна

- Тёмная тема с градиентами
- Glassmorphism эффекты
- SVG иконки
- Плавные анимации
- Адаптивный дизайн для мобильных устройств

## 📄 Лицензия

MIT License — свободное использование, модификация и распространение.

## 🤝 Contributing

1. Fork репозитория
2. Создайте ветку (`git checkout -b feature/amazing`)
3. Commit изменения (`git commit -m 'Add amazing feature'`)
4. Push в ветку (`git push origin feature/amazing`)
5. Откройте Pull Request

---

<p align="center">
  Made with ❤️ using vanilla JavaScript
</p>
