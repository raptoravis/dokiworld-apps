export const MATCH3_KINDS = ["performance", "intelligence", "charm", "physique", "heart"];
const TILE_SCORE = 10;
const MAX_GENERATION_ATTEMPTS = 80;

function pickKind(random) {
  return MATCH3_KINDS[Math.floor(random() * MATCH3_KINDS.length) % MATCH3_KINDS.length];
}

export function createSeededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function createMatch3State(config, random = Math.random) {
  let board = makeBoard(config.rows, config.columns, random);
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS && !hasValidMove(board); attempt += 1) {
    board = makeBoard(config.rows, config.columns, random);
  }
  return { board, score: 0, movesUsed: 0, cleared: 0, bestCascade: 0 };
}

export function areAdjacent(first, second) {
  return Math.abs(first.row - second.row) + Math.abs(first.column - second.column) === 1;
}

export function findMatches(board) {
  const rows = board.length;
  const columns = board[0]?.length ?? 0;
  const matches = new Map();
  const add = (row, column) => matches.set(`${row}:${column}`, { row, column });
  for (let row = 0; row < rows; row += 1) {
    let runStart = 0;
    for (let column = 1; column <= columns; column += 1) {
      if (column < columns && board[row][column] === board[row][runStart]) continue;
      if (column - runStart >= 3) for (let current = runStart; current < column; current += 1) add(row, current);
      runStart = column;
    }
  }
  for (let column = 0; column < columns; column += 1) {
    let runStart = 0;
    for (let row = 1; row <= rows; row += 1) {
      if (row < rows && board[row][column] === board[runStart][column]) continue;
      if (row - runStart >= 3) for (let current = runStart; current < row; current += 1) add(current, column);
      runStart = row;
    }
  }
  return [...matches.values()];
}

export function swapMatch3Cells(board, first, second) {
  const next = board.map((row) => [...row]);
  const firstKind = next[first.row][first.column];
  next[first.row][first.column] = next[second.row][second.column];
  next[second.row][second.column] = firstKind;
  return next;
}

export function applyMatch3Move(current, first, second, random = Math.random) {
  if (!areAdjacent(first, second) || !isInBounds(current.board, first) || !isInBounds(current.board, second)) return unchangedMove(current);
  let board = swapMatch3Cells(current.board, first, second);
  if (findMatches(board).length === 0) return unchangedMove(current);
  let cascades = 0;
  let scoreGained = 0;
  let cleared = 0;
  const steps = [];
  for (let guard = 0; guard < 100; guard += 1) {
    const matches = findMatches(board);
    if (matches.length === 0) break;
    cascades += 1;
    cleared += matches.length;
    const stepScore = matches.length * TILE_SCORE * cascades;
    scoreGained += stepScore;
    board = collapseBoard(board, matches, random);
    steps.push({
      matched: matches,
      scoreGained: stepScore,
      cascadeIndex: cascades,
      boardAfter: board,
    });
  }
  if (!hasValidMove(board)) board = makePlayableBoard(board.length, board[0]?.length ?? 0, random);
  if (steps.length > 0) steps[steps.length - 1].boardAfter = board;
  return {
    valid: true,
    cascades,
    scoreGained,
    cleared,
    steps,
    state: {
      board,
      score: current.score + scoreGained,
      movesUsed: current.movesUsed + 1,
      cleared: current.cleared + cleared,
      bestCascade: Math.max(current.bestCascade, cascades),
    },
  };
}

export function hasValidMove(board) {
  const rows = board.length;
  const columns = board[0]?.length ?? 0;
  for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
    const current = { row, column };
    if (column + 1 < columns && findMatches(swapMatch3Cells(board, current, { row, column: column + 1 })).length > 0) return true;
    if (row + 1 < rows && findMatches(swapMatch3Cells(board, current, { row: row + 1, column })).length > 0) return true;
  }
  return false;
}

function makeBoard(rows, columns, random) {
  const board = [];
  for (let row = 0; row < rows; row += 1) {
    const nextRow = [];
    for (let column = 0; column < columns; column += 1) {
      let kind = pickKind(random);
      for (let guard = 0; guard < 30; guard += 1) {
        const horizontal = column >= 2 && nextRow[column - 1] === kind && nextRow[column - 2] === kind;
        const vertical = row >= 2 && board[row - 1][column] === kind && board[row - 2][column] === kind;
        if (!horizontal && !vertical) break;
        kind = pickKind(random);
      }
      nextRow.push(kind);
    }
    board.push(nextRow);
  }
  return board;
}

function makePlayableBoard(rows, columns, random) {
  let board = makeBoard(rows, columns, random);
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS && !hasValidMove(board); attempt += 1) board = makeBoard(rows, columns, random);
  return board;
}

function collapseBoard(board, matches, random) {
  const rows = board.length;
  const columns = board[0]?.length ?? 0;
  const removed = new Set(matches.map(({ row, column }) => `${row}:${column}`));
  const next = Array.from({ length: rows }, () => Array(columns));
  for (let column = 0; column < columns; column += 1) {
    const survivors = [];
    for (let row = rows - 1; row >= 0; row -= 1) if (!removed.has(`${row}:${column}`)) survivors.push(board[row][column]);
    for (let row = rows - 1, index = 0; row >= 0; row -= 1, index += 1) next[row][column] = survivors[index] ?? pickKind(random);
  }
  return next;
}

function isInBounds(board, position) {
  return position.row >= 0 && position.row < board.length && position.column >= 0 && position.column < (board[0]?.length ?? 0);
}

function unchangedMove(state) {
  return { state, valid: false, cascades: 0, scoreGained: 0, cleared: 0, steps: [] };
}
