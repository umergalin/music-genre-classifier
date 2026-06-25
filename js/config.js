export const PATHS = {
    worker: './js/audio-analyzer-worker.js',
    model: '../model/model.json'
}

export const GENRES = [
  { id: "blues", label: "блюз", emoji: "🎺" },
  { id: "classical", label: "классическая", emoji: "🎹" },
  { id: "country", label: "кантри", emoji: "🤠" },
  { id: "disco", label: "диско", emoji: "💿" },
  { id: "hiphop", label: "хип-хоп", emoji: "🎛️" },
  { id: "jazz", label: "джаз", emoji: "🎷" },
  { id: "metal", label: "метал", emoji: "💀" },
  { id: "pop", label: "поп", emoji: "🎤" },
  { id: "reggae", label: "регги", emoji: "☮️" },
  { id: "rock", label: "рок", emoji: "🎸" },
];

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