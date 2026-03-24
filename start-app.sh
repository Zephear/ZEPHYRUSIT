#!/bin/bash
echo "🚀 Запуск додатку ZephyrusIT..."
docker-compose up -d --build
echo "✅ Додаток успішно запущено!"
echo "Фронтенд: http://localhost:8080"
echo "Бекенд API: http://localhost:3000"
