// client.js
if (!window.crypto || !window.crypto.getRandomValues) {
    window.crypto = { getRandomValues: arr => arr.map(() => Math.floor(Math.random() * 256)) };
}

const socket = io();
const messages = document.getElementById('messages');
const input = document.getElementById('input');
const sendBtn = document.getElementById('sendBtn');
const nudgeBtn = document.getElementById('nudgeBtn');
const keyBox = document.getElementById('keyBox');
const typingIndicator = document.getElementById('typingIndicator');
const countNum = document.getElementById('countNum');
const nameList = document.getElementById('nameList');
const identitySpan = document.getElementById('identity');

let sharedKey = null;
let sessionHash = '';
let typingTimer;
let myName = "";

// --- CRYPTO ---
function hexToUint8Array(hex) {
    const arr = new Uint8Array(hex.length / 2);
    for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.substr(i * 2, 2), 16);
    return arr;
}

function generateKey() {
    const k = nacl.randomBytes(32);
    return Array.from(k).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getHash(k) {
    const b = hexToUint8Array(k);
    const h = nacl.hash(b);
    return Array.from(h.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- INIT ---
function init() {
    const choice = prompt("HYRULE LINK OS\n\n[OK] = Paste Key\n[Cancel] = Generate New");
    if (!choice) {
        setupSession(generateKey());
        return;
    }

    const clean = choice.toLowerCase().replace(/[^0-9a-f]/g, '');
    if (clean.length !== 64) {
        alert("❌ Key must be 64 characters.");
        return init();
    }
    setupSession(clean);
}

function setupSession(k) {
    sharedKey = hexToUint8Array(k);
    sessionHash = getHash(k);
    socket.emit('join', sessionHash);

    keyBox.textContent = k;
    keyBox.onclick = () => {
        const ta = document.createElement("textarea");
        ta.value = k;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); alert("Copied!"); } catch (e) { }
        document.body.removeChild(ta);
    };
}

// --- SOCKET HANDLERS ---
socket.on('identity', name => { myName = name; identitySpan.textContent = "Identity: " + name; });

socket.on('room_update', data => {
    countNum.textContent = data.count;
    nameList.textContent = data.names.join(", ");
});

socket.on('system_alert', msg => addSystemMsg(msg.text));

socket.on('nudge_alert', sender => {
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    addSystemMsg(`🧚 ${sender} says: Hey Listen!`);
});

socket.on('history', hist => { hist.forEach(m => processIncoming(m)); });
socket.on('chat message', msg => processIncoming(msg));
socket.on('typing', user => {
    typingIndicator.textContent = user + ' is typing...';
    setTimeout(() => typingIndicator.textContent = '', 1500);
});
socket.on('reaction', handleReaction);

// --- MESSAGE PROCESSING ---
function processIncoming(msg) {
    try {
        const nonce = nacl.util.decodeBase64(msg.n);
        const box = nacl.util.decodeBase64(msg.d);
        const decrypted = nacl.secretbox.open(box, nonce, sharedKey);
        const type = (msg.user === myName) ? 'mine' : 'theirs';
        if (decrypted) addMessage(nacl.util.encodeUTF8(decrypted), type, msg.id, msg.user);
    } catch (e) { }
}

// --- UI LOGIC ---
function addMessage(text, type, id = null, senderName = "") {
    const div = document.createElement('div');
    div.className = 'msg ' + type;

    if (type === 'theirs' && senderName) {
        const span = document.createElement('span');
        span.className = 'sender-name';
        span.textContent = senderName;
        div.appendChild(span);
    }

    div.appendChild(document.createTextNode(text));

    // Reactions
    const bar = document.createElement('div');
    bar.className = 'reactions';
    ['❤️', '😂', '⚔️', '🛡️'].forEach(emoji => {
        const btn = document.createElement('span');
        btn.className = 'rxn-btn';
        btn.innerHTML = `${emoji} <span>0</span>`;
        btn.onclick = () => {
            const isActive = !btn.classList.contains('active');
            btn.classList.toggle('active');
            const countS = btn.querySelector('span');
            let c = parseInt(countS.textContent);
            c = isActive ? c + 1 : Math.max(0, c - 1);
            countS.textContent = c;
            if (c > 0) btn.classList.add('has-votes'); else btn.classList.remove('has-votes');
            socket.emit('reaction', { id, emoji, remove: !isActive });
        };
        bar.appendChild(btn);
    });
    div.appendChild(bar);

    if (id) div.dataset.id = id;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

function addSystemMsg(text) {
    const div = document.createElement('div');
    div.className = 'system-alert';
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

function sendMessage() {
    if (!input.value) return;

    if (input.value.startsWith('/')) {
        socket.emit('chat message', { text: input.value });
        input.value = '';
        return;
    }

    if (!sharedKey) return;

    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const box = nacl.secretbox(nacl.util.decodeUTF8(input.value), nonce, sharedKey);
    const id = Date.now().toString();

    socket.emit('chat message', {
        n: nacl.util.encodeBase64(nonce),
        d: nacl.util.encodeBase64(box),
        id
    });

    addMessage(input.value, 'mine', id);
    input.value = '';
    input.focus();
}

function handleReaction(data) {
    const div = document.querySelector(`[data-id="${data.id}"]`);
    if (!div) return;
    const btn = Array.from(div.querySelectorAll('.rxn-btn')).find(b => b.textContent.includes(data.emoji));
    if (btn) {
        const countS = btn.querySelector('span');
        let c = parseInt(countS.textContent);
        c = data.remove ? Math.max(0, c - 1) : c + 1;
        countS.textContent = c;
        if (c > 0) btn.classList.add('has-votes'); else btn.classList.remove('has-votes');
    }
}

// --- EVENT BINDINGS ---
sendBtn.onclick = sendMessage;
input.onkeypress = e => { if (e.key === 'Enter') sendMessage(); };
nudgeBtn.onclick = () => { socket.emit('nudge'); };
input.oninput = () => {
    socket.emit('typing', {});
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => { }, 1500);
};

// Initialize
setTimeout(init, 200);
