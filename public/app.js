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

    function addMessage(text, sender) {
        const div = document.createElement('div');
        div.className = `message ${sender}-message`;

        // Simple markdown parsing for code blocks could be added here,
        // but for now we just treat as text with newlines
        div.innerHTML = text.replace(/\n/g, '<br>');

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
