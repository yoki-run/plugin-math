#!/usr/bin/env node
/**
 * derive — symbolic differentiation (detail mode)
 *
 * Supports polynomials, trig, exp, log, and compositions via chain rule.
 * Uses a simple AST-based approach.
 *
 * Usage: math der x^3+2x
 *        math der sin(x^2)
 *        math der ln(x)
 *        math der exp(2x)
 */
"use strict";

const { readInput, writeResponse, detail, error, stripKeyword, evaluate, fmt } = require("./lib");

// ---------- AST nodes ----------

const N = (type, props) => ({ type, ...props });
const Num = (v) => N("num", { value: v });
const Var = (name) => N("var", { name });
const BinOp = (op, l, r) => N("binop", { op, left: l, right: r });
const UnaryOp = (op, arg) => N("unary", { op, arg });
const FnCall = (name, arg) => N("fn", { name, arg });

// ---------- Tokenizer (reused concept from lib) ----------

function tokenize(expr) {
  const tokens = [];
  let i = 0;
  const s = expr.replace(/\s+/g, "");

  while (i < s.length) {
    if (/[0-9.]/.test(s[i])) {
      let num = "";
      while (i < s.length && /[0-9.]/.test(s[i])) num += s[i++];
      tokens.push({ type: "NUM", value: parseFloat(num) });
      continue;
    }
    if (/[a-zA-Z]/.test(s[i])) {
      let id = "";
      while (i < s.length && /[a-zA-Z0-9]/.test(s[i])) id += s[i++];
      tokens.push({ type: "ID", value: id });
      continue;
    }
    if ("+-*/^()".includes(s[i])) {
      tokens.push({ type: s[i] }); i++; continue;
    }
    throw new Error(`Unexpected: '${s[i]}'`);
  }
  tokens.push({ type: "EOF" });
  return tokens;
}

// ---------- Parser → AST ----------

function parse(expr) {
  const toks = tokenize(expr);
  let pos = 0;
  const peek = () => toks[pos];
  const consume = (t) => { if (t && toks[pos].type !== t) throw new Error(`Expected ${t}`); return toks[pos++]; };

  const KNOWN_FNS = ["sin","cos","tan","asin","acos","atan","sinh","cosh","tanh","ln","log","log2","log10","exp","sqrt","abs"];
  const CONSTANTS = { pi: Math.PI, e: Math.E, tau: Math.PI * 2, phi: (1 + Math.sqrt(5)) / 2 };

  function parseExpr() {
    let left = parseTerm();
    while (peek().type === "+" || peek().type === "-") {
      const op = consume().type;
      left = BinOp(op, left, parseTerm());
    }
    return left;
  }

  function parseTerm() {
    let left = parseUnary();
    while (peek().type === "*" || peek().type === "/") {
      const op = consume().type;
      left = BinOp(op, left, parseUnary());
    }
    return left;
  }

  function parseUnary() {
    if (peek().type === "-") { consume(); return BinOp("*", Num(-1), parsePower()); }
    if (peek().type === "+") { consume(); }
    return parsePower();
  }

  function parsePower() {
    let base = parseImplicitMul();
    if (peek().type === "^") { consume(); base = BinOp("^", base, parseUnary()); }
    return base;
  }

  function parseImplicitMul() {
    let left = parsePrimary();
    // implicit multiplication: 2x, 2sin(x), x(...)
    while (peek().type === "NUM" || peek().type === "ID" || peek().type === "(") {
      left = BinOp("*", left, parsePrimary());
    }
    return left;
  }

  function parsePrimary() {
    const t = peek();

    if (t.type === "NUM") { consume(); return Num(t.value); }

    if (t.type === "ID") {
      consume();
      if (KNOWN_FNS.includes(t.value) && peek().type === "(") {
        consume("(");
        const arg = parseExpr();
        consume(")");
        return FnCall(t.value, arg);
      }
      if (t.value in CONSTANTS) return Num(CONSTANTS[t.value]);
      return Var(t.value);
    }

    if (t.type === "(") {
      consume();
      const e = parseExpr();
      consume(")");
      return e;
    }

    throw new Error(`Unexpected: ${t.type}`);
  }

  const ast = parseExpr();
  if (peek().type !== "EOF") throw new Error("Unexpected tokens after expression");
  return ast;
}

// ---------- Differentiation ----------

