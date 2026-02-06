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

    // GitHub Elements
    const githubAuthContainer = document.getElementById('github-auth-container');
    const githubRepoContainer = document.getElementById('github-repo-container');
    const githubConnectBtn = document.getElementById('github-connect-btn');
    const githubDisconnectBtn = document.getElementById('github-disconnect-btn');
    const repoSelect = document.getElementById('repo-select');
    const ghAvatar = document.getElementById('gh-avatar');
    const ghUsername = document.getElementById('gh-username');

    let isProcessing = false;
    let currentChatId = null;
    let chatHistory = [];
    let selectedRepo = null;

    // Initialize
    loadChatList();
    checkGithubStatus();

    if (!currentChatId) {
        startNewChat();
    }

    // Sidebar Logic
    function toggleSidebar() {
        sidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('active');
    }

    menuBtn.addEventListener('click', toggleSidebar);
    closeSidebarBtn.addEventListener('click', toggleSidebar);
    sidebarOverlay.addEventListener('click', toggleSidebar);

    newChatBtn.addEventListener('click', () => {
        startNewChat();
        if (window.innerWidth <= 768) {
            toggleSidebar();
        }
    });

    // GitHub Integration Logic
    githubConnectBtn.addEventListener('click', () => {
        window.location.href = '/api/auth/github/login';
    });

    githubDisconnectBtn.addEventListener('click', async () => {
        await fetch('/api/auth/github/logout', { method: 'POST' });
        checkGithubStatus();
    });

    repoSelect.addEventListener('change', (e) => {
        selectedRepo = e.target.value;
        // Optionally notify chat or update UI
    });

    async function checkGithubStatus() {
        try {
            const res = await fetch('/api/auth/github/status');
            const data = await res.json();

            if (data.connected) {
                githubAuthContainer.style.display = 'none';
                githubRepoContainer.style.display = 'block';
                ghUsername.textContent = data.user.login;
                ghAvatar.src = data.user.avatar_url;

                loadRepositories();
            } else {
                githubAuthContainer.style.display = 'block';
                githubRepoContainer.style.display = 'none';
            }
        } catch (e) {
            console.error('Failed to check GitHub status', e);
        }
    }

    async function loadRepositories() {
        try {
            repoSelect.innerHTML = '<option value="">Loading...</option>';
            const res = await fetch('/api/github/repos');
            const repos = await res.json();

            repoSelect.innerHTML = '<option value="">Select Repository...</option>';
            repos.forEach(repo => {
                const option = document.createElement('option');
                option.value = repo.full_name;
                option.textContent = repo.full_name;
                repoSelect.appendChild(option);
            });
        } catch (e) {
            repoSelect.innerHTML = '<option value="">Error loading repos</option>';
            console.error(e);
        }
    }

    function startNewChat() {
        currentChatId = crypto.randomUUID();
        chatHistory = [];
        selectedRepo = null;
        if (repoSelect) repoSelect.value = "";

        chatContainer.innerHTML = `
            <div class="welcome-message">
                <h1>Welcome to NEXUS</h1>
                <p>Advanced AI Interaction Interface</p>
            </div>
        `;
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

        try {
            const res = await fetch(`/api/chat?id=${id}`);
            if (!res.ok) throw new Error('Failed to load chat');
            const data = await res.json();

            chatHistory = data.messages || [];

            // Check if this chat had a repo selected (metadata support would be good here)
            // For now, assume fresh context or stored in messages?
            // Ideally backend stores metadata.repo
            if (data.repo) {
                selectedRepo = data.repo;
                repoSelect.value = data.repo;
            }

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

    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    sendBtn.addEventListener('click', sendMessage);

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
            });
        }
    });

    async function sendMessage() {
        const text = userInput.value.trim();
        if (!text || isProcessing) return;

        isProcessing = true;

        const welcome = document.querySelector('.welcome-message');
        if (welcome) welcome.style.display = 'none';

        addMessageToUI(text, 'user');
        chatHistory.push({ role: 'user', content: text });

        userInput.value = '';
        userInput.style.height = 'auto';

        const loadingId = addLoading();

        saveCurrentChat();

        try {
            const model = modelSelect.value;
            if (typeof puter === 'undefined') {
                throw new Error("Puter.js is not loaded.");
            }

            // If repo is selected, prepend context
            let prompt = text;
            if (selectedRepo) {
                prompt = `[Context: Repository ${selectedRepo}]\n${text}`;
            }

            const response = await puter.ai.chat(prompt, { model: model });

            removeLoading(loadingId);

            let replyText = "No response.";
            if (response && response.message && response.message.content && response.message.content.length > 0) {
                replyText = response.message.content[0].text;
            } else if (typeof response === 'string') {
                replyText = response;
            }

            addMessageToUI(replyText, 'ai');
            chatHistory.push({ role: 'ai', content: replyText });

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
        const firstMsg = chatHistory.find(m => m.role === 'user');
        let title = 'New Chat';
        if (firstMsg) {
            title = firstMsg.content.substring(0, 30) + (firstMsg.content.length > 30 ? '...' : '');
        }

        const payload = {
            id: currentChatId,
            title: title,
            timestamp: Date.now(),
            messages: chatHistory,
            repo: selectedRepo
        };

        try {
            await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
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
