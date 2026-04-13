#!/usr/bin/env node
/**
 * trig — trigonometry calculator (detail mode)
 *
 * Usage: math trig sin(45)        — assumes degrees
 *        math trig cos(pi/3) rad  — explicit radians
 *        math trig table 30       — all functions for an angle
 */
"use strict";

const { readInput, writeResponse, detail, error, stripKeyword, evaluate, fmt, escHtml } = require("./lib");

const TRIG_FNS = [
  { name: "sin",  fn: Math.sin,  inv: "asin" },
  { name: "cos",  fn: Math.cos,  inv: "acos" },
  { name: "tan",  fn: Math.tan,  inv: "atan" },
  { name: "csc",  fn: (x) => 1 / Math.sin(x), inv: null },
  { name: "sec",  fn: (x) => 1 / Math.cos(x), inv: null },
  { name: "cot",  fn: (x) => 1 / Math.tan(x), inv: null },
];

/**
 * Parenthesis-aware function wrapper.
 * Finds each call matching `pattern` (a regex like /\b(sin|cos|...)\s*\(/gi),
 * locates the balanced closing `)`, extracts the full inner argument, and
 * delegates to `wrapper(fnName, innerArg)` for the replacement string.
 * Processes matches from end-to-start so splice indices stay valid.
 */
function wrapFunctions(expr, pattern, wrapper) {
  const matches = [];
  let m;
  pattern.lastIndex = 0;
  while ((m = pattern.exec(expr)) !== null) {
    matches.push({ index: m.index, fn: m[1], afterParen: m.index + m[0].length });
  }

  // Work backwards to avoid index shifting
  for (let i = matches.length - 1; i >= 0; i--) {
    const { index, fn, afterParen } = matches[i];
    // Walk forward from the char after '(' counting balanced parens
    let depth = 1, j = afterParen;
    while (j < expr.length && depth > 0) {
      if (expr[j] === '(') depth++;
      if (expr[j] === ')') depth--;
      j++;
    }
    if (depth !== 0) continue; // unmatched parens — skip

    const innerArg = expr.slice(afterParen, j - 1);
    const replacement = wrapper(fn, innerArg);
    expr = expr.slice(0, index) + replacement + expr.slice(j);
  }

  return expr;
}

/**
 * Convert a trig expression from degree mode to radian mode.
 * Handles nested calls like sin(cos(45)) by scanning balanced parens
 * instead of the old [^)]+ regex that broke on nested expressions.
 */
