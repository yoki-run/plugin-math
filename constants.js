#!/usr/bin/env node
/**
 * constants — mathematical constants & formulas reference (list mode)
 *
 * Usage: math const
 */
"use strict";

const { readInput, writeResponse, listResponse, stripKeyword } = require("./lib");

const CATEGORIES = [
  {
    name: "Fundamental Constants",
    items: [
      { id: "pi",     title: "π (Pi)",              value: "3.14159265358979", desc: "Ratio of circumference to diameter" },
      { id: "e",      title: "e (Euler's number)",   value: "2.71828182845905", desc: "Base of natural logarithm" },
      { id: "tau",    title: "τ (Tau)",              value: "6.28318530717959", desc: "2π — full circle in radians" },
      { id: "phi",    title: "φ (Golden ratio)",     value: "1.61803398874989", desc: "(1 + √5) / 2" },
      { id: "sqrt2",  title: "√2",                   value: "1.41421356237310", desc: "Pythagorean constant" },
      { id: "sqrt3",  title: "√3",                   value: "1.73205080756888", desc: "Theodorus' constant" },
      { id: "ln2",    title: "ln(2)",                value: "0.69314718055995", desc: "Natural log of 2" },
      { id: "ln10",   title: "ln(10)",               value: "2.30258509299405", desc: "Natural log of 10" },
    ],
  },
  {
    name: "Physics Constants",
    items: [
      { id: "c",       title: "c (Speed of light)",        value: "299792458 m/s",        desc: "In vacuum" },
      { id: "G",       title: "G (Gravitational)",          value: "6.674×10⁻¹¹ N⋅m²/kg²", desc: "Newton's gravitational constant" },
      { id: "h",       title: "h (Planck)",                 value: "6.626×10⁻³⁴ J⋅s",      desc: "Planck's constant" },
      { id: "Na",      title: "Nₐ (Avogadro)",             value: "6.022×10²³ mol⁻¹",     desc: "Avogadro's number" },
      { id: "kb",      title: "kB (Boltzmann)",             value: "1.381×10⁻²³ J/K",      desc: "Boltzmann constant" },
    ],
  },
  {
    name: "Key Formulas",
    items: [
      { id: "euler",     title: "Euler's identity",           value: "e^(iπ) + 1 = 0",            desc: "The most beautiful equation" },
      { id: "pyth",      title: "Pythagorean theorem",        value: "a² + b² = c²",               desc: "Right triangle sides" },
      { id: "quad",      title: "Quadratic formula",          value: "x = (-b ± √(b²-4ac)) / 2a", desc: "Roots of ax² + bx + c = 0" },
      { id: "circarea",  title: "Circle area",                value: "A = πr²",                    desc: "Area of a circle" },
      { id: "spherevol", title: "Sphere volume",              value: "V = (4/3)πr³",               desc: "Volume of a sphere" },
      { id: "intbyparts",title: "Integration by parts",       value: "∫u dv = uv − ∫v du",         desc: "Fundamental integration technique" },
      { id: "chainrule", title: "Chain rule",                 value: "[f(g(x))]' = f'(g(x))·g'(x)",desc: "Composite function derivative" },
      { id: "taylor",    title: "Taylor series",              value: "f(x) = Σ f⁽ⁿ⁾(a)(x−a)ⁿ/n!", desc: "Function expansion around a point" },
    ],
  },
  {
    name: "Trig Identities",
    items: [
      { id: "sin2cos2", title: "Pythagorean identity",   value: "sin²(x) + cos²(x) = 1",        desc: "Fundamental trig identity" },
      { id: "sin2x",    title: "Double angle (sin)",      value: "sin(2x) = 2sin(x)cos(x)",      desc: "Sine double angle" },
      { id: "cos2x",    title: "Double angle (cos)",      value: "cos(2x) = cos²(x) − sin²(x)",  desc: "Cosine double angle" },
      { id: "eulform",  title: "Euler's formula",         value: "e^(ix) = cos(x) + i·sin(x)",   desc: "Bridge between exp and trig" },
    ],
  },
];

async function main() {
  const input = await readInput();
  const query = stripKeyword(input.query || "", "const", "constants", "ref", "c").toLowerCase();

  const items = [];
  for (const cat of CATEGORIES) {
    for (const item of cat.items) {
      // Filter by query if present
      if (query && !item.title.toLowerCase().includes(query) &&
          !item.desc.toLowerCase().includes(query) &&
          !item.id.toLowerCase().includes(query) &&
          !cat.name.toLowerCase().includes(query)) {
        continue;
      }

      items.push({
        id: item.id,
        title: item.title,
        subtitle: `${item.value}  ·  ${item.desc}`,
        icon: cat.name.startsWith("Fund") ? "π" :
              cat.name.startsWith("Phys") ? "⚛" :
              cat.name.startsWith("Key")  ? "∫" : "△",
        category: cat.name,
        actions: [
          { title: "Copy value", shortcut: "enter", type: "copy", value: item.value },
          { title: "Calculate", shortcut: "cmd+c", type: "yoki_run", value: `math ${item.value}` },
        ],
      });
    }
  }

  writeResponse(listResponse(items));
}

main();
