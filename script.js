const socket = io();

let mode = "local";
let board = Array(9).fill("");
let turn = "X";
let finished = false;
let roomCode = "";
let mySymbol = null;
let onlineRoom = null;

const home = document.getElementById("home");
const game = document.getElementById("game");
const statusText = document.getElementById("status");
const result = document.getElementById("result");
const cells = document.querySelectorAll(".cell");

function showGame() {
    home.classList.add("hidden");
    game.classList.remove("hidden");
}

function goHome() {
    if (mode === "online" && roomCode) {
        socket.disconnect();
        socket.connect();
    }

    roomCode = "";
    onlineRoom = null;
    mySymbol = null;
    mode = "local";

    document.getElementById("roomInfo").classList.add("hidden");
    home.classList.remove("hidden");
    game.classList.add("hidden");
}

function startLocal() {
    mode = "local";
    board = Array(9).fill("");
    turn = "X";
    finished = false;

    document.getElementById("modeLabel").textContent = "YEREL OYUN";
    document.getElementById("roomInfo").classList.add("hidden");

    showGame();
    renderLocal();
}

function renderLocal() {
    cells.forEach((cell, i) => {
        cell.textContent = board[i];
        cell.className = "cell";

        if (board[i]) cell.classList.add(board[i].toLowerCase());

        cell.disabled = finished || board[i] !== "";
    });

    statusText.textContent = finished
        ? "OYUN TAMAMLANDI"
        : turn + " OYUNCUSUNUN SIRASI";

    document.getElementById("playerX").classList.toggle("active", turn === "X");
    document.getElementById("playerO").classList.toggle("active", turn === "O");
}

function winnerCheck(b) {
    const lines = [
        [0,1,2], [3,4,5], [6,7,8],
        [0,3,6], [1,4,7], [2,5,8],
        [0,4,8], [2,4,6]
    ];

    for (const [a,b1,c] of lines) {
        if (b[a] && b[a] === b[b1] && b[b1] === b[c]) {
            return b[a];
        }
    }

    return null;
}

function localMove(index) {
    if (board[index] || finished) return;

    board[index] = turn;

    const winner = winnerCheck(board);

    if (winner) {
        finished = true;
        result.textContent = "🏆 " + winner + " KAZANDI!";
    } else if (board.every(x => x !== "")) {
        finished = true;
        result.textContent = "🤝 BERABERE!";
    } else {
        turn = turn === "X" ? "O" : "X";
        result.textContent = "";
    }

    renderLocal();
}

cells.forEach(cell => {
    cell.addEventListener("click", () => {
        const index = Number(cell.dataset.index);

        if (mode === "local") {
            localMove(index);
        } else {
            if (onlineRoom && !finished &&
                onlineRoom.players[turn] === socket.id) {
                socket.emit("make-move", {
                    code: roomCode,
                    index
                });
            }
        }
    });
});

function createRoom() {
    if (!socket.connected) {
        showMessage("Sunucuya bağlanılamadı!");
        return;
    }

    mode = "online";
    socket.emit("create-room");
}

function joinRoom() {
    const code = document.getElementById("roomInput")
        .value.trim().toUpperCase();

    if (code.length !== 5) {
        showMessage("5 karakterli oda kodu gir!");
        return;
    }

    if (!socket.connected) {
        showMessage("Sunucuya bağlanılamadı!");
        return;
    }

    mode = "online";
    socket.emit("join-room", code);
}

function showMessage(message) {
    document.getElementById("homeMessage").textContent = message;
}

socket.on("room-created", code => {
    roomCode = code;
    mySymbol = "X";

    document.getElementById("roomCode").textContent = code;
    document.getElementById("roomInfo").classList.remove("hidden");
    document.getElementById("modeLabel").textContent = "ONLINE ARENA";

    showGame();
});

socket.on("room-joined", code => {
    roomCode = code;
    mySymbol = "O";

    document.getElementById("roomCode").textContent = code;
    document.getElementById("roomInfo").classList.remove("hidden");
    document.getElementById("modeLabel").textContent = "ONLINE ARENA";

    showGame();
});

socket.on("game-state", state => {
    onlineRoom = state;
    board = state.board;
    turn = state.turn;
    finished = !!(state.winner || state.draw);

    cells.forEach((cell, i) => {
        cell.textContent = board[i];
        cell.className = "cell";

        if (board[i]) cell.classList.add(board[i].toLowerCase());

        cell.disabled = finished || board[i] !== "" ||
            !mySymbol || state.players[turn] !== socket.id;
    });

    document.getElementById("playerX").classList.toggle("active", turn === "X");
    document.getElementById("playerO").classList.toggle("active", turn === "O");

    if (!state.players.O) {
        statusText.textContent = "RAKİP BEKLENİYOR...";
    } else if (state.winner) {
        statusText.textContent = "OYUN BİTTİ";
        result.textContent = "🏆 " + state.winner + " KAZANDI!";
    } else if (state.draw) {
        statusText.textContent = "OYUN BİTTİ";
        result.textContent = "🤝 BERABERE!";
    } else {
        statusText.textContent = turn === mySymbol
            ? "SIRA SENDE! (" + turn + ")"
            : "RAKİP OYNUYOR...";

        result.textContent = "";
    }
});

socket.on("game-error", message => {
    showMessage(message);
});

socket.on("opponent-left", () => {
    result.textContent = "⚠️ RAKİP OYUNDAN AYRILDI!";
    statusText.textContent = "ODA KAPATILDI";
    finished = true;
});

function restartGame() {
    if (mode === "local") {
        startLocal();
    } else if (roomCode) {
        socket.emit("restart-game", roomCode);
    }
}

function copyRoom() {
    if (roomCode) {
        navigator.clipboard.writeText(roomCode)
            .then(() => {
                statusText.textContent = "ODA KODU KOPYALANDI!";
            })
            .catch(() => {
                statusText.textContent = "ODA KODUN: " + roomCode;
            });
    }
}
