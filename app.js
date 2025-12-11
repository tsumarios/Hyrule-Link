const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- Offline Library Check ---
['nacl.min.js', 'nacl-util.min.js', 'socket.io.min.js'].forEach(f => {
    if (!fs.existsSync('./public/' + f)) console.log(`⚠️  Missing library: ${f}`);
});

app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(__dirname + '/public/index.html'));

// --- STATE ---
let users = {};
let messageHistory = [];

// RPS State: Stores the waiting player { socketId, name, move }
let rpsPending = {}; // Keyed by "room_hash" so multiple rooms can play separately

const CHARACTERS = [
    "Link", "Zelda", "Ganondorf", "Impa", "Sidon",
    "Mipha", "Daruk", "Revali", "Urbosa", "Hestu",
    "Kass", "Riju", "Yunobo", "Teba", "Purah", "Robbie"
];

const TRIVIA_DB = [
    "What is the name of Link's horse? (Epona)",
    "Which Timeline does Breath of the Wild take place in? (It's complicated...)",
    "What is the currency of Hyrule? (Rupees)",
    "Who is the Goron Champion? (Daruk)",
    "How many Korok seeds are in BOTW? (900)",
    "Which village is Impa located in? (Kakariko)",
    "What is the name of the Zora princess? (Mipha)",
    "Which champion pilots the Divine Beast Vah Medoh? (Revali)",
    "Who is the leader of the Gerudo? (Riju)",
    "What is the main function of Purah in Hyrule? (Research & Ancient Technology)",
    "Which character is known for playing the accordion? (Kass)",
    "Who is the loyal companion of Link that can talk? (Navi – optional BOTW references)",
    "Which Divine Beast is associated with Daruk? (Vah Rudania)",
    "Who teaches Link ancient techniques in the game? (Robbie)",
    "Which Korok seeds are needed to upgrade all armor? (900 – full set)"
];

// Helper: Update room counts
async function updateRoom(roomKey) {
    if (!roomKey) return;
    const sockets = await io.in(roomKey).fetchSockets();
    const names = sockets.map(s => users[s.id] || "Unknown");
    io.to(roomKey).emit('room_update', { count: names.length, names: names });
}

io.on('connection', socket => {
    const charName = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
    users[socket.id] = charName;
    socket.sessionKey = null;

    socket.emit('identity', charName);

    socket.on('join', keyHash => {
        if (socket.sessionKey) socket.leave(socket.sessionKey);
        socket.sessionKey = keyHash;
        socket.join(keyHash);

        const roomHistory = messageHistory.filter(m => m.keyHash === keyHash);
        socket.emit('history', roomHistory);
        updateRoom(keyHash);
    });

    socket.on('chat message', msg => {
        if (!socket.sessionKey) return;

        const sender = users[socket.id];
        const room = socket.sessionKey;

        // --- COMMANDS ---
        if (msg.text && msg.text.startsWith('/')) {
            let sysText = "";

            // 1. RPS LOGIC (The Fix)
            if (msg.text.startsWith('/rps')) {
                const move = msg.text.split(' ')[1]?.toLowerCase();
                const validMoves = ['rock', 'paper', 'scissors'];

                if (!validMoves.includes(move)) {
                    // Invalid move alert (Private)
                    socket.emit('system_alert', { text: "⚠️ Usage: /rps rock, /rps paper, or /rps scissors" });
                    return;
                }

                // Check if someone is waiting in this room
                if (rpsPending[room]) {
                    // RESOLVE GAME
                    const p1 = rpsPending[room];
                    const p2 = { name: sender, move: move };

                    let result = "DRAW!";
                    if (p1.move === p2.move) result = "It's a DRAW!";
                    else if (
                        (p1.move === 'rock' && p2.move === 'scissors') ||
                        (p1.move === 'paper' && p2.move === 'rock') ||
                        (p1.move === 'scissors' && p2.move === 'paper')
                    ) {
                        result = `${p1.name} WINS!`;
                    } else {
                        result = `${p2.name} WINS!`;
                    }

                    sysText = `⚔️ RPS BATTLE:\n${p1.name} (${p1.move.toUpperCase()}) vs ${p2.name} (${p2.move.toUpperCase()})\n🏆 ${result}`;

                    // Clear pending state
                    delete rpsPending[room];
                } else {
                    // START NEW GAME (WAITING)
                    rpsPending[room] = { id: socket.id, name: sender, move: move };
                    sysText = `⚔️ ${sender} is waiting for a challenger!\n(Type /rps [move] to fight)`;
                }
            }

            // 2. Dice Roll
            else if (msg.text.startsWith('/roll')) {
                const roll = Math.floor(Math.random() * 20) + 1;
                sysText = `🎲 ${sender} rolled a ${roll}!`;
            }
            // 3. Coin Flip
            else if (msg.text.startsWith('/flip')) {
                const side = Math.random() > 0.5 ? "Heads" : "Tails";
                sysText = `🪙 ${sender} flipped a coin: ${side}!`;
            }
            // 4. Trivia
            else if (msg.text.startsWith('/trivia')) {
                const q = TRIVIA_DB[Math.floor(Math.random() * TRIVIA_DB.length)];
                sysText = `🧠 TRIVIA: ${q}`;
            }

            if (sysText) {
                io.to(room).emit('system_alert', { text: sysText, keyHash: room });
                return;
            }
        }

        // Normal Message
        const entry = { ...msg, keyHash: room, user: sender };
        messageHistory.push(entry);
        if (messageHistory.length > 50) messageHistory.shift();

        socket.to(room).emit('chat message', { ...msg, user: sender });
    });

    socket.on('nudge', () => {
        if (!socket.sessionKey) return;
        socket.to(socket.sessionKey).emit('nudge_alert', users[socket.id]);
    });

    socket.on('typing', () => {
        if (!socket.sessionKey) return;
        socket.to(socket.sessionKey).emit('typing', users[socket.id]);
    });

    socket.on('reaction', data => {
        if (!socket.sessionKey) return;
        socket.to(socket.sessionKey).emit('reaction', data);
    });

    socket.on('disconnect', () => {
        const room = socket.sessionKey;
        // If the disconnected user had a pending game, clear it
        if (rpsPending[room] && rpsPending[room].id === socket.id) {
            delete rpsPending[room];
        }
        delete users[socket.id];
        if (room) updateRoom(room);
    });
});

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return 'localhost';
}

server.listen(3000, '0.0.0.0', () => console.log(`🔹 Sheikah Slate Active: http://${getLocalIP()}:3000`));
