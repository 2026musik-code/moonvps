document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const chatContainer = document.getElementById('chat-container');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const attachBtn = document.getElementById('attach-btn');
    const imageInput = document.getElementById('image-input');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const imagePreview = document.getElementById('image-preview');
    const removeImageBtn = document.getElementById('remove-image-btn');

    // Model Selection Elements
    const modelMenuBtn = document.getElementById('model-menu-btn');
    const modelModal = document.getElementById('model-modal');
    const closeModelBtn = document.getElementById('close-model-btn');
    const modelListContainer = document.getElementById('model-list');
    const currentModelLabel = document.getElementById('current-model-label');

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
    let pendingImage = null; // Base64 data URI

    // Model State
    const models = [
        { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', type: 'chat' },
        { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', type: 'chat' },
        { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', type: 'chat' },
        { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', type: 'chat' },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', type: 'chat' },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', type: 'chat' },
        // Kimi Models
        { id: 'moonshotai/kimi-dev-72b', name: 'Kimi Dev 72B', type: 'chat' },
        { id: 'moonshotai/kimi-k2', name: 'Kimi K2', type: 'chat' },
        { id: 'moonshotai/kimi-k2-0905', name: 'Kimi K2 0905', type: 'chat' },
        { id: 'moonshotai/kimi-k2-thinking', name: 'Kimi K2 Thinking', type: 'chat' },
        { id: 'moonshotai/kimi-k2.5', name: 'Kimi K2.5', type: 'chat' },
        // Image Generation Models
        {
            id: 'gemini-2.5-flash-image-preview',
            name: 'Gemini 2.5 Flash (Img2Img)',
            type: 'image',
        }
    ];
    let selectedModel = 'claude-haiku-4-5';

    // Auth State
    let currentUserKey = localStorage.getItem('nexus_key');
    let isAdmin = false;

    // --- Initialization ---

    initModelSelector();

    if (currentUserKey) {
        // Attempt auto-login
        performLogin(currentUserKey);
    } else {
        // Show login
        loginOverlay.style.display = 'flex';
    }

    // --- Model Selection Logic ---
    function initModelSelector() {
        modelListContainer.innerHTML = '';
        models.forEach(model => {
            const div = document.createElement('div');
            div.className = `model-item ${model.id === selectedModel ? 'active' : ''}`;
            div.textContent = model.name;
            div.onclick = () => selectModel(model);
            modelListContainer.appendChild(div);
        });
        updateModelLabel();
    }

    function selectModel(model) {
        selectedModel = model.id;
        updateModelLabel();
        modelModal.classList.remove('active');

        // Update active class in list
        document.querySelectorAll('.model-item').forEach(el => {
            el.classList.toggle('active', el.textContent === model.name);
        });
    }

    function updateModelLabel() {
        const model = models.find(m => m.id === selectedModel);
        if (model) {
            currentModelLabel.textContent = model.name;
        }
    }

    modelMenuBtn.addEventListener('click', () => {
        modelModal.classList.add('active');
    });

    closeModelBtn.addEventListener('click', () => {
        modelModal.classList.remove('active');
    });

    // --- Image Logic ---
    attachBtn.addEventListener('click', () => {
        imageInput.click();
    });

    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                pendingImage = e.target.result;
                imagePreview.src = pendingImage;
                imagePreviewContainer.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });

    removeImageBtn.addEventListener('click', () => {
        pendingImage = null;
        imagePreviewContainer.style.display = 'none';
        imageInput.value = '';
    });

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

            // Create title span
            const titleSpan = document.createElement('span');
            titleSpan.innerHTML = `<i class="fa-regular fa-message"></i> ${chat.title || 'New Chat'}`;

            // Create delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-chat-btn';
            deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            deleteBtn.title = "Delete Chat";
            deleteBtn.onclick = (e) => {
                e.stopPropagation(); // Prevent chat load
                deleteChat(chat.id);
            };

            div.appendChild(titleSpan);
            div.appendChild(deleteBtn);
            div.onclick = () => loadChat(chat.id);
            chatHistoryContainer.appendChild(div);
        });
    }

    async function deleteChat(id) {
        if (!confirm("Are you sure you want to delete this chat?")) return;
        try {
            const res = await fetch(`/api/chat?id=${id}&key=${currentUserKey}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                loadChatList();
                if (currentChatId === id) startNewChat();
            } else {
                alert("Failed to delete chat.");
            }
        } catch (e) {
            console.error("Delete failed", e);
        }
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
                chatHistory.forEach(msg => addMessageToUI(msg.content, msg.role, msg.image));
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
        if ((!text && !pendingImage) || isProcessing) return;

        if (!isAdmin) {
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

        const sentImage = pendingImage;
        const modelId = selectedModel;
        const modelObj = models.find(m => m.id === modelId);

        // Unified Image Generation Logic
        if (modelObj && modelObj.type === 'image') {
            addMessageToUI(text, 'user', sentImage);
            chatHistory.push({ role: 'user', content: text, image: sentImage });

            userInput.value = ''; userInput.style.height = 'auto';
            const loadingId = addLoading();

            pendingImage = null;
            imagePreviewContainer.style.display = 'none';
            imageInput.value = '';

            saveCurrentChat();

            try {
                if (typeof puter === 'undefined') throw new Error("Puter.js not loaded.");

                let imageElement;
                const genOptions = { model: modelId, ...(modelObj.options || {}) };

                if (sentImage) {
                    // Image-to-Image / Variation
                    const matches = sentImage.match(/^data:(.+);base64,(.+)$/);
                    if (matches) {
                        genOptions.input_image = matches[2];
                        genOptions.input_image_mime_type = matches[1];
                        imageElement = await puter.ai.txt2img(text, genOptions);
                    } else throw new Error("Invalid image format");
                } else {
                    // Text-to-Image
                    imageElement = await puter.ai.txt2img(text, genOptions);
                }

                removeLoading(loadingId);

                if (imageElement && imageElement.src) {
                    let imageSrc = imageElement.src;
                    if (imageSrc.startsWith('blob:')) {
                        const blob = await fetch(imageSrc).then(r => r.blob());
                        const reader = new FileReader();
                        imageSrc = await new Promise((resolve) => {
                            reader.onload = () => resolve(reader.result);
                            reader.readAsDataURL(blob);
                        });
                    }
                    addMessageToUI("Generated Image:", 'ai', imageSrc);
                    chatHistory.push({ role: 'ai', content: "Generated Image", image: imageSrc });
                } else {
                    addMessageToUI("Failed to generate image.", 'ai');
                }
                saveCurrentChat();
                if (!isAdmin) await incrementUsage();

            } catch (error) {
                removeLoading(loadingId);
                addMessageToUI(`Error: ${error.message}`, 'ai');
            } finally { isProcessing = false; }
            return;
        }

        // Standard Chat Mode
        addMessageToUI(text, 'user', sentImage);
        chatHistory.push({ role: 'user', content: text, image: sentImage });

        userInput.value = ''; userInput.style.height = 'auto';
        pendingImage = null;
        imagePreviewContainer.style.display = 'none';
        imageInput.value = '';

        const loadingId = addLoading();
        saveCurrentChat();

        try {
            if (typeof puter === 'undefined') throw new Error("Puter.js not loaded.");
            let prompt = text;
            if (selectedRepo) prompt = `[Context: Repository ${selectedRepo}]\n${text}`;

            let response;
            if (sentImage) {
                response = await puter.ai.chat(prompt, sentImage, { model: modelId });
            } else {
                response = await puter.ai.chat(prompt, { model: modelId });
            }

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

            if (!isAdmin) await incrementUsage();

        } catch (error) {
            removeLoading(loadingId);
            addMessageToUI(`Error: ${error.message}`, 'ai');
        } finally { isProcessing = false; }
    }

    async function incrementUsage() {
        const useRes = await fetch('/api/user/usage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: currentUserKey })
        });
        const useData = await useRes.json();
        updateQuotaDisplay(useData.quota, useData.used);
    }

    async function saveCurrentChat() {
        const firstMsg = chatHistory.find(m => m.role === 'user');
        let title = 'New Chat';
        if (firstMsg) {
            title = firstMsg.content ? (firstMsg.content.substring(0, 30) + '...') : 'Image Chat';
        }
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
        // Use marked.js if available, otherwise fallback
        if (typeof marked !== 'undefined') {
            // Configure marked for code blocks to add our buttons (post-process or custom renderer)
            // Easier to post-process the HTML string
            let html = marked.parse(text);

            // Inject buttons into <pre><code> blocks
            // This is a simple regex replacement to wrap <pre>... in our structure
            // Regex match <pre><code class="...">...</code></pre>
            // We need to extract the language class

            // Standard marked output: <pre><code class="language-js">...</code></pre>

            html = html.replace(/<pre><code class="language-([^"]+)">([\s\S]*?)<\/code><\/pre>/g, (match, lang, code) => {
                return `
                <div class="code-block">
                    <div class="code-header">
                        <span class="lang">${lang}</span>
                        <div class="code-actions">
                            <button class="copy-btn"><i class="fa-regular fa-copy"></i> Copy</button>
                            <button class="save-btn"><i class="fa-brands fa-github"></i> Save</button>
                        </div>
                    </div>
                    <pre><code class="language-${lang}">${code}</code></pre>
                </div>`;
            });

            // Handle plain <pre><code> (no language)
            html = html.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, (match, code) => {
                return `
                <div class="code-block">
                    <div class="code-header">
                        <span class="lang">text</span>
                        <div class="code-actions">
                            <button class="copy-btn"><i class="fa-regular fa-copy"></i> Copy</button>
                            <button class="save-btn"><i class="fa-brands fa-github"></i> Save</button>
                        </div>
                    </div>
                    <pre><code>${code}</code></pre>
                </div>`;
            });

            return html;
        }

        // Fallback (should not happen if CDN loads)
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

    function addMessageToUI(text, sender, image = null) {
        const div = document.createElement('div');
        div.className = `message ${sender}-message`;

        let contentHtml = '';

        if (image) {
            contentHtml += `<img src="${image}" class="message-image" alt="Content">`;
        }

        if (sender === 'user') {
            contentHtml += escapeHtml(text).replace(/\n/g, '<br>');
        } else {
            contentHtml += parseMarkdown(text);
        }

        div.innerHTML = contentHtml;
        chatContainer.appendChild(div);
        scrollToBottom();
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
