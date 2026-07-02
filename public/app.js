// State variables
let activeTab = 'welcome'; // welcome, chat, history, profile
let currentChatId = null;
let currentMessages = [];
let chatHistory = [];
let repositoryFiles = [];
let hasApiKey = false;
let chatAttachments = []; // Temporary files attached to the current query

// UI Elements
const welcomeView = document.getElementById('welcome-view');
const chatView = document.getElementById('chat-view');
const historyView = document.getElementById('history-view');
const profileView = document.getElementById('profile-view');
const appHeader = document.getElementById('app-header');
const bottomNav = document.getElementById('bottom-nav');
const newChatFab = document.getElementById('new-chat-fab');
const apiKeyBanner = document.getElementById('api-key-banner');

const chatMessagesContainer = document.getElementById('chat-messages-container');
const chatInput = document.getElementById('chat-input');
const historyListContainer = document.getElementById('history-list-container');
const emptyHistoryState = document.getElementById('empty-state');
const historySearchInput = document.getElementById('history-search-input');
const documentListContainer = document.getElementById('document-list-container');
const repoStatsText = document.getElementById('repository-stats');
const apiKeyInput = document.getElementById('api-key-input');
const apiKeyStatusText = document.getElementById('api-key-status');
const uploadStatusText = document.getElementById('upload-status');
const attachmentsPreviewContainer = document.getElementById('attachments-preview-container');

// Init
document.addEventListener('DOMContentLoaded', () => {
    checkApiKeyStatus();
    loadChatHistory();
    loadRepositoryFiles();
    
    // Set welcome screen initially
    switchTab('welcome');
});

// Switch view tabs
function switchTab(tab) {
    activeTab = tab;
    
    // Hide all views
    welcomeView.classList.add('hidden');
    chatView.classList.add('hidden');
    historyView.classList.add('hidden');
    profileView.classList.add('hidden');
    
    // Show active view
    if (tab === 'welcome') {
        welcomeView.classList.remove('hidden');
        appHeader.classList.add('hidden');
        bottomNav.classList.add('hidden');
        newChatFab.classList.add('hidden');
        apiKeyBanner.classList.add('hidden');
    } else {
        appHeader.classList.remove('hidden');
        bottomNav.classList.remove('hidden');
        
        if (tab === 'chat') {
            chatView.classList.remove('hidden');
            newChatFab.classList.add('hidden');
            scrollToBottom();
            
            // Check if we need to initialize a chat session
            if (!currentChatId) {
                startNewChat(false); // starts a silent new chat session
            }
        } else if (tab === 'history') {
            historyView.classList.remove('hidden');
            newChatFab.classList.remove('hidden');
            loadChatHistory(); // reload from server
        } else if (tab === 'profile') {
            profileView.classList.remove('hidden');
            newChatFab.classList.add('hidden');
            loadRepositoryFiles(); // reload from server
        }
        
        // Update API Key banner visibility
        toggleApiKeyBanner();
    }
    
    // Update nav buttons styling
    updateNavButtons();
}

// Update nav active styles
function updateNavButtons() {
    const chatBtn = document.getElementById('nav-chat-btn');
    const histBtn = document.getElementById('nav-history-btn');
    const profBtn = document.getElementById('nav-profile-btn');
    
    const activeClasses = ['bg-secondary-container', 'text-on-secondary-container'];
    const inactiveClasses = ['text-on-surface-variant'];
    
    // Helper to reset and set styles
    const styleButton = (btn, isActive) => {
        if (!btn) return;
        if (isActive) {
            btn.classList.add(...activeClasses);
            btn.classList.remove(...inactiveClasses);
            // set material symbol to fill
            const icon = btn.querySelector('.material-symbols-outlined');
            if (icon) icon.style.fontVariationSettings = "'FILL' 1";
        } else {
            btn.classList.remove(...activeClasses);
            btn.classList.add(...inactiveClasses);
            const icon = btn.querySelector('.material-symbols-outlined');
            if (icon) icon.style.fontVariationSettings = "'FILL' 0";
        }
    };
    
    styleButton(chatBtn, activeTab === 'chat');
    styleButton(histBtn, activeTab === 'history');
    styleButton(profBtn, activeTab === 'profile');
}

