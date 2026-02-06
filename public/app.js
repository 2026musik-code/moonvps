document.addEventListener('DOMContentLoaded', () => {
    const chatContainer = document.getElementById('chat-container');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const modelSelect = document.getElementById('model-select');

    let isProcessing = false;

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

            // Check if code block exists to prevent errors
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

        // Remove welcome message if exists
        const welcome = document.querySelector('.welcome-message');
        if (welcome) welcome.style.display = 'none';

        // Add User Message
        addMessage(text, 'user');
        userInput.value = '';
        userInput.style.height = 'auto';

        // Add Loading Indicator
        const loadingId = addLoading();

        try {
            const model = modelSelect.value;

            // Call Puter AI
            // Ensure puter is available
            if (typeof puter === 'undefined') {
                throw new Error("Puter.js is not loaded.");
            }

            const response = await puter.ai.chat(text, { model: model });

            removeLoading(loadingId);

            // Handle response structure based on the snippet provided
            // response.message.content[0].text
            let replyText = "No response.";
            if (response && response.message && response.message.content && response.message.content.length > 0) {
                replyText = response.message.content[0].text;
            } else if (typeof response === 'string') {
                replyText = response;
            }

            addMessage(replyText, 'ai');

        } catch (error) {
            removeLoading(loadingId);
            addMessage(`Error: ${error.message}`, 'ai');
            console.error(error);
        } finally {
            isProcessing = false;
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
        // 1. Escape HTML first to prevent XSS
        let safeText = escapeHtml(text);

        const codeBlocks = [];

        // 2. Extract Code Blocks and replace with placeholders
        // Format: ```language\ncode\n```
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

        // 3. Process Inline Code
        safeText = safeText.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

        // 4. Process Newlines (convert to <br>)
        safeText = safeText.replace(/\n/g, '<br>');

        // 5. Restore code blocks
        safeText = safeText.replace(/__CODE_BLOCK_(\d+)__/g, (match, index) => {
            return codeBlocks[index];
        });

        return safeText;
    }

    function addMessage(text, sender) {
        const div = document.createElement('div');
        div.className = `message ${sender}-message`;

        if (sender === 'user') {
            // User message: just text with newlines (escaped)
            div.textContent = text;
        } else {
            // AI message: parse markdown
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
