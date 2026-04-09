#!/usr/bin/env node
/**
 * plot — ASCII function graph (detail mode)
 *
 * Usage: math plot sin(x) -pi pi
 *        math plot x^2 -5 5
 *        math plot exp(-x^2) -3 3
 */
"use strict";

const { readInput, writeResponse, detail, error, stripKeyword, evaluate, fmt } = require("./lib");

const WIDTH = 60;
const HEIGHT = 20;

async function main() {
  const input = await readInput();
  const query = stripKeyword(input.query || "", "plot", "graph", "p");

  if (!query) {
    writeResponse(detail(
      `<div style="font-family:monospace;padding:16px">
        <h2 style="margin:0 0 12px">Function Plot</h2>
        <p style="color:#888;margin:0 0 8px">ASCII graph of f(x)</p>
        <code style="display:block;padding:2px 0">math plot sin(x) -pi pi</code>
        <code style="display:block;padding:2px 0">math plot x^2 -5 5</code>
        <code style="display:block;padding:2px 0">math plot exp(-x^2) -3 3</code>
        <code style="display:block;padding:2px 0">math plot ln(x) 0.1 10</code>
        <p style="color:#666;margin:8px 0 0;font-size:12px">Format: &lt;expression in x&gt; &lt;x_min&gt; &lt;x_max&gt;</p>
      </div>`
    ));
    return;
  }

  const parts = query.trim().split(/\s+/);
  if (parts.length < 3) {
    writeResponse(error("Need: expression x_min x_max", "Example: sin(x) -pi pi"));
    return;
  }

  const xMaxStr = parts.pop();
  const xMinStr = parts.pop();
  const funcStr = parts.join(" ");

  try {
    const xMin = evaluate(xMinStr);
    const xMax = evaluate(xMaxStr);

    if (xMin >= xMax) {
      writeResponse(error("x_min must be less than x_max"));
      return;
    }

    const f = (x) => evaluate(funcStr, { x });

    // Sample the function
    const values = [];
    const xs = [];
    for (let i = 0; i <= WIDTH; i++) {
      const x = xMin + (xMax - xMin) * (i / WIDTH);
      xs.push(x);
      try {
        const y = f(x);
        values.push(isFinite(y) ? y : null);
      } catch {
        values.push(null);
      }
    }

    // Find y range (ignoring nulls)
    const valid = values.filter((v) => v !== null);
    if (valid.length === 0) {
      writeResponse(error("Function is undefined in this range"));
      return;
    }

    let yMin = Math.min(...valid);
    let yMax = Math.max(...valid);

    // Add some padding
    if (yMin === yMax) { yMin -= 1; yMax += 1; }
    const yPad = (yMax - yMin) * 0.05;
    yMin -= yPad;
    yMax += yPad;

    // Build the grid
    const grid = [];
    for (let row = 0; row < HEIGHT; row++) {
      grid.push(new Array(WIDTH + 1).fill(" "));
    }

    // Plot points
    for (let col = 0; col <= WIDTH; col++) {
      if (values[col] === null) continue;
      const row = Math.round((1 - (values[col] - yMin) / (yMax - yMin)) * (HEIGHT - 1));
      if (row >= 0 && row < HEIGHT) {
        grid[row][col] = "●";
      }
    }

    // Draw zero axes if in range
    const zeroRow = Math.round((1 - (0 - yMin) / (yMax - yMin)) * (HEIGHT - 1));
    if (zeroRow >= 0 && zeroRow < HEIGHT) {
      for (let col = 0; col <= WIDTH; col++) {
        if (grid[zeroRow][col] === " ") grid[zeroRow][col] = "─";
      }
    }
    const zeroCol = Math.round(((0 - xMin) / (xMax - xMin)) * WIDTH);
    if (zeroCol >= 0 && zeroCol <= WIDTH) {
      for (let row = 0; row < HEIGHT; row++) {
        if (grid[row][zeroCol] === " ") grid[row][zeroCol] = "│";
        else if (grid[row][zeroCol] === "─") grid[row][zeroCol] = "┼";
      }
    }

    // Render to string with y-axis labels
    const lines = [];
    for (let row = 0; row < HEIGHT; row++) {
      const y = yMax - (yMax - yMin) * (row / (HEIGHT - 1));
      const label = (row === 0 || row === HEIGHT - 1 || row === zeroRow)
        ? fmt(y).padStart(8)
        : "        ";
      lines.push(`${label} ┃${grid[row].join("")}`);
    }
    // X-axis labels
    lines.push("         ┗" + "━".repeat(WIDTH + 1));
    const xMinLabel = fmt(xMin);
    const xMaxLabel = fmt(xMax);
    lines.push(`         ${xMinLabel}${" ".repeat(Math.max(1, WIDTH + 1 - xMinLabel.length - xMaxLabel.length))}${xMaxLabel}`);

    const plotStr = lines.join("\n");

    const md = `<div style="font-family:monospace;padding:16px">
      <div style="font-size:14px;color:#888;margin-bottom:8px">f(x) = ${escHtml(funcStr)}</div>
      <pre style="font-size:11px;line-height:1.2;color:#4FC3F7;margin:0">${escHtml(plotStr)}</pre>
    </div>`;

    writeResponse(detail(md, [
      { label: "f(x)", value: funcStr },
      { label: "x range", value: `[${fmt(xMin)}, ${fmt(xMax)}]` },
      { label: "y range", value: `[${fmt(yMin)}, ${fmt(yMax)}]` },
    ], [
      { title: "Integrate", type: "yoki_run", value: `math int ${funcStr} ${xMinStr} ${xMaxStr}` },
      { title: "Derivative", type: "yoki_run", value: `math der ${funcStr}` },
    ]));
  } catch (err) {
    writeResponse(error("Plot error", err.message));
  }
}

function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

main();