// Onboarding Welcome Trigger
function handleStart() {
    // Dynamic loading effect on start button
    const btn = document.querySelector('#welcome-view button');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin" data-icon="progress_activity">progress_activity</span>';
    
    setTimeout(() => {
        btn.innerHTML = originalText;
        switchTab('chat');
    }, 800);
}

// API Key Handlers
async function checkApiKeyStatus() {
    try {
        const response = await fetch('/api/config');
        const data = await response.json();
        hasApiKey = data.hasApiKey;
        
        if (hasApiKey) {
            apiKeyStatusText.textContent = 'Configured (Active)';
            apiKeyStatusText.className = 'text-label-sm text-green-600 font-semibold';
            apiKeyInput.value = '••••••••••••••••';
        } else {
            apiKeyStatusText.textContent = 'Not Configured';
            apiKeyStatusText.className = 'text-label-sm text-red-500 font-semibold';
        }
        
        toggleApiKeyBanner();
    } catch (e) {
        console.error('Error fetching config status:', e);
    }
}

function toggleApiKeyBanner() {
    if (!hasApiKey && activeTab !== 'welcome') {
        apiKeyBanner.classList.remove('hidden');
    } else {
        apiKeyBanner.classList.add('hidden');
    }
}

async function saveApiKey() {
    const key = apiKeyInput.value.trim();
    if (!key || key === '••••••••••••••••') {
        alert('Please enter a valid Gemini API key.');
        return;
    }
    
    try {
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: key })
        });
        const data = await response.json();
        
        if (data.success) {
            alert('API key saved successfully!');
            hasApiKey = true;
            checkApiKeyStatus();
        } else {
            alert('Failed to save API key: ' + data.error);
        }
    } catch (err) {
        console.error('Error saving API Key:', err);
        alert('Error connecting to server.');
    }
}

