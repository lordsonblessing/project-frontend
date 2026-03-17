// Simple page detection
const isHome = window.location.pathname.endsWith('/') || window.location.pathname.endsWith('/index.html');
const isStudy = window.location.pathname.endsWith('/study.html');

// ========== History (Supabase Database) ==========
// Fallback to localStorage if Supabase is not available
const HISTORY_KEY = 'ai-study-assistant-history';

async function loadHistory() {
  try {
    // Try Supabase first if available
    if (window.supabaseDb && window.supabaseAuth) {
      const user = await window.supabaseAuth.getUser();
      if (user) {
        const entries = await window.supabaseDb.getStudyHistory(user.id);
        // Transform Supabase format to expected format
        return entries.map(entry => ({
          topic: entry.topic,
          timestamp: entry.created_at,
          payload: entry.payload,
          id: entry.id, // Store ID for deletion
        }));
      }
    }

    // Fallback to localStorage
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading history:', err);
    // Fallback to localStorage
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
}

async function saveHistory(entries) {
  try {
    // For Supabase, we don't need to save all entries at once
    // Individual entries are saved via addHistoryEntry
    // But we can clear if needed
    if (window.supabaseDb && window.supabaseAuth) {
      const user = await window.supabaseAuth.getUser();
      if (user && entries.length === 0) {
        await window.supabaseDb.clearStudyHistory(user.id);
        return;
      }
    }

    // Fallback to localStorage
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 50)));
  } catch (err) {
    console.error('Error saving history:', err);
    // Fallback to localStorage
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 50)));
  }
}

async function addHistoryEntry(topic, payload) {
  try {
    // Try Supabase first if available
    if (window.supabaseDb && window.supabaseAuth) {
      const user = await window.supabaseAuth.getUser();
      if (user) {
        await window.supabaseDb.saveStudyHistory(user.id, topic, payload);
        return;
      }
    }

    // Fallback to localStorage
    const entries = await loadHistory();
    const timestamp = new Date().toISOString();
    const entry = { topic, timestamp, payload };
    // move existing topic to top if already present
    const filtered = entries.filter((e) => e.topic.toLowerCase() !== topic.toLowerCase());
    filtered.unshift(entry);
    saveHistory(filtered);
  } catch (err) {
    console.error('Error adding history entry:', err);
    // Fallback to localStorage
    const entries = await loadHistory();
    const timestamp = new Date().toISOString();
    const entry = { topic, timestamp, payload };
    const filtered = entries.filter((e) => e.topic.toLowerCase() !== topic.toLowerCase());
    filtered.unshift(entry);
    saveHistory(filtered);
  }
}

function formatTime(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleString();
  } catch {
    return '';
  }
}

// ========== History UI ==========
function initSharedHistoryUI() {
  const historyModal = document.getElementById('history-modal');
  const openHistoryBtn = document.getElementById('open-history-btn');
  const closeHistoryBtn = document.getElementById('close-history-btn');
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  const historyList = document.getElementById('history-list');

  if (!historyModal || !historyList) return;

  async function renderHistory() {
    const entries = await loadHistory();
    historyList.innerHTML = '';
    if (!entries.length) {
      historyList.innerHTML =
        '<p style="font-size:0.85rem;color:#9ca3af;">No topics yet. Start studying to see them here.</p>';
      return;
    }
    entries.forEach((entry, index) => {
      const item = document.createElement('div');
      item.className = 'history-item';
      item.dataset.index = index;
      item.dataset.id = entry.id || index; // Store ID for deletion if available
      item.innerHTML = `<span>${entry.topic}</span><small>${formatTime(entry.timestamp || entry.created_at)}</small>`;
      item.addEventListener('click', () => {
        if (isStudy && entry.payload) {
          // Reopen content on study page
          restoreStudyFromHistory(entry);
        } else if (isHome) {
          window.location.href = 'study.html';
          sessionStorage.setItem('pendingTopic', entry.topic);
        }
        historyModal.classList.add('hidden');
      });
      historyList.appendChild(item);
    });
  }

  function openModal() {
    historyModal.classList.remove('hidden');
    renderHistory();
  }

  function closeModal() {
    historyModal.classList.add('hidden');
  }

  openHistoryBtn && openHistoryBtn.addEventListener('click', openModal);
  closeHistoryBtn && closeHistoryBtn.addEventListener('click', closeModal);
  historyModal.querySelector('.history-overlay')?.addEventListener('click', closeModal);

  clearHistoryBtn &&
    clearHistoryBtn.addEventListener('click', async () => {
      await saveHistory([]);
      await renderHistory();
    });
}