function diff(node, v) {
  switch (node.type) {
    case "num": return Num(0);
    case "var": return Num(node.name === v ? 1 : 0);
    case "binop": {
      const { op, left, right } = node;
      if (op === "+") return BinOp("+", diff(left, v), diff(right, v));
      if (op === "-") return BinOp("-", diff(left, v), diff(right, v));
      if (op === "*") // product rule
        return BinOp("+", BinOp("*", diff(left, v), right), BinOp("*", left, diff(right, v)));
      if (op === "/") // quotient rule
        return BinOp("/",
          BinOp("-", BinOp("*", diff(left, v), right), BinOp("*", left, diff(right, v))),
          BinOp("^", right, Num(2)));
      if (op === "^") {
        const baseHasVar = hasVar(left, v);
        const expHasVar = hasVar(right, v);
        if (!baseHasVar && !expHasVar) return Num(0);
        if (baseHasVar && !expHasVar) {
          // power rule: d/dx[f^n] = n*f^(n-1)*f'
          return BinOp("*", BinOp("*", right, BinOp("^", left, BinOp("-", right, Num(1)))), diff(left, v));
        }
        if (!baseHasVar && expHasVar) {
          // d/dx[a^g] = a^g * ln(a) * g'
          return BinOp("*", BinOp("*", node, FnCall("ln", left)), diff(right, v));
        }
        // general: d/dx[f^g] = f^g * (g'*ln(f) + g*f'/f)
        return BinOp("*", node, BinOp("+",
          BinOp("*", diff(right, v), FnCall("ln", left)),
          BinOp("*", right, BinOp("/", diff(left, v), left))));
      }
      break;
    }
    case "fn": {
      const { name, arg } = node;
      const inner = diff(arg, v); // chain rule
      let outer;
      switch (name) {
        case "sin":  outer = FnCall("cos", arg); break;
        case "cos":  outer = BinOp("*", Num(-1), FnCall("sin", arg)); break;
        case "tan":  outer = BinOp("^", FnCall("cos", arg), Num(-2)); break;
        case "asin": outer = BinOp("/", Num(1), FnCall("sqrt", BinOp("-", Num(1), BinOp("^", arg, Num(2))))); break;
        case "acos": outer = BinOp("/", Num(-1), FnCall("sqrt", BinOp("-", Num(1), BinOp("^", arg, Num(2))))); break;
        case "atan": outer = BinOp("/", Num(1), BinOp("+", Num(1), BinOp("^", arg, Num(2)))); break;
        case "sinh": outer = FnCall("cosh", arg); break;
        case "cosh": outer = FnCall("sinh", arg); break;
        case "tanh": outer = BinOp("^", FnCall("cosh", arg), Num(-2)); break;
        case "ln": case "log":
          outer = BinOp("/", Num(1), arg); break;
        case "log2":
          outer = BinOp("/", Num(1), BinOp("*", arg, FnCall("ln", Num(2)))); break;
        case "log10":
          outer = BinOp("/", Num(1), BinOp("*", arg, FnCall("ln", Num(10)))); break;
        case "exp":  outer = FnCall("exp", arg); break;
        case "sqrt": outer = BinOp("/", Num(1), BinOp("*", Num(2), FnCall("sqrt", arg))); break;
        case "abs":  outer = BinOp("/", arg, FnCall("abs", arg)); break;
        default: throw new Error(`Cannot differentiate: ${name}()`);
      }
      return BinOp("*", outer, inner);
    }
  }
  throw new Error("Cannot differentiate this expression");
}

function hasVar(node, v) {
  if (node.type === "var") return node.name === v;
  if (node.type === "num") return false;
  if (node.type === "fn") return hasVar(node.arg, v);
  if (node.type === "binop") return hasVar(node.left, v) || hasVar(node.right, v);
  return false;
}

// ---------- Simplify ----------

function simplify(node) {
  if (node.type === "num" || node.type === "var") return node;

  if (node.type === "fn") {
    const arg = simplify(node.arg);
    if (arg.type === "num") {
      const fns = { sin: Math.sin, cos: Math.cos, tan: Math.tan, ln: Math.log, log: Math.log, exp: Math.exp, sqrt: Math.sqrt, abs: Math.abs, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh };
      if (fns[node.name]) return Num(fns[node.name](arg.value));
    }
    return FnCall(node.name, arg);
  }

  if (node.type === "binop") {
    let l = simplify(node.left);
    let r = simplify(node.right);
    const { op } = node;

    // Constant folding
    if (l.type === "num" && r.type === "num") {
      if (op === "+") return Num(l.value + r.value);
      if (op === "-") return Num(l.value - r.value);
      if (op === "*") return Num(l.value * r.value);
      if (op === "/" && r.value !== 0) return Num(l.value / r.value);
      if (op === "^") return Num(Math.pow(l.value, r.value));
    }

    // Identity simplifications
    if (op === "+") {
      if (l.type === "num" && l.value === 0) return r;
      if (r.type === "num" && r.value === 0) return l;
    }
    if (op === "-") {
      if (r.type === "num" && r.value === 0) return l;
    }
    if (op === "*") {
      if (l.type === "num" && l.value === 0) return Num(0);
      if (r.type === "num" && r.value === 0) return Num(0);
      if (l.type === "num" && l.value === 1) return r;
      if (r.type === "num" && r.value === 1) return l;
      if (l.type === "num" && l.value === -1) return BinOp("*", Num(-1), r);
    }
    if (op === "/") {
      if (l.type === "num" && l.value === 0) return Num(0);
      if (r.type === "num" && r.value === 1) return l;
    }
    if (op === "^") {
      if (r.type === "num" && r.value === 0) return Num(1);
      if (r.type === "num" && r.value === 1) return l;
    }

    return BinOp(op, l, r);
  }

  return node;
}

