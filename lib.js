/**
 * Shared helpers for the Yoki Extended Math plugin.
 *
 * Plugin SDK v2 protocol (Node.js):
 * - Read JSON from stdin
 * - Write JSON V2Response to stdout
 */

"use strict";

// ---------- I/O ----------

function readInput() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => {
      try {
        resolve(data.trim() ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function writeResponse(resp) {
  process.stdout.write(JSON.stringify(resp) + "\n");
}

// ---------- Response builders ----------

function detail(markdown, metadata, actions) {
  const out = { type: "detail", markdown };
  if (metadata) out.metadata = metadata;
  if (actions) out.actions = actions;
  return out;
}

function listResponse(items) {
  return { type: "list", items };
}

function error(msg, details) {
  const out = { type: "error", error: msg };
  if (details) out.details = details;
  return out;
}

// ---------- Query parsing ----------

function stripKeyword(query, ...keywords) {
  const q = (query || "").trim();
  const low = q.toLowerCase();
  for (const kw of keywords) {
    const kwLow = kw.toLowerCase();
    if (low === kwLow) return "";
    if (low.startsWith(kwLow + " ")) return q.slice(kw.length + 1).trim();
  }
  return q;
}

// ---------- Safe math evaluator ----------

const CONSTANTS = {
  pi: Math.PI,
  PI: Math.PI,
  e: Math.E,
  E: Math.E,
  tau: Math.PI * 2,
  TAU: Math.PI * 2,
  phi: (1 + Math.sqrt(5)) / 2,
  PHI: (1 + Math.sqrt(5)) / 2,
  inf: Infinity,
  Infinity: Infinity,
};

const FUNCTIONS = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  atan2: Math.atan2,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  asinh: Math.asinh,
  acosh: Math.acosh,
  atanh: Math.atanh,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  ceil: Math.ceil,
  floor: Math.floor,
  round: Math.round,
  sign: Math.sign,
  log: Math.log,        // natural log (ln)
  ln: Math.log,
  log2: Math.log2,
  log10: Math.log10,
  exp: Math.exp,
  fact: factorial,
  factorial: factorial,
  deg: (x) => (x * 180) / Math.PI,
  rad: (x) => (x * Math.PI) / 180,
  min: Math.min,
  max: Math.max,
  hypot: Math.hypot,
};

function factorial(n) {
  n = Math.round(n);
  if (n < 0) return NaN;
  if (n > 170) return Infinity;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

// --- Tokenizer ---

const TokenType = {
  NUMBER: "NUM",
  IDENT: "ID",
  OP: "OP",
  LPAREN: "(",
  RPAREN: ")",
  COMMA: ",",
  EOF: "EOF",
};

function tokenize(expr) {
  const tokens = [];
  let i = 0;
  const s = expr.replace(/\s+/g, " ").trim();

  while (i < s.length) {
    if (s[i] === " ") { i++; continue; }

    // Number (including decimal)
    if (/[0-9.]/.test(s[i])) {
      let num = "";
      while (i < s.length && /[0-9.eE]/.test(s[i])) {
        if ((s[i] === "e" || s[i] === "E") && i + 1 < s.length && (s[i + 1] === "+" || s[i + 1] === "-")) {
          num += s[i] + s[i + 1];
          i += 2;
        } else {
          num += s[i++];
        }
      }
      tokens.push({ type: TokenType.NUMBER, value: parseFloat(num) });
      continue;
    }

    // Identifier (function or constant)
    if (/[a-zA-Z_]/.test(s[i])) {
      let id = "";
      while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) id += s[i++];
      tokens.push({ type: TokenType.IDENT, value: id });
      continue;
    }

    if (s[i] === "(") { tokens.push({ type: TokenType.LPAREN }); i++; continue; }
    if (s[i] === ")") { tokens.push({ type: TokenType.RPAREN }); i++; continue; }
    if (s[i] === ",") { tokens.push({ type: TokenType.COMMA }); i++; continue; }

    if ("+-*/%^!".includes(s[i])) {
      tokens.push({ type: TokenType.OP, value: s[i] });
      i++;
      continue;
    }

    throw new Error(`Unexpected character: '${s[i]}'`);
  }

  tokens.push({ type: TokenType.EOF });
  return tokens;
}

// --- Recursive descent parser & evaluator ---

function evaluate(expr, vars) {
  const tokens = tokenize(expr);
  let pos = 0;
  const variables = { ...CONSTANTS, ...(vars || {}) };

  function peek() { return tokens[pos]; }
  function consume(type) {
    const t = tokens[pos];
    if (type && t.type !== type) throw new Error(`Expected ${type}, got ${t.type}`);
    pos++;
    return t;
  }

  // expr = term (('+' | '-') term)*
  function parseExpr() {
    let left = parseTerm();
    while (peek().type === TokenType.OP && (peek().value === "+" || peek().value === "-")) {
      const op = consume().value;
      const right = parseTerm();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  // term = power (('*' | '/' | '%') power)*
  // also handles implicit multiplication: 2pi, 2(3+4), pi(2)
  function parseTerm() {
    let left = parseUnary();
    while (true) {
      const t = peek();
      if (t.type === TokenType.OP && (t.value === "*" || t.value === "/" || t.value === "%")) {
        const op = consume().value;
        const right = parseUnary();
        if (op === "*") left *= right;
        else if (op === "/") left /= right;
        else left %= right;
      } else if (
        t.type === TokenType.NUMBER ||
        t.type === TokenType.IDENT ||
        t.type === TokenType.LPAREN
      ) {
        // Implicit multiplication
        const right = parseUnary();
        left *= right;
      } else {
        break;
      }
    }
    return left;
  }

  // unary = ('+' | '-')? power
  function parseUnary() {
    const t = peek();
    if (t.type === TokenType.OP && (t.value === "+" || t.value === "-")) {
      consume();
      const val = parsePower();
      return t.value === "-" ? -val : val;
    }
    return parsePower();
  }

  // power = postfix ('^' unary)?
  function parsePower() {
    let base = parsePostfix();
    if (peek().type === TokenType.OP && peek().value === "^") {
      consume();
      const exp = parseUnary(); // right-associative
      base = Math.pow(base, exp);
    }
    return base;
  }

  // postfix = primary ('!')?
  function parsePostfix() {
    let val = parsePrimary();
    while (peek().type === TokenType.OP && peek().value === "!") {
      consume();
      val = factorial(val);
    }
    return val;
  }

  // primary = NUMBER | IDENT | IDENT '(' args ')' | '(' expr ')'
  function parsePrimary() {
    const t = peek();

    if (t.type === TokenType.NUMBER) {
      consume();
      return t.value;
    }

    if (t.type === TokenType.IDENT) {
      consume();
      const name = t.value;

      // Function call
      if (peek().type === TokenType.LPAREN && FUNCTIONS[name]) {
        consume(TokenType.LPAREN);
        const args = [];
        if (peek().type !== TokenType.RPAREN) {
          args.push(parseExpr());
          while (peek().type === TokenType.COMMA) {
            consume();
            args.push(parseExpr());
          }
        }
        consume(TokenType.RPAREN);
        return FUNCTIONS[name](...args);
      }

      // Variable / constant
      if (name in variables) return variables[name];
      throw new Error(`Unknown: '${name}'`);
    }

    if (t.type === TokenType.LPAREN) {
      consume();
      const val = parseExpr();
      consume(TokenType.RPAREN);
      return val;
    }

    throw new Error(`Unexpected: '${t.type}'`);
  }

  const result = parseExpr();
  if (peek().type !== TokenType.EOF) {
    throw new Error(`Unexpected token after expression`);
  }
  return result;
}

// ---------- Number formatting ----------

function fmt(n) {
  if (n === undefined || n === null) return "?";
  if (!isFinite(n)) return n > 0 ? "∞" : n < 0 ? "-∞" : "NaN";
  // Trim trailing zeros but keep reasonable precision
  const abs = Math.abs(n);
  if (abs === 0) return "0";
  if (abs >= 1e15 || (abs < 1e-10 && abs !== 0)) return n.toExponential(6);
  const s = n.toPrecision(12);
  // Remove trailing zeros after decimal point
  if (s.includes(".")) return s.replace(/\.?0+$/, "");
  return s;
}

module.exports = {
  readInput, writeResponse, detail, listResponse, error,
  stripKeyword, evaluate, fmt, CONSTANTS, FUNCTIONS,
  factorial, tokenize,
};