// ========== Home Page Logic ==========
// Home page now uses chat.js for the chatbot interface.
function initHomePage() {
  // No-op: home page chatbot is handled by chat.js
}

// ========== Study Page Logic ==========
let typewriterControllers = [];

function stopAllTypewriters() {
  typewriterControllers.forEach((c) => (c.cancelled = true));
  typewriterControllers = [];
}

async function typewriterEffect(element, text, delay = 14) {
  stopAllTypewriters();
  const controller = { cancelled: false };
  typewriterControllers.push(controller);
  element.textContent = '';
  for (let i = 0; i < text.length; i++) {
    if (controller.cancelled) break;
    element.textContent += text[i];
    await new Promise((r) => setTimeout(r, delay));
  }
}

function renderQuiz(quizData) {
  const quizContainer = document.getElementById('quiz-content');
  if (!quizContainer) return;
  quizContainer.innerHTML = '';
  if (!Array.isArray(quizData) || !quizData.length) {
    quizContainer.textContent = 'No quiz questions generated.';
    return;
  }

  quizData.forEach((q, idx) => {
    const item = document.createElement('div');
    item.className = 'quiz-item';

    const question = document.createElement('div');
    question.className = 'quiz-question';
    question.textContent = `${idx + 1}. ${q.question}`;
    item.appendChild(question);

    if (Array.isArray(q.options)) {
      const options = document.createElement('div');
      options.className = 'quiz-options';
      q.options.forEach((opt) => {
        const optEl = document.createElement('div');
        optEl.className = 'quiz-option';
        optEl.textContent = opt;
        options.appendChild(optEl);
      });
      item.appendChild(options);
    }

    if (q.answer) {
      const ans = document.createElement('div');
      ans.className = 'quiz-answer';
      ans.textContent = `Answer: ${q.answer}`;
      item.appendChild(ans);
    }

    if (q.explanation) {
      const exp = document.createElement('div');
      exp.className = 'quiz-explanation';
      exp.textContent = q.explanation;
      item.appendChild(exp);
    }

    quizContainer.appendChild(item);
  });
}

function bindCollapsibles() {
  document.querySelectorAll('.collapsible').forEach((card) => {
    const header = card.querySelector('.collapsible-header');
    if (!header) return;
    header.addEventListener('click', () => {
      const isOpen = card.classList.contains('open');
      if (isOpen) {
        card.classList.remove('open');
      } else {
        card.classList.add('open');
      }
    });
  });
}

function restoreStudyFromHistory(entry) {
  const topicInput = document.getElementById('topic-input');
  const resultsContainer = document.getElementById('results-container');
  const explanationEl = document.getElementById('explanation-content');
  const summaryEl = document.getElementById('summary-content');
  const notesEl = document.getElementById('notes-content');

  if (!entry || !entry.payload) return;

  topicInput && (topicInput.value = entry.topic);
  resultsContainer && resultsContainer.classList.remove('hidden');

  if (explanationEl) explanationEl.textContent = entry.payload.explanation || '';
  if (summaryEl) summaryEl.textContent = entry.payload.summary || '';
  if (notesEl) notesEl.textContent = entry.payload.notes || '';
  if (entry.payload.quiz) renderQuiz(entry.payload.quiz);
}

