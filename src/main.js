/* ==========================================
   Javascript Logic: Gemini Model Vault
   Author: Vela (Venus Link Command Center)
   ========================================== */

import './style.css';

// App state
let allModels = [];
let filteredModels = [];

// DOM elements
let apiKeyInput;
let toggleVisibleBtn;
let eyeIcon;
let fetchBtn;
let saveKeyCheckbox;

let apiTypeRadios;
let baseUrlInput;
let baseUrlWrapper;

let placeholderState;
let loadingState;
let errorState;
let errorMessage;
let resultsState;

let searchInput;
let methodFilter;
let copyFormat;
let bulkCopyBtn;
let modelCountBadge;
let modelsGrid;
let toastContainer;

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  // Bind DOM elements safely
  apiKeyInput = document.getElementById('api-key-input');
  toggleVisibleBtn = document.getElementById('toggle-visible-btn');
  eyeIcon = document.getElementById('eye-icon');
  fetchBtn = document.getElementById('fetch-btn');
  saveKeyCheckbox = document.getElementById('save-key-checkbox');

  apiTypeRadios = document.getElementsByName('api-type');
  baseUrlInput = document.getElementById('base-url-input');
  baseUrlWrapper = document.getElementById('base-url-wrapper');

  placeholderState = document.getElementById('placeholder-state');
  loadingState = document.getElementById('loading-state');
  errorState = document.getElementById('error-state');
  errorMessage = document.getElementById('error-message');
  resultsState = document.getElementById('results-state');

  searchInput = document.getElementById('search-input');
  methodFilter = document.getElementById('method-filter');
  copyFormat = document.getElementById('copy-format');
  bulkCopyBtn = document.getElementById('bulk-copy-btn');
  modelCountBadge = document.getElementById('model-count-badge');
  modelsGrid = document.getElementById('models-grid');
  toastContainer = document.getElementById('toast-container');

  // Load saved configurations
  const savedKey = localStorage.getItem('gemini_api_key');
  if (savedKey && apiKeyInput) {
    apiKeyInput.value = savedKey;
  }

  const savedType = localStorage.getItem('gemini_api_type');
  if (savedType && apiTypeRadios) {
    apiTypeRadios.forEach(radio => {
      if (radio.value === savedType) {
        radio.checked = true;
      }
    });
  }

  const savedBaseUrl = localStorage.getItem('openai_base_url');
  if (savedBaseUrl && baseUrlInput) {
    baseUrlInput.value = savedBaseUrl;
  }
  
  // Setup dynamic visibility for Base URL
  updateBaseUrlVisibility();
  if (apiTypeRadios) {
    apiTypeRadios.forEach(radio => {
      radio.addEventListener('change', updateBaseUrlVisibility);
    });
  }
  
  // Render initial icons
  if (window.lucide) {
    window.lucide.createIcons();
  }
  
  // Setup events
  setupEventListeners();
});

// Toggle base URL field visibility with height transition
function updateBaseUrlVisibility() {
  if (!apiTypeRadios || !baseUrlWrapper) return;
  const activeRadio = Array.from(apiTypeRadios).find(r => r.checked);
  if (activeRadio && activeRadio.value === 'openai') {
    baseUrlWrapper.classList.remove('hidden-height');
    baseUrlWrapper.classList.add('show-height');
  } else {
    baseUrlWrapper.classList.remove('show-height');
    baseUrlWrapper.classList.add('hidden-height');
  }
}

function setupEventListeners() {
  // Toggle password visibility
  toggleVisibleBtn.addEventListener('click', () => {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
    
    // Update icon
    eyeIcon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
    if (window.lucide) {
      window.lucide.createIcons();
    }
  });

  // Fetch models
  fetchBtn.addEventListener('click', fetchModels);

  // Instant filtering
  searchInput.addEventListener('input', renderModels);
  methodFilter.addEventListener('change', renderModels);

  // Bulk copy
  bulkCopyBtn.addEventListener('click', handleBulkCopy);
}

// Show active state
function switchState(stateName) {
  placeholderState.classList.add('hidden');
  loadingState.classList.add('hidden');
  errorState.classList.add('hidden');
  resultsState.classList.add('hidden');

  if (stateName === 'placeholder') placeholderState.classList.remove('hidden');
  else if (stateName === 'loading') loadingState.classList.remove('hidden');
  else if (stateName === 'error') errorState.classList.remove('hidden');
  else if (stateName === 'results') resultsState.classList.remove('hidden');
}

