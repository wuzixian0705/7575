const boardEl = document.getElementById("board");
const movesList = document.getElementById("movesList");
const toastEl = document.getElementById("toast");

const glyphs = {
  white: { king: "♔", queen: "♕", rook: "♖", bishop: "♗", knight: "♘", pawn: "♙" },
  black: { king: "♚", queen: "♛", rook: "♜", bishop: "♝", knight: "♞", pawn: "♟" }
};

let board;
let turn = "white";
let selected = null;
let legalMoves = [];
let history = [];
let lastMove = null;
let whiteSeconds = 600;
let blackSeconds = 600;
let timer;

function initialBoard() {
  const back = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];
  return [
    back.map(type => ({ type, color: "black" })),
    Array(8).fill(null).map(() => ({ type: "pawn", color: "black" })),
    ...Array(4).fill(null).map(() => Array(8).fill(null)),
    Array(8).fill(null).map(() => ({ type: "pawn", color: "white" })),
    back.map(type => ({ type, color: "white" }))
  ];
}

function resetGame() {
  board = initialBoard();
  turn = "white";
  selected = null;
  legalMoves = [];
  history = [];
  lastMove = null;
  whiteSeconds = blackSeconds = 600;
  clearInterval(timer);
  timer = setInterval(tick, 1000);
  document.getElementById("capturedWhite").textContent = "";
  document.getElementById("capturedBlack").textContent = "";
  render();
  renderMoves();
  showToast("A new game has begun");
}

function tick() {
  if (turn === "white") whiteSeconds--;
  else blackSeconds--;
  if (whiteSeconds <= 0 || blackSeconds <= 0) {
    clearInterval(timer);
    showToast((whiteSeconds <= 0 ? "Black" : "White") + " wins on time");
  }
  updateClocks();
}

function updateClocks() {
  document.getElementById("whiteClock").textContent = formatTime(whiteSeconds);
  document.getElementById("blackClock").textContent = formatTime(blackSeconds);
}

function formatTime(seconds) {
  seconds = Math.max(0, seconds);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function render() {
  boardEl.innerHTML = "";
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const square = document.createElement("button");
      square.className = `square ${(row + col) % 2 ? "dark" : "light"}`;
      square.dataset.row = row;
      square.dataset.col = col;

      if (selected && selected.row === row && selected.col === col) square.classList.add("selected");
      if (lastMove && ((lastMove.fromRow === row && lastMove.fromCol === col) ||
          (lastMove.toRow === row && lastMove.toCol === col))) square.classList.add("last");

      const targetMove = legalMoves.find(move => move.row === row && move.col === col);
      if (targetMove) square.classList.add(board[row][col] ? "capture" : "legal");

      if (col === 0) {
        const rank = document.createElement("span");
        rank.className = "coord rank";
        rank.textContent = 8 - row;
        square.appendChild(rank);
      }
      if (row === 7) {
        const file = document.createElement("span");
        file.className = "coord file";
        file.textContent = "abcdefgh"[col];
        square.appendChild(file);
      }

      const piece = board[row][col];
      if (piece) {
        const pieceEl = document.createElement("span");
        pieceEl.className = `piece ${piece.color}`;
        pieceEl.textContent = glyphs[piece.color][piece.type];
        square.appendChild(pieceEl);
      }
      square.addEventListener("click", () => handleSquare(row, col));
      boardEl.appendChild(square);
    }
  }
  updateClocks();
}

function handleSquare(row, col) {
  const piece = board[row][col];
  if (selected) {
    const move = legalMoves.find(item => item.row === row && item.col === col);
    if (move) {
      makeMove(selected.row, selected.col, row, col);
      return;
    }
  }
  if (piece && piece.color === turn) {
    selected = { row, col };
    legalMoves = getLegalMoves(row, col);
  } else {
    selected = null;
    legalMoves = [];
  }
  render();
}

function makeMove(fromRow, fromCol, toRow, toCol) {
  const piece = board[fromRow][fromCol];
  const captured = board[toRow][toCol];
  const notation = getNotation(piece, fromRow, fromCol, toRow, toCol, captured);

  history.push({
    board: board.map(row => row.map(item => item ? { ...item } : null)),
    turn, lastMove, notation,
    capturedWhite: document.getElementById("capturedWhite").textContent,
    capturedBlack: document.getElementById("capturedBlack").textContent
  });
  board[toRow][toCol] = { ...piece };
  board[fromRow][fromCol] = null;

  if (piece.type === "pawn" && (toRow === 0 || toRow === 7)) {
    board[toRow][toCol].type = "queen";
  }

  lastMove = { fromRow, fromCol, toRow, toCol };
  turn = turn === "white" ? "black" : "white";
  selected = null;
  legalMoves = [];
  render();
  renderMoves(notation);
  updateAnalysis();
  if (captured) addCaptured(captured);
}

