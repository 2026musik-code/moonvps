document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
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

    // Auth & Admin Elements
    const loginOverlay = document.getElementById('login-overlay');
    const loginKeyInput = document.getElementById('login-key');
    const loginBtn = document.getElementById('login-btn');
    const loginError = document.getElementById('login-error');

    const adminPanel = document.getElementById('admin-panel');
    const adminEntrySection = document.getElementById('admin-entry-section');
    const openAdminBtn = document.getElementById('open-admin-btn');
    const closeAdminBtn = document.getElementById('close-admin-btn');

    const adminNewPass = document.getElementById('admin-new-pass');
    const adminUpdatePassBtn = document.getElementById('admin-update-pass-btn');
    const newKeyName = document.getElementById('new-key-name');
    const newKeyQuota = document.getElementById('new-key-quota');
    const createKeyBtn = document.getElementById('create-key-btn');
    const keysTableBody = document.querySelector('#keys-table tbody');

    // Quota Display
    const userStatsSection = document.getElementById('user-stats-section');
    const displayKeyName = document.getElementById('display-key-name');
    const displayQuota = document.getElementById('display-quota');
    const quotaProgress = document.getElementById('quota-progress');

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
    let pendingCommitContent = null;

    // Auth State
    let currentUserKey = localStorage.getItem('nexus_key');
    let isAdmin = false;

    // --- Initialization ---

    if (currentUserKey) {
        // Attempt auto-login
        performLogin(currentUserKey);
    } else {
        // Show login
        loginOverlay.style.display = 'flex';
    }

    // --- Auth Logic ---

    loginBtn.addEventListener('click', () => {
        const key = loginKeyInput.value.trim();
        if (key) performLogin(key);
    });

    async function performLogin(key) {
        loginError.textContent = 'Authenticating...';
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key })
            });

            const data = await res.json();

            if (res.ok) {
                // Success
                currentUserKey = key;
                localStorage.setItem('nexus_key', key);
                loginOverlay.style.display = 'none';
                loginKeyInput.value = '';
                loginError.textContent = '';

                isAdmin = data.role === 'admin';

                if (isAdmin) {
                    adminEntrySection.style.display = 'block';
                    loadAdminKeys();
                } else {
                    adminEntrySection.style.display = 'none';
                    userStatsSection.style.display = 'block';
                    updateQuotaDisplay(data.quota, data.used);
                }

                // Initialize App
                loadChatList();
                checkGithubStatus();
                if (!currentChatId) startNewChat();

            } else {
                loginError.textContent = data.error || 'Authentication failed';
                if (currentUserKey) {
                    // Invalid stored key
                    localStorage.removeItem('nexus_key');
                    currentUserKey = null;
                    loginOverlay.style.display = 'flex';
                }
            }
        } catch (e) {
            loginError.textContent = 'Connection error';
            console.error(e);
        }
    }

    function updateQuotaDisplay(quota, used) {
        displayKeyName.textContent = currentUserKey;
        displayQuota.textContent = `${used}/${quota}`;
        const pct = Math.min((used / quota) * 100, 100);
        quotaProgress.style.width = `${pct}%`;

        if (used >= quota) {
            quotaProgress.style.backgroundColor = '#ff4444';
        } else {
            quotaProgress.style.backgroundColor = 'var(--accent-color)';
        }
    }

    // --- Admin Logic ---

    openAdminBtn.addEventListener('click', () => {
        adminPanel.style.display = 'flex';
        loadAdminKeys();
    });

    closeAdminBtn.addEventListener('click', () => {
        adminPanel.style.display = 'none';
    });

    async function loadAdminKeys() {
        try {
            const res = await fetch('/api/admin/keys', {
                headers: { 'Authorization': `Bearer ${currentUserKey}` }
            });
            if (res.ok) {
                const data = await res.json();
                renderKeysTable(data.keys);
            }
        } catch (e) {
            console.error("Failed to load keys", e);
        }
    }

    function renderKeysTable(keys) {
        keysTableBody.innerHTML = '';
        // Convert obj to array if needed, but endpoint returns list
        // Backend should return list of objects {key, quota, used}
        keys.forEach(k => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${k.key}</td>
                <td>${k.used} / ${k.quota}</td>
                <td>
                    <button class="key-action-btn" onclick="resetKeyUsage('${k.key}')">Reset</button>
                    <button class="key-action-btn delete" onclick="deleteKey('${k.key}')">Delete</button>
                </td>
            `;
            keysTableBody.appendChild(tr);
        });
    }

    // Global exposure for onclick handlers in table
    window.deleteKey = async (key) => {
        if (!confirm(`Delete key ${key}?`)) return;
        await fetch('/api/admin/keys', {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${currentUserKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ key })
        });
        loadAdminKeys();
    };

    window.resetKeyUsage = async (key) => {
        // To reset usage, we can update the key with used=0
        // Or specific endpoint. Let's use update flow.
        // We need current quota first? Let's just assume we can send partial update or create logic.
        // Simplified: delete and recreate or add update endpoint.
        // Backend handles update if key exists.
        // We need to ask for new quota or keep existing?
        // Let's implement a simple "Extend" or just create with same name updates it.
        const newQuota = prompt("Enter new quota:", "100");
        if (!newQuota) return;

        await fetch('/api/admin/keys', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentUserKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ key, quota: parseInt(newQuota), used: 0 })
        });
        loadAdminKeys();
    };

    createKeyBtn.addEventListener('click', async () => {
        const key = newKeyName.value.trim();
        const quota = parseInt(newKeyQuota.value);
        if (!key || !quota) return alert("Invalid input");

        const res = await fetch('/api/admin/keys', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentUserKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ key, quota })
        });

        if (res.ok) {
            newKeyName.value = '';
            newKeyQuota.value = '';
            loadAdminKeys();
        } else {
            const err = await res.json();
            alert(err.error);
        }
    });

    adminUpdatePassBtn.addEventListener('click', async () => {
        const newPass = adminNewPass.value.trim();
        if (!newPass) return;

        const res = await fetch('/api/admin/change-password', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentUserKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password: newPass })
        });

        if (res.ok) {
            alert("Password updated. Please login again.");
            localStorage.removeItem('nexus_key');
            location.reload();
        } else {
            alert("Failed to update password");
        }
    });

    // --- Existing App Logic (Sidebar, Chat, GitHub) ---

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

    githubSaveBtn.addEventListener('click', async () => {
        const username = ghUsernameInput.value.trim();
        const token = ghTokenInput.value.trim();
        if (!username || !token) { alert('Please enter both'); return; }
        try {
            githubSaveBtn.textContent = 'Verifying...';
            const res = await fetch('https://api.github.com/user', {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' }
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
            const res = await fetch(`https://api.github.com/user/repos?sort=updated&per_page=100`, {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' }
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
        }
    }

    // --- Modal Logic ---
    function openCommitModal(content, detectedPath = '') {
        if (!selectedRepo) { alert('Select repository first.'); return; }
        pendingCommitContent = content;
        commitRepoInput.value = selectedRepo;
        commitPathInput.value = detectedPath;
        commitPreview.textContent = content.substring(0, 500) + '...';
        commitModal.classList.add('active');
    }
    function closeCommitModal() { commitModal.classList.remove('active'); pendingCommitContent = null; }
    closeModalBtn.addEventListener('click', closeCommitModal);
    commitCancelBtn.addEventListener('click', closeCommitModal);

    commitConfirmBtn.addEventListener('click', async () => {
        const path = commitPathInput.value.trim();
        const message = commitMessageInput.value.trim();
        const token = localStorage.getItem('gh_token');
        if (!path || !message || !token) return;
        try {
            commitConfirmBtn.textContent = 'Committing...';
            commitConfirmBtn.disabled = true;
            let sha = null;
            const checkRes = await fetch(`https://api.github.com/repos/${selectedRepo}/contents/${path}`, {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' }
            });
            if (checkRes.ok) {
                const data = await checkRes.json();
                sha = data.sha;
            }
            const contentEncoded = btoa(unescape(encodeURIComponent(pendingCommitContent)));
            const payload = { message: message, content: contentEncoded };
            if (sha) payload.sha = sha;
            const updateRes = await fetch(`https://api.github.com/repos/${selectedRepo}/contents/${path}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github+json' },
                body: JSON.stringify(payload)
            });
            if (updateRes.ok) {
                alert('Saved!'); closeCommitModal();
            } else {
                alert('Error saving file');
            }
        } catch (e) { alert('Failed'); }
        finally { commitConfirmBtn.textContent = 'Commit Changes'; commitConfirmBtn.disabled = false; }
    });

    // --- Chat Logic ---

    function startNewChat() {
        currentChatId = crypto.randomUUID();
        chatHistory = [];
        selectedRepo = null;
        if (repoSelect) repoSelect.value = "";
        chatContainer.innerHTML = `<div class="welcome-message"><h1>Welcome to NEXUS</h1><p>Advanced AI Interaction Interface</p></div>`;
        document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
    }

    async function loadChatList() {
        // This requires auth now
        try {
            const res = await fetch(`/api/chats?key=${currentUserKey}`);
            if (res.ok) {
                const data = await res.json();
                renderChatList(data.chats || []);
            }
        } catch (err) { console.error(err); }
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
            const res = await fetch(`/api/chat?id=${id}&key=${currentUserKey}`);
            if (res.ok) {
                const data = await res.json();
                chatHistory = data.messages || [];
                if (data.repo) { selectedRepo = data.repo; repoSelect.value = data.repo; }
                chatContainer.innerHTML = '';
                chatHistory.forEach(msg => addMessageToUI(msg.content, msg.role));
                if (window.innerWidth <= 768) toggleSidebar();
            }
        } catch (err) { console.error(err); }
    }

    userInput.addEventListener('input', function() {
        this.style.height = 'auto'; this.style.height = (this.scrollHeight) + 'px';
        if(this.value === '') this.style.height = 'auto';
    });

    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault(); sendMessage();
        }
    });

    sendBtn.addEventListener('click', sendMessage);

    chatContainer.addEventListener('click', (e) => {
        if (e.target.closest('.copy-btn')) {
            const btn = e.target.closest('.copy-btn');
            const code = btn.closest('.code-block').querySelector('code').innerText;
            navigator.clipboard.writeText(code).then(() => {
                const old = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-check"></i>';
                setTimeout(() => btn.innerHTML = old, 2000);
            });
        }
        if (e.target.closest('.save-btn')) {
            const code = e.target.closest('.code-block').querySelector('code').innerText;
            openCommitModal(code);
        }
    });

    async function sendMessage() {
        const text = userInput.value.trim();
        if (!text || isProcessing) return;

        // Check Quota Logic
        if (!isAdmin) {
            // Optimistic check based on UI, real check happens on backend usage increment
            // Actually, we should check with backend before calling expensive AI?
            // But we do backend increment after.
            // Better: Call an endpoint to authorize the chat.
            // Simplified: proceed, backend will track. If quota 0, user should have been blocked visually?
            // Let's check status again before sending.
            try {
                const statusRes = await fetch('/api/user/status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: currentUserKey })
                });
                const status = await statusRes.json();
                if (status.used >= status.quota) {
                    addMessageToUI("Error: Chat quota exceeded. Please contact admin.", 'ai');
                    return;
                }
            } catch(e) { console.error(e); }
        }

        isProcessing = true;
        const welcome = document.querySelector('.welcome-message');
        if (welcome) welcome.style.display = 'none';

        addMessageToUI(text, 'user');
        chatHistory.push({ role: 'user', content: text });
        userInput.value = ''; userInput.style.height = 'auto';
        const loadingId = addLoading();
        saveCurrentChat();

        try {
            const model = modelSelect.value;
            if (typeof puter === 'undefined') throw new Error("Puter.js not loaded.");
            let prompt = text;
            if (selectedRepo) prompt = `[Context: Repository ${selectedRepo}]\n${text}`;

            const response = await puter.ai.chat(prompt, { model: model });
            removeLoading(loadingId);

            let replyText = "No response.";
            if (response && typeof response === 'object') {
                if (response.message && response.message.content && Array.isArray(response.message.content)) {
                     if (response.message.content.length > 0) replyText = response.message.content[0].text;
                } else if (response.text) { replyText = response.text;
                } else { replyText = response.toString(); if (replyText === '[object Object]') replyText = JSON.stringify(response, null, 2); }
            } else if (typeof response === 'string') replyText = response;
            if (typeof replyText !== 'string') replyText = String(replyText);

            addMessageToUI(replyText, 'ai');
            chatHistory.push({ role: 'ai', content: replyText });
            saveCurrentChat();

            // Increment Usage
            if (!isAdmin) {
                const useRes = await fetch('/api/user/usage', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: currentUserKey })
                });
                const useData = await useRes.json();
                updateQuotaDisplay(useData.quota, useData.used);
            }

        } catch (error) {
            removeLoading(loadingId);
            addMessageToUI(`Error: ${error.message}`, 'ai');
        } finally { isProcessing = false; }
    }

    async function saveCurrentChat() {
        const firstMsg = chatHistory.find(m => m.role === 'user');
        let title = 'New Chat';
        if (firstMsg) title = firstMsg.content.substring(0, 30) + '...';
        const payload = { id: currentChatId, title: title, timestamp: Date.now(), messages: chatHistory, repo: selectedRepo, key: currentUserKey };
        try {
            await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            loadChatList();
        } catch (e) { console.error("Failed to save chat", e); }
    }

    function escapeHtml(text) {
        if (text == null) return "";
        return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    function parseMarkdown(text) {
        let safeText = escapeHtml(text);
        const codeBlocks = [];
        safeText = safeText.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
            const language = lang || 'text';
            const blockHtml = `<div class="code-block"><div class="code-header"><span class="lang">${language}</span><div class="code-actions"><button class="copy-btn"><i class="fa-regular fa-copy"></i> Copy</button><button class="save-btn"><i class="fa-brands fa-github"></i> Save</button></div></div><pre><code class="language-${language}">${code}</code></pre></div>`;
            codeBlocks.push(blockHtml);
            return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
        });
        safeText = safeText.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>').replace(/\n/g, '<br>').replace(/__CODE_BLOCK_(\d+)__/g, (m, i) => codeBlocks[i]);
        return safeText;
    }

    function addMessageToUI(text, sender) {
        const div = document.createElement('div');
        div.className = `message ${sender}-message`;
        if (sender === 'user') div.textContent = text; else div.innerHTML = parseMarkdown(text);
        chatContainer.appendChild(div); scrollToBottom();
    }

    function addLoading() {
        const id = 'loading-' + Date.now();
        const div = document.createElement('div'); div.className = `message ai-message loading`; div.id = id;
        div.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';
        chatContainer.appendChild(div); scrollToBottom(); return id;
    }

    function removeLoading(id) { const el = document.getElementById(id); if (el) el.remove(); }
    function scrollToBottom() { chatContainer.scrollTop = chatContainer.scrollHeight; }
});
