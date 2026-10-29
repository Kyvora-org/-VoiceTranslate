/**
 * ui.js
 * Módulo de interfaz de usuario.
 * Controla el tema (modo claro/oscuro), animaciones de estados, modales, toasts y red.
 */

class UIManager {
  constructor() {
    this.html = document.documentElement;
    this.toastContainer = document.getElementById('toast-container');
    this._initTheme();
    this._initNetworkListener();
  }

  /**
   * Inicializa el tema visual. El modo azul marino Kyvora Studio es el predeterminado.
   * @private
   */
  _initTheme() {
    const savedTheme = localStorage.getItem('vt_theme');
    // Si el usuario eligió explícitamente modo claro, se respeta; de lo contrario, tema azul Kyvora
    if (savedTheme === 'light') {
      this.setTheme('light');
    } else {
      this.setTheme('dark');
    }
  }

  /**
   * Aplica el tema claro u oscuro.
   */
  setTheme(theme) {
    this.html.setAttribute('data-theme', theme);
    localStorage.setItem('vt_theme', theme);
  }

  /**
   * Alterna entre modo claro y oscuro.
   */
  toggleTheme() {
    const current = this.html.getAttribute('data-theme') || 'dark';
    const nextTheme = current === 'dark' ? 'light' : 'dark';
    this.setTheme(nextTheme);
    return nextTheme;
  }

  /**
   * Escucha eventos de conexión a internet en tiempo real.
   * @private
   */
  _initNetworkListener() {
    const netEl = document.getElementById('network-status');
    const updateStatus = () => {
      const isOnline = navigator.onLine;
      if (netEl) {
        if (isOnline) {
          netEl.className = 'status-indicator online';
          netEl.querySelector('.network-label').textContent = 'En línea';
          netEl.title = 'Conexión a internet activa';
        } else {
          netEl.className = 'status-indicator offline';
          netEl.querySelector('.network-label').textContent = 'Sin conexión';
          netEl.title = 'Sin conexión a internet';
          this.showToast('Sin conexión a internet. La traducción remota se pausará.', 'warning', 5000);
        }
      }
    };

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    updateStatus();
  }

  /**
   * Muestra un toast emergente con icono y mensaje.
   * @param {string} message - Mensaje a mostrar.
   * @param {'info'|'success'|'warning'|'error'} type - Tipo de notificación.
   * @param {number} duration - Duración en milisegundos.
   */
  showToast(message, type = 'info', duration = 3200) {
    if (!this.toastContainer) return;

    const icons = {
      info: 'ℹ️',
      success: '✓',
      warning: '⚠️',
      error: '✕'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon" aria-hidden="true">${icons[type] || '•'}</span>
      <span class="toast-message">${message}</span>
    `;

    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  /**
   * Actualiza el estado visual del botón del micrófono y sus animaciones.
   * @param {'idle'|'recording'|'processing'} state
   */
  setMicState(state) {
    const btnMic = document.getElementById('btn-mic');
    const statusText = document.getElementById('mic-status-text');
    const soundWave = document.getElementById('sound-wave');

    if (!btnMic || !statusText) return;

    if (state === 'recording') {
      btnMic.classList.add('is-recording');
      btnMic.title = 'Detener escucha';
      statusText.textContent = 'Escuchando... habla ahora';
      statusText.className = 'mic-status-text recording';
      if (soundWave) soundWave.hidden = false;
    } else if (state === 'processing') {
      btnMic.classList.remove('is-recording');
      btnMic.title = 'Procesando traducción';
      statusText.textContent = 'Procesando traducción...';
      statusText.className = 'mic-status-text';
      if (soundWave) soundWave.hidden = true;
    } else {
      // idle
      btnMic.classList.remove('is-recording');
      btnMic.title = 'Iniciar escucha';
      statusText.textContent = 'Presiona el micrófono para comenzar';
      statusText.className = 'mic-status-text';
      if (soundWave) soundWave.hidden = true;
    }
  }

  /**
   * Muestra/oculta el spinner de carga de traducción.
   */
  setTranslationLoading(isLoading) {
    const loader = document.getElementById('translation-loader');
    if (loader) {
      loader.hidden = !isLoading;
    }
  }

  /**
   * Copia texto al portapapeles y ofrece feedback visual interactivo en un botón.
   */
  async copyTextWithFeedback(text, buttonElement, defaultText = 'Copiar') {
    if (!text || !text.trim()) {
      this.showToast('No hay texto para copiar.', 'warning');
      return;
    }

    try {
      await navigator.clipboard.writeText(text.trim());
      this.showToast('Copiado al portapapeles', 'success');

      if (buttonElement) {
        const span = buttonElement.querySelector('span');
        if (span) {
          const original = span.textContent;
          span.textContent = '¡Copiado!';
          setTimeout(() => {
            span.textContent = original;
          }, 1800);
        }
      }
    } catch (err) {
      // Fallback para navegadores antiguos
      const textarea = document.createElement('textarea');
      textarea.value = text.trim();
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.showToast('Copiado al portapapeles', 'success');
    }
  }

  /**
   * Actualiza el badge indicador del proveedor en la barra superior.
   */
  updateProviderBadge(providerName, isFallback = false) {
    const badge = document.getElementById('provider-badge');
    const text = document.getElementById('provider-badge-text');
    if (!badge || !text) return;

    text.textContent = providerName;
    if (isFallback) {
      badge.classList.add('fallback');
      badge.title = 'Usando modo demo MyMemory. Haz clic para configurar tu API Key de Gemini.';
    } else {
      badge.classList.remove('fallback');
      badge.title = 'Traducción impulsada por Gemini Flash. Haz clic para opciones.';
    }
  }
}

export const uiManager = new UIManager();