function initStudyPage() {
  if (!isStudy) return;

  const topicInput = document.getElementById('topic-input');
  const studyBtn = document.getElementById('study-btn');
  const loadingIndicator = document.getElementById('loading-indicator');
  const resultsContainer = document.getElementById('results-container');
  const explanationEl = document.getElementById('explanation-content');
  const summaryEl = document.getElementById('summary-content');
  const notesEl = document.getElementById('notes-content');
  const recentInline = document.getElementById('recent-topics-inline');
  const clearInlineBtn = document.getElementById('clear-inline-history-btn');

  // Populate inline recent topics
  async function renderInlineHistory() {
    if (!recentInline) return;
    const entries = await loadHistory();
    recentInline.innerHTML = '';
    entries.slice(0, 8).forEach((e) => {
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.type = 'button';
      chip.textContent = e.topic;
      chip.addEventListener('click', () => {
        topicInput.value = e.topic;
        if (e.payload) {
          restoreStudyFromHistory(e);
        } else {
          handleStudy();
        }
      });
      recentInline.appendChild(chip);
    });
  }

  clearInlineBtn &&
    clearInlineBtn.addEventListener('click', async () => {
      await saveHistory([]);
      await renderInlineHistory();
    });

  async function callEndpoint(endpoint, topic) {
    const response = await fetch(apiUrl(`/api/${endpoint}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic }),
    });
    if (!response.ok) {
      let backendError = '';
      try {
        const errData = await response.json();
        backendError = errData?.error || '';
      } catch (_) {
        backendError = '';
      }
      throw new Error(backendError || `Failed to fetch ${endpoint}`);
    }
    return response.json();
  }

  async function handleStudy() {
    const topic = (topicInput.value || '').trim();
    if (!topic) {
      topicInput.focus();
      return;
    }

    loadingIndicator && loadingIndicator.classList.remove('hidden');
    resultsContainer && resultsContainer.classList.add('hidden');
    stopAllTypewriters();

    try {
      const [explainRes, summaryRes, notesRes, quizRes] = await Promise.all([
        callEndpoint('explain', topic),
        callEndpoint('summary', topic),
        callEndpoint('notes', topic),
        callEndpoint('quiz', topic),
      ]);

      resultsContainer && resultsContainer.classList.remove('hidden');

      if (explanationEl && explainRes.explanation) {
        typewriterEffect(explanationEl, explainRes.explanation);
      }
      if (summaryEl && summaryRes.summary) {
        typewriterEffect(summaryEl, summaryRes.summary, 16);
      }
      if (notesEl && notesRes.notes) {
        typewriterEffect(notesEl, notesRes.notes, 12);
      }

      if (quizRes.quiz) {
        renderQuiz(quizRes.quiz);
      }

      await addHistoryEntry(topic, {
        explanation: explainRes.explanation,
        summary: summaryRes.summary,
        notes: notesRes.notes,
        quiz: quizRes.quiz,
      });
      await renderInlineHistory();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Something went wrong while generating your study content.');
    } finally {
      loadingIndicator && loadingIndicator.classList.add('hidden');
    }
  }

  studyBtn && studyBtn.addEventListener('click', handleStudy);
  topicInput &&
    topicInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleStudy();
      }
    });

  bindCollapsibles();
  renderInlineHistory();

  // If redirected with a pending topic from home
  const pendingTopic = sessionStorage.getItem('pendingTopic');
  if (pendingTopic) {
    sessionStorage.removeItem('pendingTopic');
    topicInput.value = pendingTopic;
    handleStudy();
  }
}

// ========== Init ==========
document.addEventListener('DOMContentLoaded', () => {
  initSharedHistoryUI();
  initHomePage();
  initStudyPage();
});
  function apiUrl(path) {
    if (typeof window.getApiUrl === 'function') {
      return window.getApiUrl(path);
    }
    return `/${String(path || '').replace(/^\/+/, '')}`;
  }
