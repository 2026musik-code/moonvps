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
    const githubLoginForm = document.getElementById('github-login-form');
    const githubRepoContainer = document.getElementById('github-repo-container');
    const ghUsernameInput = document.getElementById('gh-username-input');
    const ghTokenInput = document.getElementById('gh-token-input');
    const githubSaveBtn = document.getElementById('github-save-btn');
    const githubDisconnectBtn = document.getElementById('github-disconnect-btn');
    const repoSelect = document.getElementById('repo-select');
    const ghAvatar = document.getElementById('gh-avatar');
    const ghUsernameDisplay = document.getElementById('gh-username-display');

    // Commit Modal Elements
    const commitModal = document.getElementById('commit-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const commitCancelBtn = document.getElementById('commit-cancel-btn');
    const commitConfirmBtn = document.getElementById('commit-confirm-btn');
    const commitRepoInput = document.getElementById('commit-repo');
    const commitPathInput = document.getElementById('commit-path');
    const commitMessageInput = document.getElementById('commit-message');
    const commitPreview = document.getElementById('commit-preview');

    let isProcessing = false;
    let currentChatId = null;
    let chatHistory = [];
    let selectedRepo = null;
    let pendingCommitContent = null; // Content to save

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

    // GitHub Integration Logic (Client-Side)
    githubSaveBtn.addEventListener('click', async () => {
        const username = ghUsernameInput.value.trim();
        const token = ghTokenInput.value.trim();

        if (!username || !token) {
            alert('Please enter both username and token');
            return;
        }

        try {
            githubSaveBtn.textContent = 'Verifying...';
            const res = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github+json'
                }
            });

            if (res.ok) {
                const user = await res.json();
                localStorage.setItem('gh_username', user.login);
                localStorage.setItem('gh_token', token);
                localStorage.setItem('gh_avatar', user.avatar_url);

                checkGithubStatus();
                githubSaveBtn.textContent = 'Connect';
            } else {
                alert('Invalid Token or Username');
                githubSaveBtn.textContent = 'Connect';
            }
        } catch (e) {
            console.error(e);
            alert('Connection failed');
            githubSaveBtn.textContent = 'Connect';
        }
    });

    githubDisconnectBtn.addEventListener('click', () => {
        localStorage.removeItem('gh_username');
        localStorage.removeItem('gh_token');
        localStorage.removeItem('gh_avatar');
        checkGithubStatus();
    });

    repoSelect.addEventListener('change', (e) => {
        selectedRepo = e.target.value;
    });

    function checkGithubStatus() {
        const username = localStorage.getItem('gh_username');
        const token = localStorage.getItem('gh_token');
        const avatar = localStorage.getItem('gh_avatar');

        if (username && token) {
            githubLoginForm.style.display = 'none';
            githubRepoContainer.style.display = 'block';
            ghUsernameDisplay.textContent = username;
            ghAvatar.src = avatar || '';

            loadRepositories(username, token);
        } else {
            githubLoginForm.style.display = 'block';
            githubRepoContainer.style.display = 'none';
        }
    }

    async function loadRepositories(username, token) {
        try {
            repoSelect.innerHTML = '<option value="">Loading...</option>';
            // Fetch repos
            const res = await fetch(`https://api.github.com/user/repos?sort=updated&per_page=100`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github+json'
                }
            });

            if (res.ok) {
                const repos = await res.json();
                repoSelect.innerHTML = '<option value="">Select Repository...</option>';
                repos.forEach(repo => {
                    const option = document.createElement('option');
                    option.value = repo.full_name;
                    option.textContent = repo.full_name;
                    repoSelect.appendChild(option);
                });
            } else {
                repoSelect.innerHTML = '<option value="">Error fetching repos</option>';
            }
        } catch (e) {
            repoSelect.innerHTML = '<option value="">Error fetching repos</option>';
            console.error(e);
        }
    }

    // Modal Logic
    function openCommitModal(content, detectedPath = '') {
        if (!selectedRepo) {
            alert('Please select a repository in the sidebar first.');
            return;
        }

        pendingCommitContent = content;
        commitRepoInput.value = selectedRepo;
        commitPathInput.value = detectedPath;
        commitPreview.textContent = content.substring(0, 500) + (content.length > 500 ? '...' : '');
        commitModal.classList.add('active');
    }

    function closeCommitModal() {
        commitModal.classList.remove('active');
        pendingCommitContent = null;
    }

    closeModalBtn.addEventListener('click', closeCommitModal);
    commitCancelBtn.addEventListener('click', closeCommitModal);

    commitConfirmBtn.addEventListener('click', async () => {
        const path = commitPathInput.value.trim();
        const message = commitMessageInput.value.trim();
        const token = localStorage.getItem('gh_token');

        if (!path || !message) {
            alert('Please provide a file path and commit message.');
            return;
        }

        if (!token) {
            alert('GitHub token missing. Please reconnect.');
            return;
        }

        try {
            commitConfirmBtn.textContent = 'Committing...';
            commitConfirmBtn.disabled = true;

            // 1. Check if file exists to get SHA (for update)
            let sha = null;
            const checkRes = await fetch(`https://api.github.com/repos/${selectedRepo}/contents/${path}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github+json'
                }
            });

            if (checkRes.ok) {
                const data = await checkRes.json();
                sha = data.sha;
            }

            // 2. Create/Update File
            // GitHub API requires Base64 content
            // NOTE: simple btoa handles ASCII. utf-8 needs trick.
            const contentEncoded = btoa(unescape(encodeURIComponent(pendingCommitContent)));

            const payload = {
                message: message,
                content: contentEncoded
            };
            if (sha) payload.sha = sha;

            const updateRes = await fetch(`https://api.github.com/repos/${selectedRepo}/contents/${path}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github+json'
                },
                body: JSON.stringify(payload)
            });

            if (updateRes.ok) {
                alert('File saved successfully!');
                closeCommitModal();
            } else {
                const err = await updateRes.json();
                alert(`Error saving file: ${err.message}`);
            }

        } catch (e) {
            console.error(e);
            alert('Failed to commit changes.');
        } finally {
            commitConfirmBtn.textContent = 'Commit Changes';
            commitConfirmBtn.disabled = false;
        }
    });

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

    // Send message on Ctrl+Enter
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            sendMessage();
        }
    });

    sendBtn.addEventListener('click', sendMessage);

    // Event Delegation for Copy and Save buttons
    chatContainer.addEventListener('click', (e) => {
        // Copy Button
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

        // Save Button
        if (e.target.closest('.save-btn')) {
            const btn = e.target.closest('.save-btn');
            const codeBlock = btn.closest('.code-block');
            if (!codeBlock) return;
            const codeElement = codeBlock.querySelector('code');
            if (!codeElement) return;

            const code = codeElement.innerText;
            // Attempt to detect filename from header if stored in data-attr or regex?
            // Current parser doesn't extract filename reliably yet,
            // but let's see if we can improve parser or just let user input it.
            // For now, let user input it in modal.
            openCommitModal(code);
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

            let prompt = text;
            if (selectedRepo) {
                prompt = `[Context: Repository ${selectedRepo}]\n${text}`;
            }

            const response = await puter.ai.chat(prompt, { model: model });

            removeLoading(loadingId);

            let replyText = "No response.";

            if (response && typeof response === 'object') {
                if (response.message && response.message.content && Array.isArray(response.message.content)) {
                     if (response.message.content.length > 0) {
                         replyText = response.message.content[0].text;
                     }
                } else if (response.text) {
                     replyText = response.text;
                } else {
                     replyText = response.toString();
                     if (replyText === '[object Object]') {
                         replyText = JSON.stringify(response, null, 2);
                     }
                }
            } else if (typeof response === 'string') {
                replyText = response;
            }

            if (typeof replyText !== 'string') {
                replyText = String(replyText);
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
        if (text === undefined || text === null) return "";
        return String(text)
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
                        <div class="code-actions">
                            <button class="copy-btn"><i class="fa-regular fa-copy"></i> Copy</button>
                            <button class="save-btn"><i class="fa-brands fa-github"></i> Save</button>
                        </div>
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
