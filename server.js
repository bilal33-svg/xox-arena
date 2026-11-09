const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

const rooms = {};

function createBoard() {
    return Array(9).fill("");
}

function checkWinner(board) {
    const lines = [
        [0,1,2], [3,4,5], [6,7,8],
        [0,3,6], [1,4,7], [2,5,8],
        [0,4,8], [2,4,6]
    ];

    for (const [a,b,c] of lines) {
        if (board[a] && board[a] === board[b] &&
            board[b] === board[c]) {
            return board[a];
        }
    }

    return null;
}

function sendState(roomCode) {
    const room = rooms[roomCode];
    if (room) {
        io.to(roomCode).emit("game-state", room);
    }
}

io.on("connection", (socket) => {

    console.log("Oyuncu bağlandı:", socket.id);

    socket.on("create-room", () => {
        let code;

        do {
            code = Math.random().toString(36)
                .substring(2, 7).toUpperCase();
        } while (rooms[code]);

        rooms[code] = {
            board: createBoard(),
            turn: "X",
            winner: null,
            draw: false,
            players: {
                X: socket.id,
                O: null
            }
        };

        socket.join(code);
        socket.emit("room-created", code);
        sendState(code);

        console.log("Oda oluşturuldu:", code);
    });

    socket.on("join-room", (code) => {
        code = String(code || "").trim().toUpperCase();

        const room = rooms[code];

        if (!room) {
            socket.emit("game-error", "Oda bulunamadı!");
            return;
        }

        if (room.players.O) {
            socket.emit("game-error", "Oda dolu!");
            return;
        }

        room.players.O = socket.id;
        socket.join(code);

        socket.emit("room-joined", code);
        sendState(code);

        console.log("Oyuncu odaya katıldı:", code);
    });

    socket.on("make-move", ({ code, index }) => {
        const room = rooms[code];

        if (!room || !Number.isInteger(index) ||
            index < 0 || index > 8) return;

        const player = room.players.X === socket.id
            ? "X"
            : room.players.O === socket.id
            ? "O"
            : null;

        if (!player || player !== room.turn ||
            room.winner || room.draw ||
            room.board[index]) return;

        room.board[index] = player;

        room.winner = checkWinner(room.board);

        if (!room.winner &&
            room.board.every(cell => cell !== "")) {
            room.draw = true;
        }

        room.turn = player === "X" ? "O" : "X";

        sendState(code);
    });

    socket.on("restart-game", (code) => {
        const room = rooms[code];

        if (!room ||
            !Object.values(room.players).includes(socket.id)) {
            return;
        }

        room.board = createBoard();
        room.turn = "X";
        room.winner = null;
        room.draw = false;

        sendState(code);
    });

    socket.on("disconnect", () => {
        for (const [code, room] of Object.entries(rooms)) {
            if (room.players.X === socket.id ||
                room.players.O === socket.id) {

                io.to(code).emit("opponent-left");

                delete rooms[code];

                console.log("Oda kapatıldı:", code);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
    console.log("================================");
    console.log("       XOX ARENA SERVER");
    console.log("================================");
    console.log("Sunucu portu:", PORT);
    console.log("Sunucu hazır!");
});