// Show Toast
function showToast(message, icon = 'check-circle') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  
  toast.innerHTML = `
    <i data-lucide="${icon}"></i>
    <span>${message}</span>
  `;
  
  toastContainer.appendChild(toast);
  
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Remove toast after animation finishes
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Fetch available models from API
async function fetchModels() {
  const apiKey = apiKeyInput.value.trim();
  const apiType = Array.from(apiTypeRadios).find(r => r.checked)?.value || 'gemini';
  
  if (!apiKey) {
    errorMessage.textContent = 'APIキーが入力されていません。入力フィールドを確認してくださいね。';
    switchState('error');
    return;
  }

  switchState('loading');
  showToast('APIサーバーにリクエストを送信しています...', 'refresh-cw');

  try {
    let response;
    let data;

    if (apiType === 'openai') {
      const rawBase = baseUrlInput.value.trim() || 'https://api.openai.com/v1';
      const cleanBase = rawBase.replace(/\/$/, '');
      const url = `${cleanBase}/models`;
      
      response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      if (!response.ok) {
        // Try parsing error
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error?.message || `HTTPエラーが発生しました (Status: ${response.status})`;
        throw new Error(message);
      }
      
      data = await response.json();
      
      if (!data.data || data.data.length === 0) {
        throw new Error('利用可能なモデルが見つかりませんでした。');
      }
      
      // Map OpenAI response format to internal common representation
      allModels = data.data.map(m => ({
        name: m.id,
        displayName: m.id,
        description: `Owned by: ${m.owned_by || 'unknown'}`,
        inputTokenLimit: null,
        outputTokenLimit: null,
        supportedGenerationMethods: ['OpenAI Model', m.owned_by || 'openai'],
        isOpenAI: true
      }));

      // Save configurations
      if (saveKeyCheckbox.checked) {
        localStorage.setItem('gemini_api_key', apiKey);
        localStorage.setItem('gemini_api_type', 'openai');
        localStorage.setItem('openai_base_url', rawBase);
      } else {
        clearSavedConfig();
      }

    } else {
      // Gemini API
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.error?.message || `HTTPエラーが発生しました (Status: ${response.status})`;
        throw new Error(message);
      }

      showToast('データを受信しました。解析中...', 'loader');
      data = await response.json();
      
      if (!data.models || data.models.length === 0) {
        throw new Error('利用可能なモデルが見つかりませんでした。');
      }

      allModels = data.models;

      // Save configurations
      if (saveKeyCheckbox.checked) {
        localStorage.setItem('gemini_api_key', apiKey);
        localStorage.setItem('gemini_api_type', 'gemini');
      } else {
        clearSavedConfig();
      }
    }

    // Success toast
    showToast('モデル情報を正常に取得しました！', 'shield');
    
    // Render
    renderModels();
    switchState('results');

  } catch (error) {
    console.error('Fetch error:', error);
    let userFriendlyMsg = error.message;
    
    if (error.message.includes('API key not valid')) {
      userFriendlyMsg = '入力されたAPIキーが無効です。正しいキーを入力してください。';
    } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.name === 'TypeError') {
      if (apiType === 'openai') {
        userFriendlyMsg = 'ネットワークエラーが発生しました。接続エラー、またはCORS(クロスオリジン制限)でリクエストがブロックされた可能性が高いわ。本家OpenAIやDeepSeekなどの一部の外部APIは、キーの安全性のためにブラウザからの直接アクセスを禁止しているの。ローカルAPI(OllamaやLM Studio等)や、CORSを許可しているエンドポイントで試してみてね♡';
      } else {
        userFriendlyMsg = 'ネットワークエラーが発生しました。接続を確認してくださいね。';
      }
    }
    
    errorMessage.textContent = userFriendlyMsg;
    switchState('error');
  }
}

// Clear configurations helper
function clearSavedConfig() {
  localStorage.removeItem('gemini_api_key');
  localStorage.removeItem('gemini_api_type');
  localStorage.removeItem('openai_base_url');
}