// Repository / File Upload Handlers
async function loadRepositoryFiles() {
    try {
        const response = await fetch('/api/files');
        repositoryFiles = await response.json();
        renderDocumentList();
    } catch (err) {
        console.error('Error loading repository files:', err);
    }
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function renderDocumentList() {
    repoStatsText.textContent = `${repositoryFiles.length} file(s) in repository`;
    
    if (repositoryFiles.length === 0) {
        documentListContainer.innerHTML = `
            <div class="text-center py-6 text-label-sm text-outline">
                No files in the knowledge repository. Upload files (.txt, .docx, .xlsx, .pptx, .csv) to begin.
            </div>
        `;
        return;
    }
    
    documentListContainer.innerHTML = repositoryFiles.map(file => {
        const ext = file.filename.split('.').pop().toUpperCase();
        let iconName = 'description';
        let iconColor = 'text-primary';
        
        if (ext === 'XLSX' || ext === 'XLS' || ext === 'CSV') {
            iconName = 'table_view';
            iconColor = 'text-green-600';
        } else if (ext === 'PPTX') {
            iconName = 'slideshow';
            iconColor = 'text-orange-500';
        }
        
        return `
            <div class="flex justify-between items-center bg-background border border-outline-variant/60 p-sm rounded-lg hover:border-primary/40 transition-colors">
                <div class="flex items-center gap-sm overflow-hidden">
                    <span class="material-symbols-outlined ${iconColor}">${iconName}</span>
                    <div class="truncate">
                        <p class="text-label-md font-semibold text-on-surface truncate">${file.filename}</p>
                        <p class="text-label-sm text-secondary">${formatBytes(file.size)} &bull; ${new Date(file.uploadedAt).toLocaleDateString()}</p>
                    </div>
                </div>
                <button onclick="deleteFile('${file.filename}')" class="text-outline hover:text-red-500 p-1 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform" title="Delete file">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </div>
        `;
    }).join('');
}

// Trigger File Picker in Profile
function triggerProfileFilePicker() {
    document.getElementById('profile-file-picker').click();
}

async function handleProfileFileChange(event) {
    const files = event.target.files;
    if (files.length === 0) return;
    await uploadFiles(files);
}

// Trigger File Picker in Chat (Plus Icon)
function triggerFilePicker() {
    document.getElementById('chat-file-picker').click();
}

function renderAttachmentsPreview() {
    if (chatAttachments.length === 0) {
        attachmentsPreviewContainer.classList.add('hidden');
        attachmentsPreviewContainer.innerHTML = '';
        return;
    }
    
    attachmentsPreviewContainer.classList.remove('hidden');
    attachmentsPreviewContainer.innerHTML = chatAttachments.map((file, index) => `
        <div class="flex items-center gap-1 bg-surface px-2.5 py-1 rounded-full border border-outline-variant/60 text-label-sm shadow-sm">
            <span class="material-symbols-outlined text-[14px]">attachment</span>
            <span class="truncate max-w-[120px] font-semibold text-on-surface">${file.filename}</span>
            <button onclick="removeAttachment(${index})" class="text-outline hover:text-red-500 font-bold ml-1 flex items-center justify-center hover:scale-105 transition-transform" title="Remove attachment">
                <span class="material-symbols-outlined text-[14px]">close</span>
            </button>
        </div>
    `).join('');
}

function removeAttachment(index) {
    chatAttachments.splice(index, 1);
    renderAttachmentsPreview();
}

async function handleFileChange(event) {
    const files = event.target.files;
    if (files.length === 0) return;
    
    uploadStatusText.classList.remove('hidden');
    uploadStatusText.textContent = 'Parsing attachment...';
    
    try {
        for (const file of files) {
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch('/api/parse-temp', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) throw new Error('Failed to parse file: ' + file.name);
            
            const result = await response.json();
            console.log('Parsed temp file:', result);
            
            chatAttachments.push({
                filename: result.filename,
                text: result.text
            });
        }
        
        renderAttachmentsPreview();
    } catch (err) {
        console.error('Error parsing temp files:', err);
        alert('Failed to parse file. ' + err.message);
    } finally {
        uploadStatusText.classList.add('hidden');
        uploadStatusText.textContent = 'Uploading and parsing file...';
        event.target.value = '';
    }
}

async function uploadFiles(files) {
    const formData = new FormData();
    for (const file of files) {
        formData.append('files', file);
    }
    
    uploadStatusText.classList.remove('hidden');
    
    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error('Upload failed');
        
        const data = await response.json();
        console.log('Upload success:', data);
        
        // Reload files
        await loadRepositoryFiles();
    } catch (err) {
        console.error('Error uploading files:', err);
        alert('Failed to upload files. Make sure the server is running.');
    } finally {
        uploadStatusText.classList.add('hidden');
    }
}

