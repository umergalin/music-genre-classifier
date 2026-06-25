export const PATHS = {
    worker: './js/audio-analyzer-worker.js',
    model: '../model/model.json'
}

export const GENRES = ["blues", "classical", "country", "disco", "hiphop", "jazz", "metal", "pop", "reggae", "rock"];

export const GENRES_TRANSLATION = {
  "blues": "блюз",
  "classical": "классическая",
  "country": "кантри",
  "disco": "диско",
  "hiphop": "хип-хоп",
  "jazz": "джаз",
  "metal": "метал",
  "pop": "поп",
  "reggae": "регги",
  "rock": "рок"
}

export const GENRES_EMOJIS = {
  "blues": "🎺",
  "classical": "🎹",
  "country": "🤠",
  "disco": "💿",
  "hiphop": "🎛️",
  "jazz": "🎷",
  "metal": "💀",
  "pop": "🎤",
  "reggae": "☮️",
  "rock": "🎸"
}

export const UI_DEFAULTS = {
  AUTHOR: 'Неизвестен',
  NAME: 'Неизвестно',
  STATUS: 'Обработка...'
};