function wrapTrigDegrees(expr) {
  const ATRIG = /\b(asin|acos|atan)\s*\(/gi;
  const TRIG  = /\b(sin|cos|tan|csc|sec|cot)\s*\(/gi;

  // First pass: wrap inverse trig results (rad -> deg)
  expr = wrapFunctions(expr, ATRIG, (fn, innerArg) => {
    return `(${fn}(${innerArg})*180/${Math.PI})`;
  });

  // Second pass: wrap direct trig args (deg -> rad)
  expr = wrapFunctions(expr, TRIG, (fn, innerArg) => {
    return `${fn}((${innerArg})*${Math.PI}/180)`;
  });

  return expr;
}

async function main() {
  const input = await readInput();
  let query = stripKeyword(input.query || "", "trig", "t");

  if (!query) {
    writeResponse(detail(
      `<div style="font-family:monospace;padding:16px">
        <h2 style="margin:0 0 12px">Trigonometry</h2>
        <p style="color:#888;margin:0 0 8px">Evaluate trig functions (degrees by default)</p>
        <code style="display:block;padding:2px 0">math trig sin(45)</code>
        <code style="display:block;padding:2px 0">math trig cos(pi/3) rad</code>
        <code style="display:block;padding:2px 0">math trig table 60</code>
      </div>`,
      [
        { label: "Functions", value: "sin  cos  tan  csc  sec  cot" },
        { label: "Inverse", value: "asin  acos  atan" },
        { label: "Default", value: "Degrees (add 'rad' for radians)" },
      ]
    ));
    return;
  }

  // Check for "table" subcommand: trig table 45
  const tableMatch = query.match(/^table\s+(.+)/i);
  if (tableMatch) {
    return showTable(tableMatch[1]);
  }

  // Detect rad/deg mode
  let isRad = false;
  if (/\brad(ians?)?\s*$/i.test(query)) {
    isRad = true;
    query = query.replace(/\s*rad(ians?)?\s*$/i, "").trim();
  } else if (/\bdeg(rees?)?\s*$/i.test(query)) {
    query = query.replace(/\s*deg(rees?)?\s*$/i, "").trim();
  }

  try {
    // When in degrees mode (default), wrap trig function arguments with
    // degree-to-radian conversion so sin(45) means sin(45°), not sin(45 rad).
    let evalExpr = query;
    if (!isRad) {
      evalExpr = wrapTrigDegrees(query);
    }
    const result = evaluate(evalExpr);
    const modeLabel = isRad ? "radians" : "degrees";

    // If the expression is a single trig function, show extra context
    const fnMatch = query.match(/^(a?(?:sin|cos|tan)h?)\s*\((.+)\)$/i);
    const metadata = [
      { label: "Expression", value: query },
      { label: "Mode", value: modeLabel },
      { label: "Result", value: fmt(result) },
    ];

    // For inverse functions, also show the angle in degrees
    if (fnMatch && fnMatch[1].startsWith("a")) {
      if (isRad) {
        // Result is in radians — show degree conversion
        metadata.push({ label: "Result (deg)", value: fmt(result * 180 / Math.PI) + "°" });
        metadata.push({ label: "Result (rad)", value: fmt(result) + " rad" });
      } else {
        // Result already in degrees (converted by degExpr) — show as-is
        metadata.push({ label: "Result (deg)", value: fmt(result) + "°" });
        metadata.push({ label: "Result (rad)", value: fmt(result * Math.PI / 180) + " rad" });
      }
    }

    const md = `<div style="font-family:monospace;padding:16px">
      <div style="font-size:14px;color:#888;margin-bottom:8px">${escHtml(query)} <span style="color:#666">(${modeLabel})</span></div>
      <div style="font-size:32px;font-weight:bold;color:#81C784">= ${escHtml(fmt(result))}</div>
    </div>`;

    writeResponse(detail(md, metadata, [
      { title: "Copy", type: "copy", value: fmt(result) },
    ]));
  } catch (err) {
    writeResponse(error("Trig error", err.message));
  }
}

function showTable(angleExpr) {
  try {
    const angleDeg = evaluate(angleExpr);
    const angleRad = angleDeg * Math.PI / 180;

    let rows = "";
    for (const { name, fn } of TRIG_FNS) {
      const val = fn(angleRad);
      rows += `<tr><td style="padding:4px 12px 4px 0;color:#81C784;font-weight:bold">${name}</td>` +
              `<td style="padding:4px 0">${fmt(val)}</td></tr>`;
    }

    const md = `<div style="font-family:monospace;padding:16px">
      <h2 style="margin:0 0 4px">Trig Table</h2>
      <div style="font-size:14px;color:#888;margin-bottom:12px">${escHtml(fmt(angleDeg))}° = ${escHtml(fmt(angleRad))} rad</div>
      <table style="border-collapse:collapse">${rows}</table>
    </div>`;

    writeResponse(detail(md, [
      { label: "Angle (deg)", value: fmt(angleDeg) + "°" },
      { label: "Angle (rad)", value: fmt(angleRad) },
    ], [
      { title: "Copy table", type: "copy", value: TRIG_FNS.map(f => `${f.name}(${fmt(angleDeg)}°) = ${fmt(f.fn(angleRad))}`).join("\n") },
    ]));
  } catch (err) {
    writeResponse(error("Trig table error", err.message));
  }
}

// When required as a module, export helpers for testing
if (require.main === module) {
  main().catch(e => { try { writeResponse(error("Error", e.message)); } catch(_) {} process.exit(1); });
}

module.exports = { wrapFunctions, wrapTrigDegrees, TRIG_FNS };
