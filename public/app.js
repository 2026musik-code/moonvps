document.addEventListener('DOMContentLoaded', () => {
    const chatContainer = document.getElementById('chat-container');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const modelSelect = document.getElementById('model-select');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const menuBtn = document.getElementById('menu-btn');
    const closeSidebarBtn = document.getElementById('close-sidebar');
    const newChatBtn = document.getElementById('new-chat-btn');
    const chatHistoryContainer = document.getElementById('chat-history');

    let isProcessing = false;
    let currentChatId = null;
    let chatHistory = []; // Array of message objects {role, content}

    // Initialize
    loadChatList();

    // Generate new chat ID if not present
    if (!currentChatId) {
        startNewChat();
    }

    // Sidebar Toggle Logic
    function toggleSidebar() {
        sidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('active');
    }

    menuBtn.addEventListener('click', toggleSidebar);
    closeSidebarBtn.addEventListener('click', toggleSidebar);
    sidebarOverlay.addEventListener('click', toggleSidebar);

    // New Chat Logic
    newChatBtn.addEventListener('click', () => {
        startNewChat();
        if (window.innerWidth <= 768) {
            toggleSidebar();
        }
    });

    function startNewChat() {
        currentChatId = crypto.randomUUID();
        chatHistory = [];
        chatContainer.innerHTML = `
            <div class="welcome-message">
                <h1>Welcome to NEXUS</h1>
                <p>Advanced AI Interaction Interface</p>
            </div>
        `;
        // We don't save the chat to the backend until the first message is sent
        // But we should refresh the active state in the sidebar if exists
        document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
    }

    async function loadChatList() {
        try {
            const res = await fetch('/api/chats');
            if (!res.ok) throw new Error('Failed to fetch chats');
            const data = await res.json();
            renderChatList(data.chats || []);
        } catch (err) {
            console.error('Error loading chat list:', err);
        }
    }

    function renderChatList(chats) {
        chatHistoryContainer.innerHTML = '';
        // Sort by timestamp if available (implementation dependent), for now assume list order
        // Reverse to show newest top
        chats.reverse().forEach(chat => {
            const div = document.createElement('div');
            div.className = `history-item ${chat.id === currentChatId ? 'active' : ''}`;
            div.innerHTML = `<i class="fa-regular fa-message"></i> ${chat.title || 'New Chat'}`;
            div.onclick = () => loadChat(chat.id);
            chatHistoryContainer.appendChild(div);
        });
    }

    async function loadChat(id) {
        if (isProcessing) return;
        currentChatId = id;

        // Update UI active state
        document.querySelectorAll('.history-item').forEach(el => {
            el.classList.toggle('active', el.textContent.includes(id) || false); // simplified check
            // Actually we should re-render or better dom manipulation
        });
        renderChatList(Array.from(document.querySelectorAll('.history-item')).map(el => ({id: 'TODO', title: el.innerText}))); // Re-fetch recommended
        // Better: Just fetch list again or manually toggle classes.
        // For simplicity, let's just fetch the chat content.

        try {
            const res = await fetch(`/api/chat?id=${id}`);
            if (!res.ok) throw new Error('Failed to load chat');
            const data = await res.json();

            chatHistory = data.messages || [];

            // Re-render chat area
            chatContainer.innerHTML = '';
            chatHistory.forEach(msg => {
                addMessageToUI(msg.content, msg.role);
            });

            if (window.innerWidth <= 768) {
                toggleSidebar();
            }
        } catch (err) {
            console.error(err);
        }
    }

    // Auto-resize textarea
    userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        if(this.value === '') this.style.height = 'auto';
    });

    // Send message on Enter (but Shift+Enter for newline)
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    sendBtn.addEventListener('click', sendMessage);

    // Event delegation for copy buttons
    chatContainer.addEventListener('click', (e) => {
        if (e.target.closest('.copy-btn')) {
            const btn = e.target.closest('.copy-btn');
            const codeBlock = btn.closest('.code-block');

            if (!codeBlock) return;
            const codeElement = codeBlock.querySelector('code');
            if (!codeElement) return;

            const code = codeElement.innerText;

            navigator.clipboard.writeText(code).then(() => {
                const originalText = btn.innerHTML;
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
                setTimeout(() => {
                    btn.innerHTML = originalText;
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy: ', err);
            });
        }
    });

    async function sendMessage() {
        const text = userInput.value.trim();
        if (!text || isProcessing) return;

        isProcessing = true;

        const welcome = document.querySelector('.welcome-message');
        if (welcome) welcome.style.display = 'none';

        // Add User Message to UI and History
        addMessageToUI(text, 'user');
        chatHistory.push({ role: 'user', content: text });

        userInput.value = '';
        userInput.style.height = 'auto';

        const loadingId = addLoading();

        // Save immediately (optimistic)
        saveCurrentChat();

        try {
            const model = modelSelect.value;
            if (typeof puter === 'undefined') {
                throw new Error("Puter.js is not loaded.");
            }

            // Prepare context for AI (optional: send history)
            // For now, puter.ai.chat(text) is stateless unless we pass messages array?
            // The puter.js documentation usually supports `messages: []`.
            // However, based on the previous snippet, we used simple text.
            // Let's stick to simple text for the prompt, but maybe puter.js
            // has a way to accept history. If not, we just send the new prompt.
            // Documentation implies `puter.ai.chat(messages, ...)` or `puter.ai.chat(prompt, ...)`
            // To be safe and sophisticated, if puter supports it, we should send history.
            // But let's stick to the working prompt method to avoid breaking changes unless we know API.
            // We will just send the last message for now, or context string.

            const response = await puter.ai.chat(text, { model: model });

            removeLoading(loadingId);

            let replyText = "No response.";
            if (response && response.message && response.message.content && response.message.content.length > 0) {
                replyText = response.message.content[0].text;
            } else if (typeof response === 'string') {
                replyText = response;
            }

            // Add AI Message to UI and History
            addMessageToUI(replyText, 'ai');
            chatHistory.push({ role: 'ai', content: replyText });

            // Save updated history
            saveCurrentChat();

        } catch (error) {
            removeLoading(loadingId);
            addMessageToUI(`Error: ${error.message}`, 'ai');
            console.error(error);
        } finally {
            isProcessing = false;
        }
    }

    async function saveCurrentChat() {
        // Construct chat object
        // Title is first few chars of first user message
        const firstMsg = chatHistory.find(m => m.role === 'user');
        let title = 'New Chat';
        if (firstMsg) {
            title = firstMsg.content.substring(0, 30) + (firstMsg.content.length > 30 ? '...' : '');
        }

        const payload = {
            id: currentChatId,
            title: title,
            timestamp: Date.now(),
            messages: chatHistory
        };

        try {
            await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            // Refresh list silently to update titles if it was new
            loadChatList();
        } catch (e) {
            console.error("Failed to save chat", e);
        }
    }

    function escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function parseMarkdown(text) {
        let safeText = escapeHtml(text);
        const codeBlocks = [];

        safeText = safeText.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
            const language = lang || 'text';
            const blockHtml = `
                <div class="code-block">
                    <div class="code-header">
                        <span class="lang">${language}</span>
                        <button class="copy-btn"><i class="fa-regular fa-copy"></i> Copy</button>
                    </div>
                    <pre><code class="language-${language}">${code}</code></pre>
                </div>
            `;
            codeBlocks.push(blockHtml);
            return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
        });

        safeText = safeText.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
        safeText = safeText.replace(/\n/g, '<br>');
        safeText = safeText.replace(/__CODE_BLOCK_(\d+)__/g, (match, index) => {
            return codeBlocks[index];
        });

        return safeText;
    }

    function addMessageToUI(text, sender) {
        const div = document.createElement('div');
        div.className = `message ${sender}-message`;

        if (sender === 'user') {
            div.textContent = text;
        } else {
            div.innerHTML = parseMarkdown(text);
        }

        chatContainer.appendChild(div);
        scrollToBottom();
    }

    function addLoading() {
        const id = 'loading-' + Date.now();
        const div = document.createElement('div');
        div.className = `message ai-message loading`;
        div.id = id;
        div.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';
        chatContainer.appendChild(div);
        scrollToBottom();
        return id;
    }

    function removeLoading(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    function scrollToBottom() {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
});
