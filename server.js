const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map();
const REACTIONS = ["👍", "😂", "😮", "😢", "😡", "👏", "🤔", "😤"];
const WINS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

function newRoom(code) {
  return {
    code,
    players: { X: null, O: null },
    board: Array(9).fill(null),
    turn: "X",
    starter: "X",
    scores: { X: 0, O: 0, D: 0 },
    over: null,
    everStarted: false,
    rematchRequests:null
  };
}

function winner(b) {
  for (const [a, c, d] of WINS) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  }
  return b.every(Boolean) ? "D" : null;
}

function winCombo(b) {
  for (const combo of WINS) {
    const [a, c, d] = combo;
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return combo;
  }
  return null;
}

function roomState(room) {
  const requesterMark =
    room.rematchRequest === room.players.X ? "X" :
    room.rematchRequest === room.players.O ? "O" :
    null;

  return {
    code: room.code,
    board: room.board,
    turn: room.turn,
    scores: room.scores,
    over: room.over,
    combo: room.over && room.over !== "D" ? winCombo(room.board) : null,
    started: !!(room.players.X && room.players.O),
    everStarted: room.everStarted,
    players: { X: !!room.players.X, O: !!room.players.O },
    rematchFrom: requesterMark  
  };
}

function broadcast(room) {
  io.to(room.code).emit("state", roomState(room));
}

function leaveCurrent(socket) {
  const code = socket.data.room;
  if (!code) return;
  const room = rooms.get(code);
  socket.leave(code);
  socket.data.room = null;
  const mark = socket.data.mark;
  socket.data.mark = null;
  if (!room) return;
  if (mark && room.players[mark] === socket.id) {
    room.players[mark] = null;
  }
  const alguienQueda = room.players.X || room.players.O;
  if (!alguienQueda) {
    rooms.delete(code);
  } else {
    if (room.rematchRequest) {
      clearTimeout(room.rematchTimer);  
      room.rematchRequest = null;
      io.to(code).emit("rematchDeclined");
    }
    broadcast(room);
  }
}

io.on("connection", (socket) => {
  socket.on("createRoom", () => {
    leaveCurrent(socket);
    let code;
    do {
      code = Math.random().toString(36).slice(2, 6).toUpperCase();
    } while (rooms.has(code));
    const room = newRoom(code);
    room.players.X = socket.id;
    rooms.set(code, room);
    socket.join(code);
    socket.data.room = code;
    socket.data.mark = "X";
    socket.emit("joined", { code, mark: "X" });
    broadcast(room);
  });

  socket.on("joinRoom", (code) => {
    leaveCurrent(socket);
    code = String(code || "").toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) return socket.emit("errorMsg", "Papapapailaa... sala no encontrada");
    let mark = null;
    if (!room.players.X) mark = "X";
    else if (!room.players.O) mark = "O";
    else return socket.emit("errorMsg", "La sala esta llena aguantelo tantico");
    room.players[mark] = socket.id;
    socket.join(code);
    socket.data.room = code;
    socket.data.mark = mark;
    socket.emit("joined", { code, mark });
    if (room.players.X && room.players.O) room.everStarted = true;
    broadcast(room);
  });

  socket.on("move", (i) => {
    const room = rooms.get(socket.data.room);
    if (!room || room.over) return;
    const mark = socket.data.mark;
    if (!mark || room.players[mark] !== socket.id) return;
    if (!room.players.X || !room.players.O) return;
    if (room.turn !== mark) return;
    i = Number(i);
    if (!Number.isInteger(i) || i < 0 || i > 8 || room.board[i]) return;
    room.board[i] = mark;
    room.rematchRequest = null;
    const w = winner(room.board);
    if (w) {
      room.over = w;
      if (w === "D") room.scores.D++;
      else room.scores[w]++;
    } else {
      room.turn = mark === "X" ? "O" : "X";
    }
    broadcast(room);
  });

  socket.on("rematch", () => {
  const room = rooms.get(socket.data.room);
  if (!room || !room.over) return;           

  const ids = Object.values(room.players).filter(Boolean);
  if (ids.length !== 2) return;                   

  if (!room.rematchRequest) {
    room.rematchRequest = socket.id;
    io.to(room.code).emit("rematchOffer", { from: socket.data.mark });
    
  room.rematchTimer = setTimeout(() => {
    if (room.rematchRequest === socket.id) { 
      room.rematchRequest = null;
      io.to(room.code).emit("rematchDeclined");
    }
  }, 15000);

  } else if (room.rematchRequest !== socket.id) {
    clearTimeout(room.rematchTimer); 
    room.board = Array(9).fill(null);
    room.starter = room.starter === "X" ? "O" : "X";     
    room.turn = room.starter;
    room.over = null;
    room.rematchRequest = null;
    broadcast(room);                                     
  }

  socket.on("declineRematch", () => {
  const room = rooms.get(socket.data.room);
  if (!room) return;
  if (!room.rematchRequest) return;                
  if (room.rematchRequest === socket.id) return;    
  clearTimeout(room.rematchTimer);
  room.rematchRequest = null;
  io.to(room.code).emit("rematchDeclined");
  });
  
});

  socket.on("reaction", (emoji) => {
    const room = rooms.get(socket.data.room);
    if (!room) return;
    if (!REACTIONS.includes(emoji)) return;
    io.to(room.code).emit("reaction", { emoji, from: socket.data.mark });
  });

  socket.on("leave", () => leaveCurrent(socket));
  socket.on("disconnect", () => leaveCurrent(socket));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("TicTacToe Pixel en puerto " + PORT));