// Render filtered models
function renderModels() {
  const query = searchInput.value.toLowerCase().trim();
  const filterMethod = methodFilter.value;

  filteredModels = allModels.filter(model => {
    // Search query filter
    const matchesSearch = 
      model.name.toLowerCase().includes(query) ||
      (model.displayName && model.displayName.toLowerCase().includes(query)) ||
      (model.description && model.description.toLowerCase().includes(query));

    // Method filter
    const matchesMethod = 
      filterMethod === 'all' || 
      (model.supportedGenerationMethods && model.supportedGenerationMethods.includes(filterMethod)) ||
      (model.isOpenAI && filterMethod === 'generateContent'); // Map generateContent filter to OpenAI models

    return matchesSearch && matchesMethod;
  });

  // Update badge count
  modelCountBadge.textContent = `${filteredModels.length} モデルが見つかりました`;

  // Render cards
  if (filteredModels.length === 0) {
    modelsGrid.innerHTML = `
      <div class="state-container" style="grid-column: 1 / -1; width: 100%;">
        <i data-lucide="search-code" class="large-icon" style="margin-bottom: 12px;"></i>
        <h4>検索結果に一致するモデルがありませんでした</h4>
        <p>キーワードやフィルターの条件を変更してみてくださいね。</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  modelsGrid.innerHTML = filteredModels.map(model => {
    // Format model limits (e.g. 1M -> 1,048,576)
    const formatLimit = (num) => {
      if (!num) return 'なし/不明';
      return num.toLocaleString();
    };

    // Clean name for display
    const cleanName = model.name.replace('models/', '');

    // Render badges for methods
    const tagsHtml = (model.supportedGenerationMethods || [])
      .map(method => {
        const isGenerate = method === 'generateContent' || method === 'OpenAI Model';
        const isOpenAI = model.isOpenAI;
        return `<span class="method-tag ${isGenerate ? 'generate' : ''} ${isOpenAI ? 'openai-owner' : ''}">${method}</span>`;
      })
      .join('');

    return `
      <div class="card model-card">
        <div class="model-card-header">
          <h3 class="model-title">${model.displayName || cleanName}</h3>
          <button type="button" class="copy-card-btn" data-copy-value="${model.name}" title="モデル名をコピー">
            <i data-lucide="copy"></i>
          </button>
        </div>
        <div class="model-name-badge">${model.name}</div>
        <p class="model-desc">${model.description || '説明はありません。'}</p>
        
        <div class="model-specs">
          <div class="spec-item">
            <span class="spec-label">Input Limit</span>
            <span class="spec-val">${formatLimit(model.inputTokenLimit)}</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Output Limit</span>
            <span class="spec-val">${formatLimit(model.outputTokenLimit)}</span>
          </div>
        </div>

        <div class="methods-list">
          ${tagsHtml}
        </div>
      </div>
    `;
  }).join('');

  // Setup click listener for individual copy buttons
  const copyButtons = modelsGrid.querySelectorAll('.copy-card-btn');
  copyButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const valueToCopy = btn.getAttribute('data-copy-value');
      copyToClipboard(valueToCopy, `モデル名 "${valueToCopy}" をコピーしました！`);
    });
  });

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Clipboard helper
function copyToClipboard(text, successMsg) {
  navigator.clipboard.writeText(text)
    .then(() => {
      showToast(successMsg);
    })
    .catch(err => {
      console.error('Copy failed:', err);
      showToast('コピーに失敗しました', 'alert-circle');
    });
}

// Bulk copy logic
function handleBulkCopy() {
  if (filteredModels.length === 0) {
    showToast('コピー対象のモデルがありません', 'alert-circle');
    return;
  }

  const format = copyFormat.value;
  const modelNames = filteredModels.map(m => m.name);
  let textToCopy = '';

  switch (format) {
    case 'newline':
      textToCopy = modelNames.join('\n');
      break;
    case 'comma':
      textToCopy = modelNames.join(', ');
      break;
    case 'json':
      textToCopy = JSON.stringify(modelNames, null, 2);
      break;
    case 'markdown':
      textToCopy = modelNames.map(name => `- ${name}`).join('\n');
      break;
    default:
      textToCopy = modelNames.join('\n');
  }

  copyToClipboard(textToCopy, `${filteredModels.length}個のモデル名をコピーしました！`);
}

// Global Error Handler for Debugging
window.addEventListener('error', (event) => {
  // Ignore external extension/blob errors to avoid cluttering the UI
  const isInternal = 
    !event.filename || 
    event.filename.includes('main.js') || 
    event.filename.includes('index-') || 
    event.filename.includes('gemini-model-viewer');
    
  if (!isInternal) return;

  showDebugError(`JS Error: ${event.message} at ${event.filename}:${event.lineno}`);
});

window.addEventListener('unhandledrejection', (event) => {
  // Ignore external extension/blob promise rejections
  const reasonStr = String(event.reason || '');
  if (reasonStr.includes('addListener') || reasonStr.includes('Extension') || reasonStr.includes('contentscript')) {
    return;
  }

  showDebugError(`Unhandled Promise Rejection: ${event.reason}`);
});

function showDebugError(message) {
  let debugPanel = document.getElementById('debug-error-panel');
  if (!debugPanel) {
    debugPanel = document.createElement('div');
    debugPanel.id = 'debug-error-panel';
    debugPanel.style.cssText = 'position:fixed;top:0;left:0;width:100%;background:rgba(239,68,68,0.95);color:white;padding:16px;z-index:9999;font-family:monospace;font-size:12px;white-space:pre-wrap;box-shadow:0 4px 10px rgba(0,0,0,0.5);max-height:50vh;overflow-y:auto;';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ 閉じる';
    closeBtn.style.cssText = 'float:right;background:white;color:red;border:none;padding:4px 8px;cursor:pointer;font-weight:bold;margin-left:10px;';
    closeBtn.onclick = () => debugPanel.remove();
    debugPanel.appendChild(closeBtn);
    
    const title = document.createElement('strong');
    title.textContent = '⚠️ デバッグエラー検出:\n';
    debugPanel.appendChild(title);
    
    const textNode = document.createTextNode(message);
    debugPanel.appendChild(textNode);
    
    document.body.appendChild(debugPanel);
  } else {
    debugPanel.appendChild(document.createTextNode('\n' + message));
  }
}
