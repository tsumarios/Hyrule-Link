# 🛡️ Hyrule Link — Offline Encrypted LAN Chat

Hyrule Link is an offline, LAN-based chat application with a Zelda-themed mobile-first UI. It enables real-time messaging and mini-games in airplane mode, camping trips, or any environment without internet.
It provides end-to-end encrypted message exchange, room isolation via a shared key, and a mobile-first interface inspired by the Sheikah Slate.

The server acts only as a relay for encrypted message payloads and does not have access to plaintext chat content.

---

## ✨ Features

* **Offline operation** over a Wi-Fi hotspot or LAN
* **End-to-end encryption for message contents** using TweetNaCl (XSalsa20-Poly1305)
* **Room isolation** via a hashed session key
* **Mobile-first UI** styled after Breath of the Wild / Tears of the Kingdom
* **Real-time messaging** with reactions and typing indicators
* **Mini-games and utilities**

  * Rock–Paper–Scissors (challenge/response model)
  * Dice roll (D20)
  * Trivia (Zelda-themed)
  * Coin flip
* **“Nudge” feature** that triggers device vibration (where supported)
* **Ephemeral message retention** (last 50 encrypted messages per room)

<img width="397" height="512" alt="Screenshot" src="https://github.com/user-attachments/assets/f3a5032c-4847-4a11-923c-7d7fe2146863" />

---

## 🔒 Security Architecture

### Message Encryption

All user-typed chat messages are:

1. Encrypted client-side using
   **`nacl.secretbox(message, nonce, sharedKey)`**
2. Sent to the server *only* as a `(nonce, ciphertext)` pair
3. Decrypted exclusively on clients possessing the shared key

The server does not receive plaintext message contents and cannot decrypt stored history.

### Room Derivation

Each chat session uses a 32-byte shared secret key.
A SHA-512-based hash (via `nacl.hash`) of this key is used as the **room identifier**.
The hash is shared with the server; the key itself is never transmitted.

### Unencrypted Metadata

The following events are transmitted in plaintext for functional reasons:

* Commands (`/rps`, `/roll`, `/flip`, `/trivia`)
* Typing indicators
* Nudge events
* Emoji reaction events
* Randomly assigned character names
* System alerts
* Room occupancy updates

These events contain no chat message content.

### Persistence

Only the encrypted payloads of messages are stored server-side (up to 50 per room, in memory only). No logs or plaintext transcripts are generated.

### Assumptions

Hyrule Link assumes that the local network (LAN / Wi-Fi hotspot) is operated only by trusted parties.  
Since the server relays messages over the LAN, any untrusted participant on the same network could potentially capture network traffic, even though messages are encrypted client-side.

---

## 🛠️ Installation (Before Travel)

Installation requires internet access once; after that, the application functions entirely offline.

### Prerequisites

* A device to host the server:
  Android (Termux), macOS, Windows, or Linux
* Node.js installed
* Ability to run a Wi-Fi hotspot or provide a local LAN

### 1. Create project directory

```bash
git clone https://github.com/tsumarios/Hyrule-Link.git
cd Hyrule-Link
npm init -y
npm install express socket.io
```

### 2. Download required client-side libraries

```bash
cd public
wget https://tweetnacl.js.org/nacl.min.js
wget https://unpkg.com/tweetnacl-util/nacl-util.min.js
wget https://cdn.socket.io/4.5.4/socket.io.min.js
```

---

## 🚀 Usage

### 1. Start the host device

1. Enable **Flight Mode**
2. Enable **Wi-Fi Hotspot**
3. Start the server:

```bash
node app.js
```

The terminal displays the local URL, for example:

```
http://192.168.43.1:3000
```

### 2. Connect clients

1. Other devices enable Flight Mode
2. Enable Wi-Fi and join the hotspot
3. Navigate to the host URL in the browser

### 3. Establish a shared key

* On first load, the client either

  * **Generates a new 64-character key**, or
  * **Prompts for an existing key**
* All participants using the **same key** join the same encrypted room
* The key never leaves the clients

---

## 🎮 Commands

Type the following in the chat input:

| Command       | Description                                  |
| ------------- | -------------------------------------------- |
| `/roll`       | Roll a D20                                   |
| `/flip`       | Flip a coin                                  |
| `/trivia`     | Display a random Zelda trivia question       |
| `/rps [move]` | Challenge another user (rock/paper/scissors) |

UI interactions:

* Tap the key (top of UI) to copy
* Tap the fairy button to send a nudge
* Tap reactions under messages to vote

---

## 🐞 Troubleshooting

**No messages appear?**
Participants must use the *exact same* session key.
Different keys → different isolated rooms.

**Clipboard copy failing on iOS?**
Some browsers restrict clipboard APIs on non-HTTPS origins.
Manual selection/copy is provided as a fallback.

**Hotspot cannot be enabled (Android)?**
Some devices restrict hotspot usage without mobile signal.
Bluetooth tethering can be used as an alternative transport.

---

## 📬 Contact

* Email: **[marioraciti@pm.me](mailto:marioraciti@pm.me)**
* LinkedIn: **linkedin.com/in/marioraciti**
* Twitter: **twitter.com/tsumarios**

If you find the project useful:

<a href="https://www.buymeacoffee.com/tsumarios" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" height="40">
</a>

**Happy Flying, Hylian\!** ⚔️
