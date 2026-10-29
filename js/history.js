/**
 * history.js
 * Módulo para gestionar el historial de traducción de la sesión.
 * Incluye almacenamiento local en localStorage, renderizado reactivo y acciones.
 */

const STORAGE_KEY = 'vt_history_session';

class HistoryManager {
  constructor() {
    this.items = this._loadFromStorage();
  }

  /**
   * Carga los elementos guardados desde localStorage.
   * @private
   */
  _loadFromStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('Error al cargar historial desde almacenamiento local:', e);
      return [];
    }
  }

  /**
   * Guarda los elementos actuales en localStorage.
   * @private
   */
  _saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    } catch (e) {
      console.warn('Error al persistir historial:', e);
    }
  }

  /**
   * Agrega una nueva traducción al historial.
   * Evita duplicados inmediatos consecutivos.
   */
  addItem({ sourceLang, targetLang, targetSpeechCode, originalText, translatedText }) {
    if (!originalText || !translatedText) return null;

    const trimmedOriginal = originalText.trim();
    const trimmedTranslated = translatedText.trim();

    // Evitar agregar la misma frase si es idéntica a la última registrada
    if (this.items.length > 0) {
      const last = this.items[0];
      if (last.originalText === trimmedOriginal && last.translatedText === trimmedTranslated) {
        return null;
      }
    }

    const newItem = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      sourceLang: sourceLang.toUpperCase(),
      targetLang: targetLang.toUpperCase(),
      targetSpeechCode,
      originalText: trimmedOriginal,
      translatedText: trimmedTranslated,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Agregar al inicio para mostrar los más recientes arriba
    this.items.unshift(newItem);

    // Limitar a los últimos 50 elementos para optimizar rendimiento
    if (this.items.length > 50) {
      this.items = this.items.slice(0, 50);
    }

    this._saveToStorage();
    return newItem;
  }

  /**
   * Elimina un elemento por su ID.
   */
  deleteItem(id) {
    this.items = this.items.filter(item => item.id !== id);
    this._saveToStorage();
  }

  /**
   * Borra todo el historial de la sesión.
   */
  clearAll() {
    this.items = [];
    this._saveToStorage();
  }

  /**
   * Retorna todos los elementos del historial.
   */
  getItems() {
    return this.items;
  }

  /**
   * Devuelve todo el historial formateado en texto para copiar al portapapeles.
   */
  getFormattedHistoryText() {
    if (this.items.length === 0) return '';

    return this.items
      .map(item => `[${item.timestamp}] (${item.sourceLang} → ${item.targetLang})\n• Original: ${item.originalText}\n• Traducción: ${item.translatedText}`)
      .join('\n\n');
  }

  /**
   * Renderiza la lista de historial en el contenedor DOM provisto.
   */
  render(containerEl, countEl, btnClearEl, btnCopyAllEl, callbacks = {}) {
    if (!containerEl) return;

    const { onSpeak, onCopy, onDelete } = callbacks;
    const hasItems = this.items.length > 0;

    if (countEl) countEl.textContent = this.items.length;
    if (btnClearEl) btnClearEl.disabled = !hasItems;
    if (btnCopyAllEl) btnCopyAllEl.disabled = !hasItems;

    if (!hasItems) {
      containerEl.innerHTML = `
        <div class="history-empty">
          <p>Aún no hay frases traducidas en esta sesión.</p>
          <span class="history-hint">Habla en el micrófono para comenzar a registrar traducciones.</span>
        </div>
      `;
      return;
    }

    containerEl.innerHTML = '';

    this.items.forEach(item => {
      const card = document.createElement('article');
      card.className = 'history-item';
      card.dataset.id = item.id;

      card.innerHTML = `
        <div class="history-item-top">
          <span class="history-langs">${item.sourceLang} → ${item.targetLang}</span>
          <span class="history-time">${item.timestamp}</span>
        </div>
        <div class="history-item-content">
          <p class="history-original">${this._escapeHtml(item.originalText)}</p>
          <p class="history-translated">${this._escapeHtml(item.translatedText)}</p>
        </div>
        <div class="history-item-bottom">
          <button class="btn-history-action btn-history-speak" title="Escuchar traducción" aria-label="Escuchar frase">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            </svg>
            <span>Escuchar</span>
          </button>
          <button class="btn-history-action btn-history-copy" title="Copiar traducción" aria-label="Copiar traducción">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
            </svg>
            <span>Copiar</span>
          </button>
          <button class="btn-history-action danger btn-history-delete" title="Eliminar de historial" aria-label="Eliminar elemento">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            <span>Borrar</span>
          </button>
        </div>
      `;

      // Event Listeners individuales
      const btnSpeak = card.querySelector('.btn-history-speak');
      const btnCopy = card.querySelector('.btn-history-copy');
      const btnDelete = card.querySelector('.btn-history-delete');

      btnSpeak.addEventListener('click', () => {
        if (typeof onSpeak === 'function') onSpeak(item.translatedText, item.targetSpeechCode);
      });

      btnCopy.addEventListener('click', () => {
        if (typeof onCopy === 'function') onCopy(item.translatedText, btnCopy);
      });

      btnDelete.addEventListener('click', () => {
        if (typeof onDelete === 'function') onDelete(item.id);
      });

      containerEl.appendChild(card);
    });
  }

  /**
   * Sanitiza cadenas simples para renderizado seguro en DOM.
   * @private
   */
  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

export const historyManager = new HistoryManager();