// ---------- AST → string ----------

function toString(node, parentOp, side) {
  if (node.type === "num") {
    const v = node.value;
    if (v < 0) return `(${v})`;
    if (v === Math.PI) return "π";
    if (v === Math.E) return "e";
    return fmt(v);
  }
  if (node.type === "var") return node.name;
  if (node.type === "fn") return `${node.name}(${toString(node.arg)})`;
  if (node.type === "binop") {
    const { op, left, right } = node;
    const ls = toString(left, op, "l");
    const rs = toString(right, op, "r");

    const needParens = parentOp && (
      (parentOp === "*" && (op === "+" || op === "-")) ||
      (parentOp === "/" && (op === "+" || op === "-") && side === "r") ||
      (parentOp === "^" && side === "l" && (op === "+" || op === "-" || op === "*" || op === "/")) ||
      (parentOp === "^" && side === "r" && op !== "num")
    );

    let s;
    if (op === "*") {
      // Smart multiplication display
      if (left.type === "num" && left.value === -1) s = `-${rs}`;
      else if (right.type === "var" || right.type === "fn") s = `${ls}·${rs}`;
      else s = `${ls} * ${rs}`;
    } else if (op === "^") {
      s = `${ls}^${rs}`;
    } else {
      s = `${ls} ${op} ${rs}`;
    }

    return needParens ? `(${s})` : s;
  }
  return "?";
}

// ---------- Main ----------

async function main() {
  const input = await readInput();
  const query = stripKeyword(input.query || "", "derive", "derivative", "der", "d");

  if (!query) {
    writeResponse(detail(
      `<div style="font-family:monospace;padding:16px">
        <h2 style="margin:0 0 12px">Symbolic Derivative</h2>
        <p style="color:#888;margin:0 0 8px">d/dx of any expression</p>
        <code style="display:block;padding:2px 0">math der x^3+2x</code>
        <code style="display:block;padding:2px 0">math der sin(x^2)</code>
        <code style="display:block;padding:2px 0">math der ln(x)+exp(2x)</code>
        <code style="display:block;padding:2px 0">math der sqrt(x)</code>
        <p style="color:#666;margin:8px 0 0;font-size:12px">Supports: polynomials, trig, exp, log, chain rule, product/quotient rule</p>
      </div>`
    ));
    return;
  }

  try {
    const ast = parse(query);
    const derived = diff(ast, "x");
    const simplified = simplify(simplify(simplify(derived))); // multi-pass
    const resultStr = toString(simplified);

    // Numerical check at x=1
    const atOne = evaluateAST(simplified, { x: 1 });

    const md = `<div style="font-family:monospace;padding:16px">
      <div style="font-size:14px;color:#888;margin-bottom:4px">d/dx [ ${escHtml(query)} ]</div>
      <div style="font-size:24px;font-weight:bold;color:#FFB74D;margin:12px 0">= ${escHtml(resultStr)}</div>
      <div style="font-size:12px;color:#666;margin-top:8px">f'(1) = ${escHtml(fmt(atOne))}</div>
    </div>`;

    writeResponse(detail(md, [
      { label: "f(x)", value: query },
      { label: "f'(x)", value: resultStr },
      { label: "f'(1)", value: fmt(atOne) },
    ], [
      { title: "Copy derivative", type: "copy", value: resultStr },
      { title: "Plot f'(x)", type: "yoki_run", value: `math plot ${resultStr.replace(/·/g, "*")} -5 5` },
    ]));
  } catch (err) {
    writeResponse(error("Differentiation error", err.message));
  }
}

function evaluateAST(node, vars) {
  if (node.type === "num") return node.value;
  if (node.type === "var") return vars[node.name] ?? 0;
  if (node.type === "fn") {
    const a = evaluateAST(node.arg, vars);
    const fns = { sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, ln: Math.log, log: Math.log, log2: Math.log2, log10: Math.log10, exp: Math.exp, sqrt: Math.sqrt, abs: Math.abs };
    if (fns[node.name]) return fns[node.name](a);
    throw new Error(`Unknown function: ${node.name}`);
  }
  if (node.type === "binop") {
    const l = evaluateAST(node.left, vars);
    const r = evaluateAST(node.right, vars);
    if (node.op === "+") return l + r;
    if (node.op === "-") return l - r;
    if (node.op === "*") return l * r;
    if (node.op === "/") return l / r;
    if (node.op === "^") return Math.pow(l, r);
  }
  return 0;
}

function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

main();
