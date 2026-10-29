/**
 * Archivo de configuración de ejemplo para VoiceTranslate.
 * Copia este archivo como `config.js` y agrega tu API Key de Gemini.
 * Puedes obtener tu API Key gratuita en: https://aistudio.google.com/app/apikey
 */
export const CONFIG = {
  // Proveedor por defecto cuando no hay API Key configurada ('mymemory')
  provider: 'mymemory',

  // Tu API Key de Google AI Studio (Gemini Flash)
  geminiApiKey: '',

  // Modelo recomendado para traducción rápida y eficiente
  // Opciones: 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'
  geminiModel: 'gemini-2.5-flash',

  // Tiempo de espera tras pausar el habla antes de traducir (milisegundos)
  translationDebounceMs: 600
};
