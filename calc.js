#!/usr/bin/env node
/**
 * calc — general-purpose expression evaluator (detail mode)
 *
 * Usage: math 2^8 + sqrt(144)
 *        math log2(1024)
 *        math 5!
 *        math 2pi * rad(45)
 */
"use strict";

const { readInput, writeResponse, detail, error, evaluate, fmt } = require("./lib");

async function main() {
  const input = await readInput();
  const query = (input.query || "").trim();

  if (!query) {
    writeResponse(detail(
      `<div style="font-family:monospace;padding:16px">
        <h2 style="margin:0 0 12px">Extended Math</h2>
        <p style="color:#888;margin:0 0 8px">Type an expression to evaluate</p>
        <p style="margin:0 0 4px"><b>Examples:</b></p>
        <code style="display:block;padding:2px 0">math 2^8 + sqrt(144)</code>
        <code style="display:block;padding:2px 0">math sin(pi/4)^2 + cos(pi/4)^2</code>
        <code style="display:block;padding:2px 0">math log2(1024)</code>
        <code style="display:block;padding:2px 0">math 10!</code>
        <code style="display:block;padding:2px 0">math phi^2 - phi</code>
      </div>`,
      [
        { label: "Functions", value: "sin cos tan log sqrt exp abs ceil floor fact ..." },
        { label: "Constants", value: "pi  e  tau  phi  inf" },
        { label: "Operators", value: "+  -  *  /  ^  %  !" },
      ],
      [
        { title: "Constants", type: "yoki_run", value: "math const", icon: "📋" },
        { title: "Plot", type: "yoki_run", value: "math plot sin(x) -pi pi", icon: "📈" },
      ]
    ));
    return;
  }

  try {
    const result = evaluate(query);
    const intCheck = Number.isInteger(result) && Math.abs(result) < Number.MAX_SAFE_INTEGER;

    const metadata = [
      { label: "Expression", value: query },
      { label: "Result", value: fmt(result) },
    ];

    // Extra info for integers
    if (intCheck && result >= 0 && result <= 0xFFFFFFFF) {
      metadata.push({ label: "Hex", value: "0x" + result.toString(16).toUpperCase() });
      metadata.push({ label: "Binary", value: "0b" + result.toString(2) });
    }
    if (intCheck && result >= 2 && result <= 1e7) {
      metadata.push({ label: "Prime", value: isPrime(result) ? "Yes" : "No" });
    }

    const md = `<div style="font-family:monospace;padding:16px">
      <div style="font-size:14px;color:#888;margin-bottom:8px">${escHtml(query)}</div>
      <div style="font-size:32px;font-weight:bold;color:#4FC3F7">= ${escHtml(fmt(result))}</div>
    </div>`;

    writeResponse(detail(md, metadata, [
      { title: "Copy result", type: "copy", value: fmt(result) },
    ]));
  } catch (err) {
    writeResponse(error("Calculation error", err.message));
  }
}

function isPrime(n) {
  if (n < 2) return false;
  if (n < 4) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
}

function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

main();
