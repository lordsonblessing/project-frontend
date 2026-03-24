// ============================================================
// Dashboard.js – Section switching, API calls & rendering
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    // ========== DOM References ==========
    const navButtons = document.querySelectorAll('.sidebar-nav .nav-btn');
    const panels = document.querySelectorAll('.panel');
    const loginLink = document.getElementById('login-link');
    const logoutPill = document.getElementById('logout-pill');
    const userGreeting = document.getElementById('user-greeting');
    const sidebar = document.getElementById('sidebar');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');

    // Query section
    const queryInput = document.getElementById('query-input');
    const querySubmit = document.getElementById('query-submit');
    const queryClear = document.getElementById('query-clear');
    const queryOutput = document.getElementById('query-output');

    // Summary section
    const summaryInput = document.getElementById('summary-input');
    const summarySubmit = document.getElementById('summary-submit');
    const summaryClear = document.getElementById('summary-clear');
    const summaryOutput = document.getElementById('summary-output');

    // Quiz section
    const quizInput = document.getElementById('quiz-input');
    const quizSubmit = document.getElementById('quiz-submit');
    const quizClear = document.getElementById('quiz-clear');
    const quizOutput = document.getElementById('quiz-output');

    let currentUser = null;

    // ========== Utility: API URL ==========
    function apiUrl(path) {
        if (typeof window.getApiUrl === 'function') {
            return window.getApiUrl(path);
        }
        return `/${String(path || '').replace(/^\/+/, '')}`;
    }

    // ========== Auth State ==========
    async function checkAuth() {
        try {
            if (window.supabaseAuth) {
                // Check session first (faster, picks up immediate redirect state)
                const session = await window.supabaseAuth.getSession();
                currentUser = session ? session.user : null;

                // Fallback/Verify with getUser if session is null
                if (!currentUser) {
                    currentUser = await window.supabaseAuth.getUser();
                }

                console.log('Auth check:', currentUser ? `Logged in as ${currentUser.email}` : 'Not logged in');

                // Dispatch event for other components
                window.dispatchEvent(new CustomEvent('authStateChanged', {
                    detail: { user: currentUser }
                }));

                if (currentUser) {
                    if (userGreeting) {
                        userGreeting.textContent = currentUser.email;
                        userGreeting.classList.remove('hidden');
                    }
                    if (loginLink) loginLink.classList.add('hidden');
                    if (logoutPill) logoutPill.classList.remove('hidden');
                    return;
                }
            }
        } catch (err) {
            console.warn('Auth check failed:', err);
        }
        currentUser = null;
        window.dispatchEvent(new CustomEvent('authStateChanged', {
            detail: { user: null }
        }));
        if (userGreeting) userGreeting.classList.add('hidden');
        if (loginLink) loginLink.classList.remove('hidden');
        if (logoutPill) logoutPill.classList.add('hidden');
    }

    // Initial call
    await checkAuth();

    // Listen for auth state changes (more reliable for redirects)
    if (window.supabaseAuth) {
        window.supabaseAuth.onAuthStateChange(async (event, session) => {
            console.log('Supabase Auth Event:', event, !!session);
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
                await checkAuth();
            } else if (event === 'SIGNED_OUT') {
                currentUser = null;
                window.dispatchEvent(new CustomEvent('authStateChanged', {
                    detail: { user: null }
                }));
                if (userGreeting) userGreeting.classList.add('hidden');
                if (loginLink) loginLink.classList.remove('hidden');
                if (logoutPill) logoutPill.classList.add('hidden');
            }
        });
    }

    // Logout
    if (logoutPill) {
        logoutPill.addEventListener('click', async () => {
            try {
                await window.supabaseAuth?.signOut();
            } catch (err) {
                console.error('Logout error:', err);
            }
            currentUser = null;
            window.dispatchEvent(new CustomEvent('authStateChanged', {
                detail: { user: null }
            }));
            if (userGreeting) userGreeting.classList.add('hidden');
            if (loginLink) loginLink.classList.remove('hidden');
            if (logoutPill) logoutPill.classList.add('hidden');
        });
    }

    // ========== Section Switching ==========
    function switchSection(sectionId) {
        // Update nav buttons
        navButtons.forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.section === sectionId);
        });

        // Update panels
        panels.forEach((panel) => {
            const isTarget = panel.id === `panel-${sectionId}`;
            panel.classList.toggle('active', isTarget);
        });

        // Close mobile sidebar
        closeMobileSidebar();
    }

    navButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const sectionId = btn.dataset.section;
            switchSection(sectionId);
            if (sectionId === 'history') {
                loadHistoryItems();
            }
        });
    });

    // ========== Guest Restrictions ==========
    function checkRestriction(e) {
        if (!currentUser) {
            e.preventDefault();
            e.stopPropagation();
            alert('Please login to use this feature.');
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }

    [querySubmit, summarySubmit, quizSubmit].forEach(btn => {
        if (btn) {
            btn.addEventListener('mousedown', (e) => {
                if (!currentUser) {
                    checkRestriction(e);
                }
            });
        }
    });

    [queryInput, summaryInput, quizInput].forEach(input => {
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !currentUser) {
                    checkRestriction(e);
                }
            });
            input.addEventListener('focus', (e) => {
                if (!currentUser) {
                    // Just a subtle hint or do nothing to avoid annoying user
                    input.placeholder = "Login to use this feature...";
                }
            });
        }
    });

    // ========== Mobile Sidebar ==========
    let overlay = null;

    function openMobileSidebar() {
        sidebar.classList.add('open');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay open';
            overlay.addEventListener('click', closeMobileSidebar);
            document.body.appendChild(overlay);
        } else {
            overlay.classList.add('open');
        }
    }

    function closeMobileSidebar() {
        sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
    }

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            if (sidebar.classList.contains('open')) {
                closeMobileSidebar();
            } else {
                openMobileSidebar();
            }
        });
    }

    // ========== Formatting Helpers ==========
    function escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function formatMarkdown(text) {
        let html = escapeHtml(text);
        // Code blocks
        html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
        // Inline code
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        // Bold
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // Italic
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        // Bullet lists
        html = html.replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
        // Numbered lists
        html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
        // Line breaks
        html = html.replace(/\n/g, '<br>');
        // Clean up double breaks inside lists
        html = html.replace(/<br><li>/g, '<li>');
        html = html.replace(/<\/li><br>/g, '</li>');
        return html;
    }

    // ========== Render Helpers ==========
    function showLoading(container, message = 'Generating response...') {
        container.innerHTML = `
      <div class="loading-container">
        <div class="loading-dots">
          <div class="loading-dot"></div>
          <div class="loading-dot"></div>
          <div class="loading-dot"></div>
        </div>
        <span class="loading-text">${message}</span>
      </div>
    `;
        container.classList.add('has-content');
    }

    function showError(container, message) {
        container.innerHTML = `
      <div class="error-message">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <span>${escapeHtml(message)}</span>
      </div>
    `;
        container.classList.add('has-content');
    }

    function showPlaceholder(container, icon, text) {
        container.innerHTML = `
      <div class="output-placeholder">
        <div class="placeholder-icon">${icon}</div>
        <p>${text}</p>
      </div>
    `;
        container.classList.remove('has-content');
    }

    function renderContent(container, html) {
        container.innerHTML = `<div class="output-content">${html}</div>`;
        container.classList.add('has-content');
    }

    // ========== Typewriter Effect ==========
    async function typewriterRender(container, text, delay = 10) {
        const wrapper = document.createElement('div');
        wrapper.className = 'output-content';
        container.innerHTML = '';
        container.appendChild(wrapper);
        container.classList.add('has-content');

        let buffer = '';
        for (let i = 0; i < text.length; i++) {
            buffer += text[i];
            if (i % 4 === 0 || i === text.length - 1) {
                wrapper.innerHTML = formatMarkdown(buffer);
            }
            await new Promise((r) => setTimeout(r, delay));
        }
        // Final render
        wrapper.innerHTML = formatMarkdown(text);
    }

    // ========== Ask Query Handler ==========
    let queryInProgress = false;

    async function handleQuery() {
        if (queryInProgress) return;
        const topic = (queryInput.value || '').trim();
        if (!topic) return;

        queryInProgress = true;
        querySubmit.disabled = true;
        showLoading(queryOutput, 'Generating explanation...');

        try {
            const res = await fetch(apiUrl('/api/explain'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic }),
            });

            if (!res.ok) {
                let errMsg = '';
                try {
                    const errData = await res.json();
                    errMsg = errData?.error || '';
                } catch (_) { }
                throw new Error(errMsg || `Server error ${res.status}`);
            }

            const data = await res.json();
            const explanation = data.explanation || 'No explanation received.';
            await typewriterRender(queryOutput, explanation);

            // Save to history
            if (currentUser && window.supabaseDb) {
                await window.supabaseDb.saveStudyHistory(currentUser.id, `Explain: ${topic}`, {
                    type: 'explanation',
                    content: explanation
                });
            }
        } catch (err) {
            console.error('Query error:', err);
            showError(queryOutput, err.message || 'Something went wrong.');
        } finally {
            queryInProgress = false;
            querySubmit.disabled = false;
            queryInput.focus();
        }
    }

    querySubmit.addEventListener('click', handleQuery);
    queryInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleQuery();
        }
    });
    queryClear.addEventListener('click', () => {
        queryInput.value = '';
        showPlaceholder(queryOutput, '💡', 'Your AI-generated explanation will appear here.');
    });

    // ========== Summarize Handler ==========
    let summaryInProgress = false;

    async function handleSummary() {
        if (summaryInProgress) return;
        const topic = (summaryInput.value || '').trim();
        if (!topic) return;

        summaryInProgress = true;
        summarySubmit.disabled = true;
        showLoading(summaryOutput, 'Generating summary...');

        try {
            const res = await fetch(apiUrl('/api/summary'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic }),
            });

            if (!res.ok) {
                let errMsg = '';
                try {
                    const errData = await res.json();
                    errMsg = errData?.error || '';
                } catch (_) { }
                throw new Error(errMsg || `Server error ${res.status}`);
            }

            const data = await res.json();
            const summary = data.summary || 'No summary received.';
            await typewriterRender(summaryOutput, summary);

            // Save to history
            if (currentUser && window.supabaseDb) {
                await window.supabaseDb.saveStudyHistory(currentUser.id, `Summary: ${topic}`, {
                    type: 'summary',
                    content: summary
                });
            }
        } catch (err) {
            console.error('Summary error:', err);
            showError(summaryOutput, err.message || 'Something went wrong.');
        } finally {
            summaryInProgress = false;
            summarySubmit.disabled = false;
            summaryInput.focus();
        }
    }

    summarySubmit.addEventListener('click', handleSummary);
    summaryInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSummary();
        }
    });
    summaryClear.addEventListener('click', () => {
        summaryInput.value = '';
        showPlaceholder(summaryOutput, '📄', 'Your AI-generated summary will appear here.');
    });

    // ========== Quiz Handler ==========
    let quizInProgress = false;

    async function handleQuiz() {
        if (quizInProgress) return;
        const topic = (quizInput.value || '').trim();
        if (!topic) return;

        quizInProgress = true;
        quizSubmit.disabled = true;
        showLoading(quizOutput, 'Generating quiz questions...');

        try {
            const res = await fetch(apiUrl('/api/quiz'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic }),
            });

            if (!res.ok) {
                let errMsg = '';
                try {
                    const errData = await res.json();
                    errMsg = errData?.error || '';
                } catch (_) { }
                throw new Error(errMsg || `Server error ${res.status}`);
            }

            const data = await res.json();
            const quiz = data.quiz;

            if (!Array.isArray(quiz) || quiz.length === 0) {
                throw new Error('No quiz questions received.');
            }

            renderQuiz(quizOutput, quiz);

            // Save to history
            if (currentUser && window.supabaseDb) {
                await window.supabaseDb.saveStudyHistory(currentUser.id, `Quiz: ${topic}`, {
                    type: 'quiz',
                    content: quiz
                });
            }
        } catch (err) {
            console.error('Quiz error:', err);
            showError(quizOutput, err.message || 'Something went wrong.');
        } finally {
            quizInProgress = false;
            quizSubmit.disabled = false;
            quizInput.focus();
        }
    }

    function renderQuiz(container, quiz) {
        let html = '<div class="quiz-list">';
        quiz.forEach((q, i) => {
            const options = Array.isArray(q.options) ? q.options : [];
            const answer = q.answer || '';
            const explanation = q.explanation || '';

            html += `
        <div class="quiz-card" data-answer="${escapeHtml(answer)}">
          <div class="quiz-card-number">Question ${i + 1}</div>
          <div class="quiz-card-question">${escapeHtml(q.question || '')}</div>
          <div class="quiz-card-options">
            ${options
                    .map(
                        (opt) =>
                            `<button class="quiz-option" data-option="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`
                    )
                    .join('')}
          </div>
          <div class="quiz-card-answer" id="quiz-answer-${i}">
            <div class="quiz-answer-label">✅ Correct Answer</div>
            <div class="quiz-answer-text">${escapeHtml(answer)}</div>
            <div class="quiz-explanation">${escapeHtml(explanation)}</div>
          </div>
        </div>
      `;
        });
        html += '</div>';
        container.innerHTML = html;
        container.classList.add('has-content');

        // Attach click handlers to options
        container.querySelectorAll('.quiz-card').forEach((card, cardIdx) => {
            const correctAnswer = card.dataset.answer;
            const optionBtns = card.querySelectorAll('.quiz-option');
            const answerPanel = document.getElementById(`quiz-answer-${cardIdx}`);
            let answered = false;

            optionBtns.forEach((btn) => {
                btn.addEventListener('click', () => {
                    if (answered) return;
                    answered = true;

                    const selected = btn.dataset.option;
                    // Highlight correct/wrong
                    optionBtns.forEach((b) => {
                        if (b.dataset.option === correctAnswer) {
                            b.classList.add('correct');
                        } else if (b === btn && selected !== correctAnswer) {
                            b.classList.add('wrong');
                        }
                        b.style.pointerEvents = 'none';
                    });

                    // Show answer explanation
                    if (answerPanel) answerPanel.classList.add('visible');
                });
            });
        });
    }

    quizSubmit.addEventListener('click', handleQuiz);
    quizInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleQuiz();
        }
    });
    quizClear.addEventListener('click', () => {
        quizInput.value = '';
        showPlaceholder(quizOutput, '🧠', 'Your AI-generated quiz questions will appear here.');
    });
    // ========== History Logic (Merged) ==========
    const historyList = document.getElementById('history-list');
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    let historyOverlay = null;

    if (historyList) {
        // Initial state check
        updateHistoryRestriction();

        // Listen for internal changes
        window.addEventListener('authStateChanged', () => {
            updateHistoryRestriction();
        });

        clearHistoryBtn && clearHistoryBtn.addEventListener('click', async () => {
            if (!currentUser) return;
            if (!confirm('Are you sure you want to clear your entire interaction history?')) return;

            try {
                if (window.supabaseDb) {
                    await window.supabaseDb.clearConversations(currentUser.id);
                    await window.supabaseDb.clearStudyHistory(currentUser.id);
                }
                historyList.innerHTML = '';
                showPlaceholder(historyList, '📜', 'History cleared. Start a new session to see interactions here.');
            } catch (err) {
                console.error('Clear history error:', err);
                alert('Failed to clear history. Please try again.');
            }
        });
    }

    function updateHistoryRestriction() {
        if (!historyList) return;
        if (currentUser) {
            removeHistoryRestriction();
            loadHistoryItems();
        } else {
            showHistoryRestriction();
            historyList.innerHTML = '';
            showPlaceholder(historyList, '📜', 'Please login to view your interaction history saved in the database.');
        }
    }

    function showHistoryRestriction() {
        if (historyOverlay) return;
        const container = historyList.closest('.panel');
        if (!container) return;

        historyOverlay = document.createElement('div');
        historyOverlay.className = 'restricted-overlay';
        historyOverlay.innerHTML = `
            <div class="restricted-icon">🔒</div>
            <h3 class="restricted-title">History Protected</h3>
            <p class="restricted-text">Please login to view your past study interactions and saved AI conversations.</p>
            <a href="login.html" class="restricted-btn">Login to View History</a>
        `;
        // Position relative to the list container
        historyList.style.position = 'relative';
        historyList.appendChild(historyOverlay);
    }

    function removeHistoryRestriction() {
        if (historyOverlay) {
            historyOverlay.remove();
            historyOverlay = null;
        }
    }

    async function loadHistoryItems() {
        if (!currentUser || !window.supabaseDb) return;

        try {
            // Show loading state
            historyList.innerHTML = '<div class="loading-spinner">Loading history...</div>';

            console.log('Fetching history for user:', currentUser.id);

            // Fetch both chatbot conversations AND generic study records
            const [conversations, studyRecords] = await Promise.all([
                window.supabaseDb.getConversations(currentUser.id),
                window.supabaseDb.getStudyHistory(currentUser.id)
            ]);

            console.log('History fetched. Conversations:', conversations.length, 'Study Records:', studyRecords.length);

            historyList.innerHTML = '';

            // Combine and sort by created_at descending
            const allHistory = [
                ...conversations.map(c => ({ ...c, kind: 'chat' })),
                ...studyRecords.map(s => ({ ...s, kind: 'study' }))
            ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            if (allHistory.length > 0) {
                allHistory.forEach(item => {
                    if (item.kind === 'chat') {
                        renderHistoryCard(item.role, item.content, item.created_at, 'Chat Message');
                    } else {
                        // Study record
                        const label = item.topic || 'Study Interaction';
                        let content = '';
                        if (item.payload) {
                            if (item.payload.type === 'quiz') {
                                content = `Generated a quiz with ${item.payload.content?.length || 0} questions.`;
                            } else {
                                content = item.payload.content || '';
                            }
                        }
                        renderHistoryCard('assistant', content, item.created_at, label);
                    }
                });
            } else {
                showPlaceholder(historyList, '📜', 'No history found. Start asking questions or generating summaries to build your history!');
            }
        } catch (err) {
            console.error('Load history error:', err);
            historyList.innerHTML = `<div class="error-text">Failed to load history items: ${err.message}</div>`;
        }
    }

    function renderHistoryCard(role, content, timestamp, label = null) {
        const item = document.createElement('div');
        item.className = 'history-item';

        const date = new Date(timestamp).toLocaleString();
        const displayRole = label || (role === 'user' ? 'You' : 'AI Assistant');
        const roleClass = role === 'user' ? 'role-user' : 'role-assistant';

        // Truncate content for list view if it's too long
        const displayContent = content.length > 300 ? content.substring(0, 300) + '...' : content;

        item.innerHTML = `
            <div class="history-header">
                <span class="history-role ${roleClass}">${displayRole}</span>
                <span class="history-time">${date}</span>
            </div>
            <div class="history-content">${formatMarkdown(displayContent)}</div>
        `;

        historyList.appendChild(item);
    }

    function showPlaceholder(container, icon, text) {
        container.innerHTML = `
            <div class="output-placeholder">
                <div class="placeholder-icon">${icon}</div>
                <p>${text}</p>
            </div>
        `;
    }
});
