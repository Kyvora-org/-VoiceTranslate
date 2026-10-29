/**
 * configLoader.js
 * Carga de forma segura la configuración de la aplicación.
 * Si `js/config.js` no existe, utiliza automáticamente los valores
 * por defecto definidos en `js/config.example.js` (MyMemory sin API key).
 */

import { CONFIG as DEFAULT_CONFIG } from './config.example.js';

let resolvedConfig = { ...DEFAULT_CONFIG };

try {
  // Intento de importación dinámica de config.js
  const customConfigModule = await import('./config.js');
  if (customConfigModule && customConfigModule.CONFIG) {
    resolvedConfig = {
      ...DEFAULT_CONFIG,
      ...customConfigModule.CONFIG
    };
  }
} catch (error) {
  // config.js no existe o no pudo cargarse; se usa la configuración por defecto
  console.info('VoiceTranslate: Archivo js/config.js no encontrado. Usando configuración por defecto de config.example.js (modo MyMemory).');
}

export const CONFIG = resolvedConfig;
