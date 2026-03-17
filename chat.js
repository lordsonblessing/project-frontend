// ============================================================
// Chat.js – Chatbot frontend logic for the home page
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');
    const clearBtn = document.getElementById('clear-chat-btn');
    const loginLink = document.getElementById('login-link');
    const logoutPill = document.getElementById('logout-pill');
    const userGreeting = document.getElementById('user-greeting');

    if (!chatMessages || !chatInput || !sendBtn) return;

    let currentUser = null;

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
                currentUser = await window.supabaseAuth.getUser();
                if (currentUser) {
                    // Show greeting, hide login link, show logout
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
        // Not logged in
        currentUser = null;
        if (userGreeting) userGreeting.classList.add('hidden');
        if (loginLink) loginLink.classList.remove('hidden');
        if (logoutPill) logoutPill.classList.add('hidden');
    }

    await checkAuth();

    // Logout handler
    logoutPill && logoutPill.addEventListener('click', async () => {
        try {
            await window.supabaseAuth?.signOut();
        } catch (err) {
            console.error('Logout error:', err);
        }
        currentUser = null;
        if (userGreeting) userGreeting.classList.add('hidden');
        if (loginLink) loginLink.classList.remove('hidden');
        if (logoutPill) logoutPill.classList.add('hidden');
    });

    // ========== Load conversation history ==========
    async function loadConversationHistory() {
        try {
            if (currentUser && window.supabaseDb) {
                const messages = await window.supabaseDb.getConversations(currentUser.id);
                if (messages && messages.length > 0) {
                    messages.forEach((msg) => {
                        appendMessage(msg.role, msg.content, false);
                    });
                    scrollToBottom();
                }
            } else {
                // Guest: load from localStorage
                const stored = localStorage.getItem('chat-history-guest');
                if (stored) {
                    try {
                        const messages = JSON.parse(stored);
                        messages.forEach((msg) => {
                            appendMessage(msg.role, msg.content, false);
                        });
                        scrollToBottom();
                    } catch (e) { /* ignore parse errors */ }
                }
            }
        } catch (err) {
            console.error('Error loading conversation history:', err);
        }
    }

    await loadConversationHistory();

    // ========== Save message ==========
    async function saveMessage(role, content) {
        try {
            if (currentUser && window.supabaseDb) {
                await window.supabaseDb.saveMessage(currentUser.id, role, content);
            } else {
                // Guest: save to localStorage
                const stored = localStorage.getItem('chat-history-guest');
                let messages = [];
                try { messages = stored ? JSON.parse(stored) : []; } catch (e) { messages = []; }
                messages.push({ role, content, timestamp: new Date().toISOString() });
                // Keep last 100 messages
                if (messages.length > 100) messages = messages.slice(-100);
                localStorage.setItem('chat-history-guest', JSON.stringify(messages));
            }
        } catch (err) {
            console.error('Error saving message:', err);
        }
    }

    // ========== Append message bubble ==========
    function appendMessage(role, content, animate = true) {
        const wrapper = document.createElement('div');
        wrapper.className = `chat-message ${role}`;

        if (role === 'assistant') {
            const avatar = document.createElement('div');
            avatar.className = 'chat-avatar';
            avatar.textContent = 'AI';
            wrapper.appendChild(avatar);
        }

        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble';

        if (animate && role === 'assistant') {
            // Typewriter effect for AI response
            bubble.innerHTML = '';
            wrapper.appendChild(bubble);
            chatMessages.appendChild(wrapper);
            typewriterEffect(bubble, content);
        } else {
            bubble.innerHTML = formatMessage(content);
            wrapper.appendChild(bubble);
            chatMessages.appendChild(wrapper);
        }

        scrollToBottom();
        return wrapper;
    }

    // ========== Format message with basic markdown ==========
    function formatMessage(text) {
        // Escape HTML
        let html = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Code blocks
        html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
        // Inline code
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        // Bold
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // Italic
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        // Line breaks
        html = html.replace(/\n/g, '<br>');

        return html;
    }

    // ========== Typewriter Effect ==========
    let activeTypewriter = null;

    async function typewriterEffect(element, text, delay = 12) {
        // Cancel any previous typewriter
        if (activeTypewriter) activeTypewriter.cancelled = true;
        const controller = { cancelled: false };
        activeTypewriter = controller;

        element.innerHTML = '';
        let buffer = '';

        for (let i = 0; i < text.length; i++) {
            if (controller.cancelled) break;
            buffer += text[i];

            // Update DOM every few characters for performance
            if (i % 3 === 0 || i === text.length - 1) {
                element.innerHTML = formatMessage(buffer);
                scrollToBottom();
            }
            await new Promise((r) => setTimeout(r, delay));
        }

        // Final render
        element.innerHTML = formatMessage(text);
        scrollToBottom();
        if (activeTypewriter === controller) activeTypewriter = null;
    }

    // ========== Typing indicator ==========
    function showTypingIndicator() {
        const wrapper = document.createElement('div');
        wrapper.className = 'chat-message assistant';
        wrapper.id = 'typing-indicator';

        const avatar = document.createElement('div');
        avatar.className = 'chat-avatar';
        avatar.textContent = 'AI';
        wrapper.appendChild(avatar);

        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble typing-bubble';
        bubble.innerHTML = `
      <div class="typing-dots">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    `;
        wrapper.appendChild(bubble);
        chatMessages.appendChild(wrapper);
        scrollToBottom();

        return wrapper;
    }

    function removeTypingIndicator() {
        const el = document.getElementById('typing-indicator');
        if (el) el.remove();
    }

    // ========== Scroll ==========
    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // ========== Send message ==========
    let isSending = false;

    async function sendMessage() {
        if (isSending) return;
        const message = (chatInput.value || '').trim();
        if (!message) return;

        chatInput.value = '';
        isSending = true;
        sendBtn.disabled = true;

        // Show user message
        appendMessage('user', message, false);
        await saveMessage('user', message);

        // Show typing indicator
        const typingEl = showTypingIndicator();

        try {
            const response = await fetch(apiUrl('/api/chat'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message }),
            });

            removeTypingIndicator();

            if (!response.ok) {
                let backendError = '';
                try {
                    const errData = await response.json();
                    backendError = errData?.error || '';
                } catch (_) {
                    backendError = '';
                }
                throw new Error(backendError || `Server error ${response.status}`);
            }

            const data = await response.json();
            const reply = data.reply || 'Sorry, I could not generate a response.';

            // Show AI reply with animation
            appendMessage('assistant', reply, true);
            await saveMessage('assistant', reply);
        } catch (err) {
            removeTypingIndicator();
            console.error('Chat error:', err);
            appendMessage('assistant', `Error: ${err.message || 'Something went wrong.'}`, false);
        } finally {
            isSending = false;
            sendBtn.disabled = false;
            chatInput.focus();
        }
    }

    // ========== Event listeners ==========
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Clear chat
    clearBtn && clearBtn.addEventListener('click', async () => {
        // Keep the welcome message, remove the rest
        const firstMsg = chatMessages.querySelector('.chat-message');
        chatMessages.innerHTML = '';
        if (firstMsg) chatMessages.appendChild(firstMsg);

        try {
            if (currentUser && window.supabaseDb) {
                await window.supabaseDb.clearConversations(currentUser.id);
            } else {
                localStorage.removeItem('chat-history-guest');
            }
        } catch (err) {
            console.error('Clear chat error:', err);
        }
    });
});