async function deleteFile(filename) {
    if (!confirm(`Are you sure you want to remove "${filename}" from the Knowledge Repository?`)) return;
    
    try {
        const response = await fetch(`/api/files/${encodeURIComponent(filename)}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to delete');
        
        // Reload files
        await loadRepositoryFiles();
        
        // If in chat, append system deletion notification
        if (activeTab === 'chat') {
            appendSystemMessage(`Removed document <strong>${filename}</strong> from the Knowledge Repository.`);
        }
    } catch (err) {
        console.error('Error deleting file:', err);
        alert('Failed to delete file.');
    }
}

// Chat Flow Handlers
function startNewChat(switchToTabFlag = true) {
    currentChatId = 'chat_' + Date.now();
    currentMessages = [];
    chatMessagesContainer.innerHTML = '';
    
    // Add initial welcome message
    appendMessage('assistant', "Hello! I'm Nova, your AI Assistant. How can I help you today? Ask me any questions, or upload text, Word, PowerPoint, or Excel files, and I'll search them to provide answers.");
    
    if (switchToTabFlag) {
        switchTab('chat');
    }
}

function appendMessage(role, content, citations = []) {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isUser = role === 'user';
    const isSystem = role === 'system';
    
    const wrapper = document.createElement('div');
    wrapper.className = `flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-1 w-full`;
    
    let bubbleHtml = '';
    if (isUser) {
        let attachmentNotice = '';
        if (chatAttachments && chatAttachments.length > 0) {
            attachmentNotice = `<div class="mt-1 pt-1 border-t border-white/20 text-[11px] font-semibold opacity-90 flex flex-wrap gap-1">
                ${chatAttachments.map(att => `<span class="bg-white/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><span class="material-symbols-outlined text-[10px]" style="font-size:10px;">attachment</span> ${att.filename}</span>`).join('')}
            </div>`;
        }
        bubbleHtml = `
            <div class="user-bubble px-md py-sm max-w-[85%] text-body-md shadow-sm">
                ${escapeHTML(content)}
                ${attachmentNotice}
            </div>
            <span class="text-label-sm text-outline px-2">${timeStr}</span>
        `;
    } else if (isSystem) {
        bubbleHtml = `
            <div class="bg-surface-container border border-outline-variant/50 px-md py-sm max-w-[90%] text-label-sm rounded-xl text-on-surface-variant italic shadow-sm">
                ${content}
            </div>
        `;
    } else {
        // AI bubble
        // Convert Markdown formatting (simple bold/bullets/newlines) to HTML
        let formattedContent = formatAIResponse(content);
        
        let citationsHtml = '';
        if (citations && citations.length > 0) {
            citationsHtml = `
                <div class="mt-2 pt-2 border-t border-outline-variant/30 flex flex-wrap gap-1.5 items-center">
                    <span class="text-[10px] text-secondary font-bold uppercase tracking-wider">Sources:</span>
                    ${citations.map(source => `
                        <span class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary-fixed text-on-primary-fixed border border-primary/10">
                            <span class="material-symbols-outlined text-[10px]" style="font-size:10px;">description</span>
                            ${source}
                        </span>
                    `).join('')}
                </div>
            `;
        }
        
        bubbleHtml = `
            <div class="ai-bubble px-md py-sm max-w-[85%] text-body-md shadow-sm">
                <div>${formattedContent}</div>
                ${citationsHtml}
            </div>
            <span class="text-label-sm text-outline px-2">${timeStr}</span>
        `;
    }
    
    wrapper.innerHTML = bubbleHtml;
    chatMessagesContainer.appendChild(wrapper);
    scrollToBottom();
    
    // Save locally
    if (!isSystem) {
        currentMessages.push({ role, content, citations, timestamp: new Date() });
    }
}

function appendSystemMessage(content) {
    appendMessage('system', content);
}

function showTypingIndicator() {
    const wrapper = document.createElement('div');
    wrapper.id = 'typing-indicator';
    wrapper.className = 'flex items-center gap-2 px-2 py-2';
    wrapper.innerHTML = `
        <div class="ai-bubble px-4 py-3 flex gap-1 items-center">
            <div class="w-1.5 h-1.5 bg-outline rounded-full animate-bounce" style="animation-delay: 0ms"></div>
            <div class="w-1.5 h-1.5 bg-outline rounded-full animate-bounce" style="animation-delay: 150ms"></div>
            <div class="w-1.5 h-1.5 bg-outline rounded-full animate-bounce" style="animation-delay: 300ms"></div>
        </div>
    `;
    chatMessagesContainer.appendChild(wrapper);
    scrollToBottom();
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
}

// Send Message
async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;
    
    // Clear input
    chatInput.value = '';
    
    // Append user message (will render with active chatAttachments)
    appendMessage('user', text);
    
    // Capture and clear active attachments immediately for the next message
    const attachmentsToSend = [...chatAttachments];
    chatAttachments = [];
    renderAttachmentsPreview();
    
    // Check key
    if (!hasApiKey) {
        showTypingIndicator();
        setTimeout(() => {
            removeTypingIndicator();
            appendMessage('assistant', "I cannot generate answers because the Gemini API Key is missing. Please navigate to the **Profile** tab and enter a valid API key.");
        }, 800);
        return;
    }
    
    // Show typing
    showTypingIndicator();
    
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chatId: currentChatId,
                message: text,
                attachments: attachmentsToSend
            })
        });
        
        removeTypingIndicator();
        
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Server error');
        }
        
        const data = await response.json();
        
        // Append response
        appendMessage('assistant', data.response, data.citations);
        
        // Save session history to backend
        saveChatSession();
    } catch (err) {
        removeTypingIndicator();
        console.error('Error querying chat:', err);
        appendMessage('assistant', `Error: ${err.message}. Please check your connection and API key configuration in the Profile tab.`);
    }
}

function handleKeyDown(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

function sendQuickReply(text) {
    chatInput.value = text;
    sendMessage();
    
    // Hide replies after click as per design guidelines
    const repliesContainer = document.getElementById('quick-replies-container');
    if (repliesContainer) {
        repliesContainer.style.opacity = '0';
        repliesContainer.style.pointerEvents = 'none';
        repliesContainer.style.transition = 'opacity 0.3s ease-out';
        
        setTimeout(() => {
            repliesContainer.classList.add('hidden');
        }, 300);
    }
}

// Chat Session Persistence
async function saveChatSession() {
    // Generate a title if it's the first message
    let title = 'Document Search';
    const firstUserMessage = currentMessages.find(m => m.role === 'user');
    if (firstUserMessage) {
        title = firstUserMessage.content;
        if (title.length > 25) title = title.substring(0, 22) + '...';
    }
    
    try {
        const response = await fetch('/api/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: currentChatId,
                title: title,
                messages: currentMessages
            })
        });
        const data = await response.json();
        console.log('Saved chat session:', data);
    } catch (err) {
        console.error('Error saving chat session:', err);
    }
}

async function loadChatHistory() {
    try {
        const response = await fetch('/api/history');
        chatHistory = await response.json();
        renderHistoryList();
    } catch (err) {
        console.error('Error loading chat history:', err);
    }
}

function renderHistoryList() {
    const term = historySearchInput.value.toLowerCase().trim();
    
    // Filter chats
    const filteredChats = chatHistory.filter(chat => {
        if (!term) return true;
        const matchesTitle = chat.title.toLowerCase().includes(term);
        const matchesMessages = chat.messages.some(m => m.content.toLowerCase().includes(term));
        return matchesTitle || matchesMessages;
    });
    
    if (filteredChats.length === 0) {
        emptyHistoryState.classList.remove('hidden');
        emptyHistoryState.classList.add('flex');
        historyListContainer.innerHTML = '';
        return;
    }
    
    emptyHistoryState.classList.add('hidden');
    emptyHistoryState.classList.remove('flex');
    
    // Simple grouping by date (Today, Yesterday, Older)
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const isToday = (d) => d.toDateString() === today.toDateString();
    const isYesterday = (d) => d.toDateString() === yesterday.toDateString();
    
    let todayHtml = '';
    let yesterdayHtml = '';
    let olderHtml = '';
    
    filteredChats.forEach(chat => {
        const lastMod = new Date(chat.lastModified || chat.createdAt);
        const timeStr = lastMod.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const lastMsg = chat.messages.length > 0 ? chat.messages[chat.messages.length - 1].content : 'No messages';
        
        const cardHtml = `
            <div onclick="loadSavedChat('${chat.id}')" class="bg-surface-container-lowest p-md rounded-xl border border-outline-variant hover:bg-surface-container-low transition-all cursor-pointer group relative overflow-hidden shadow-sm">
                <div class="flex justify-between items-start mb-1 pr-6">
                    <h3 class="text-body-lg font-bold text-on-surface group-hover:text-primary transition-colors truncate">${escapeHTML(chat.title)}</h3>
                    <span class="text-label-sm font-label-sm text-outline whitespace-nowrap">${isToday(lastMod) ? timeStr : lastMod.toLocaleDateString()}</span>
                </div>
                <p class="text-body-md font-body-md text-on-surface-variant line-clamp-1 pr-12">${escapeHTML(lastMsg)}</p>
                <div class="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    <button onclick="event.stopPropagation(); deleteChatSession('${chat.id}')" class="text-outline hover:text-red-500 p-1 flex items-center justify-center" title="Delete conversation">
                        <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                    <span class="material-symbols-outlined text-primary">chevron_right</span>
                </div>
            </div>
        `;
        
        if (isToday(lastMod)) {
            todayHtml += cardHtml;
        } else if (isYesterday(lastMod)) {
            yesterdayHtml += cardHtml;
        } else {
            olderHtml += cardHtml;
        }
    });
    
    let fullHtml = '';
    if (todayHtml) {
        fullHtml += `<h2 class="text-label-sm font-label-sm text-outline uppercase tracking-wider mb-2">Today</h2><div class="space-y-md mb-xl">${todayHtml}</div>`;
    }
    if (yesterdayHtml) {
        fullHtml += `<h2 class="text-label-sm font-label-sm text-outline uppercase tracking-wider mb-2">Yesterday</h2><div class="space-y-md mb-xl">${yesterdayHtml}</div>`;
    }
    if (olderHtml) {
        fullHtml += `<h2 class="text-label-sm font-label-sm text-outline uppercase tracking-wider mb-2">Older</h2><div class="space-y-md mb-xl">${olderHtml}</div>`;
    }
    
    historyListContainer.innerHTML = fullHtml;
}

function filterHistory() {
    renderHistoryList();
}

async function loadSavedChat(chatId) {
    const chat = chatHistory.find(c => c.id === chatId);
    if (!chat) return;
    
    currentChatId = chatId;
    currentMessages = chat.messages || [];
    chatMessagesContainer.innerHTML = '';
    
    currentMessages.forEach(msg => {
        appendMessage(msg.role, msg.content, msg.citations);
        // pop last appended message from local array since appendMessage pushes it
        currentMessages.pop();
    });
    
    switchTab('chat');
}

async function deleteChatSession(chatId) {
    if (!confirm('Are you sure you want to delete this conversation?')) return;
    
    try {
        const response = await fetch(`/api/history/${chatId}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Delete failed');
        
        // If current active chat was deleted, reset chat view
        if (currentChatId === chatId) {
            currentChatId = null;
            currentMessages = [];
        }
        
        await loadChatHistory();
    } catch (err) {
        console.error('Error deleting chat session:', err);
        alert('Failed to delete conversation.');
    }
}

// Helpers
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

function scrollToBottom() {
    setTimeout(() => {
        chatView.scrollTop = chatView.scrollHeight;
    }, 50);
}

function formatAIResponse(text) {
    // Escape HTML first
    let escaped = escapeHTML(text);
    
    // Simple bold formatting: **text** -> <strong>text</strong>
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Bullet points: - text -> <li>text</li> inside a list
    const lines = escaped.split('\n');
    let inList = false;
    let formattedLines = [];
    
    for (let line of lines) {
        let trimmed = line.trim();
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            if (!inList) {
                formattedLines.push('<ul class="list-disc pl-5 space-y-1 my-2">');
                inList = true;
            }
            formattedLines.push(`<li>${trimmed.substring(2)}</li>`);
        } else {
            if (inList) {
                formattedLines.push('</ul>');
                inList = false;
            }
            formattedLines.push(line);
        }
    }
    if (inList) {
        formattedLines.push('</ul>');
    }
    
    // Rejoin and handle newlines (convert to <br/>)
    return formattedLines.join('\n').replace(/\n/g, '<br/>');
}