function getNotation(piece, fromRow, fromCol, toRow, toCol, captured) {
  const files = "abcdefgh";
  const prefix = piece.type === "pawn" ? "" : piece.type === "knight" ? "N" :
    piece.type === "bishop" ? "B" : piece.type === "rook" ? "R" :
    piece.type === "queen" ? "Q" : "K";
  const capture = captured ? (piece.type === "pawn" ? files[fromCol] + "x" : "x") : "";
  return prefix + capture + files[toCol] + (8 - toRow);
}

function getLegalMoves(row, col) {
  const piece = board[row][col];
  if (!piece) return [];
  const moves = [];

  function add(r, c) {
    if (r < 0 || r > 7 || c < 0 || c > 7) return false;
    const target = board[r][c];
    if (!target) { moves.push({ row: r, col: c }); return true; }
    if (target.color !== piece.color) moves.push({ row: r, col: c });
    return false;
  }

  if (piece.type === "pawn") {
    const dir = piece.color === "white" ? -1 : 1;
    if (!board[row + dir]?.[col]) {
      add(row + dir, col);
      const start = piece.color === "white" ? 6 : 1;
      if (row === start && !board[row + dir * 2]?.[col]) add(row + dir * 2, col);
    }
    for (const dc of [-1, 1]) {
      const r = row + dir, c = col + dc;
      if (r >= 0 && r < 8 && c >= 0 && c < 8 &&
          board[r][c] && board[r][c].color !== piece.color) add(r, c);
    }
  }

  if (piece.type === "knight") {
    for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) add(row+dr,col+dc);
  }

  if (piece.type === "bishop" || piece.type === "rook" || piece.type === "queen") {
    const dirs = piece.type === "bishop" ? [[-1,-1],[-1,1],[1,-1],[1,1]] :
      piece.type === "rook" ? [[-1,0],[1,0],[0,-1],[0,1]] :
      [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]];
    for (const [dr, dc] of dirs) {
      let r = row + dr, c = col + dc;
      while (r >= 0 && r < 8 && c >= 0 && c < 8) {
        if (!add(r, c)) break;
        r += dr; c += dc;
      }
    }
  }

  if (piece.type === "king") {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr || dc) add(row+dr,col+dc);
      }
    }
  }
  return moves;
}

function renderMoves(latestNotation) {
  movesList.innerHTML = "";
  let moveCount = 0;
  for (let i = 0; i < history.length; i++) {
    if (history[i].notation && i % 2 === 0) {
      moveCount++;
      const num = document.createElement("span");
      num.className = "move-num";
      num.textContent = moveCount + ".";
      movesList.appendChild(num);
    }
  }
  movesList.innerHTML = "";
  const pairs = [];
  for (let i = 0; i < history.length; i += 2) {
    pairs.push([history[i]?.notation, history[i + 1]?.notation]);
  }
  pairs.forEach((pair, index) => {
    const num = document.createElement("span");
    num.className = "move-num";
    num.textContent = index + 1 + ".";
    const whiteMove = document.createElement("span");
    whiteMove.className = "move";
    whiteMove.textContent = pair[0] || "";
    const blackMove = document.createElement("span");
    blackMove.className = "move";
    blackMove.textContent = pair[1] || "";
    if (pair[0] && !pair[1]) whiteMove.classList.add("latest");
    if (pair[1] && index === pairs.length - 1) blackMove.classList.add("latest");
    movesList.append(num, whiteMove, blackMove);
  });
  movesList.scrollTop = movesList.scrollHeight;
}

function updateAnalysis() {
  const values = { pawn: 1, knight: 3.1, bishop: 3.3, rook: 5, queen: 9, king: 0 };
  let score = 0;
  board.flat().forEach(piece => {
    if (piece) score += (piece.color === "white" ? 1 : -1) * values[piece.type];
  });
  document.getElementById("evalScore").textContent = score === 0 ? "0.0" : (score > 0 ? "+" : "") + score.toFixed(1);
  document.getElementById("positionLabel").textContent = score === 0 ? "Equal" : (score > 0 ? "White + " : "Black + ") + Math.abs(score).toFixed(1);
  document.getElementById("evalFill").style.width = `${Math.max(8, Math.min(92, 50 + score * 4))}%`;
  document.getElementById("bestMove").textContent = lastMove ? "viewing" : "—";
}

function addCaptured(captured) {
  const target = captured.color === "white" ? "capturedWhite" : "capturedBlack";
  const el = document.getElementById(target);
  el.textContent += glyphs[captured.color][captured.type];
}

function undo() {
  if (!history.length) return;
  const previous = history.pop();
  board = previous.board;
  turn = previous.turn;
  lastMove = previous.lastMove;
  selected = null;
  legalMoves = [];
  document.getElementById("capturedWhite").textContent = previous.capturedWhite || "";
  document.getElementById("capturedBlack").textContent = previous.capturedBlack || "";
  render();
  renderMoves();
  updateAnalysis();
  showToast("Move taken back");
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toastEl.classList.remove("show"), 1800);
}

document.getElementById("newGameBtn").addEventListener("click", resetGame);
document.getElementById("undoBtn").addEventListener("click", undo);
resetGame();
