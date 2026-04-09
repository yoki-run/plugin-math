#!/usr/bin/env node
/**
 * integrate — numerical integration via adaptive Simpson's rule (detail mode)
 *
 * Usage: math int x^2 0 10
 *        math int sin(x) 0 pi
 *        math int 1/x 1 e
 */
"use strict";

const { readInput, writeResponse, detail, error, stripKeyword, evaluate, fmt } = require("./lib");

async function main() {
  const input = await readInput();
  const query = stripKeyword(input.query || "", "integrate", "int", "i");

  if (!query) {
    writeResponse(detail(
      `<div style="font-family:monospace;padding:16px">
        <h2 style="margin:0 0 12px">Numerical Integration</h2>
        <p style="color:#888;margin:0 0 8px">∫ f(x) dx from a to b &mdash; Simpson's rule</p>
        <code style="display:block;padding:2px 0">math int x^2 0 10</code>
        <code style="display:block;padding:2px 0">math int sin(x) 0 pi</code>
        <code style="display:block;padding:2px 0">math int 1/x 1 e</code>
        <code style="display:block;padding:2px 0">math int exp(-x^2) -3 3</code>
        <p style="color:#666;margin:8px 0 0;font-size:12px">Format: &lt;expression in x&gt; &lt;lower&gt; &lt;upper&gt;</p>
      </div>`
    ));
    return;
  }

  // Parse: last two tokens are bounds, everything before is the function
  const parts = query.trim().split(/\s+/);
  if (parts.length < 3) {
    writeResponse(error("Need: expression lower upper", "Example: x^2 0 10"));
    return;
  }

  const upperStr = parts.pop();
  const lowerStr = parts.pop();
  const funcStr = parts.join(" ");

  try {
    const a = evaluate(lowerStr);
    const b = evaluate(upperStr);

    const f = (x) => evaluate(funcStr, { x });

    // Test that the function works
    f((a + b) / 2);

    const result = simpson(f, a, b, 10000);

    const md = `<div style="font-family:monospace;padding:16px">
      <div style="font-size:14px;color:#888;margin-bottom:4px">
        ∫ <span style="color:#CE93D8">${escHtml(funcStr)}</span> dx
      </div>
      <div style="font-size:12px;color:#666;margin-bottom:12px">
        from ${escHtml(fmt(a))} to ${escHtml(fmt(b))}
      </div>
      <div style="font-size:32px;font-weight:bold;color:#CE93D8">≈ ${escHtml(fmt(result))}</div>
    </div>`;

    writeResponse(detail(md, [
      { label: "f(x)", value: funcStr },
      { label: "Interval", value: `[${fmt(a)}, ${fmt(b)}]` },
      { label: "Result", value: fmt(result) },
      { label: "Method", value: "Composite Simpson's rule (n=10000)" },
    ], [
      { title: "Copy result", type: "copy", value: fmt(result) },
      { title: "Plot", type: "yoki_run", value: `math plot ${funcStr} ${lowerStr} ${upperStr}` },
    ]));
  } catch (err) {
    writeResponse(error("Integration error", err.message));
  }
}

/**
 * Composite Simpson's 1/3 rule.
 */
function simpson(f, a, b, n) {
  if (n % 2 !== 0) n++;
  const h = (b - a) / n;
  let sum = f(a) + f(b);

  for (let i = 1; i < n; i++) {
    const x = a + i * h;
    sum += f(x) * (i % 2 === 0 ? 2 : 4);
  }

  return (h / 3) * sum;
}

function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

main();
