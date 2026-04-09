# yoki-plugin-math

Advanced math calculator for [Yoki](https://yoki.run) — trigonometry, integrals, derivatives, plots, and constants reference.

**Language:** JavaScript (Node.js, pure stdlib — zero dependencies)

## Install

```
git clone <repo-url> ~/yoki/plugins/math
```

Requires: **Yoki >= 1.0.4.0**, **Node.js >= 14**

## Commands

| Trigger | Command | Mode | Description |
|---------|---------|------|-------------|
| `math <expr>` | calc | detail | Evaluate any expression |
| `math trig <expr>` | trig | detail | Trig with deg/rad support |
| `math int <f(x)> <a> <b>` | integrate | detail | Numerical integration (Simpson) |
| `math der <f(x)>` | derive | detail | Symbolic differentiation |
| `math plot <f(x)> <min> <max>` | plot | detail | ASCII function graph |
| `math const` | constants | list | Constants & formulas reference |

## Examples

```
math 2^8 + sqrt(144)          → 268
math sin(pi/4)^2 + cos(pi/4)^2 → 1
math log2(1024)                → 10
math 10!                       → 3628800
math trig table 60             → all trig values for 60°
math int x^2 0 10              → ≈ 333.333
math der sin(x^2)              → cos(x^2)·2x
math plot sin(x) -pi pi        → ASCII sine wave
math const                     → π, e, φ, formulas...
```

## Features

- **Safe evaluator** — recursive descent parser, no `eval()`
- **Implicit multiplication** — `2pi`, `3(4+5)`, `2x`
- **Factorial** — `5!` = 120
- **All trig functions** — sin, cos, tan, csc, sec, cot + inverses + hyperbolic
- **Logarithms** — ln, log2, log10
- **Symbolic derivatives** — chain rule, product rule, quotient rule, power rule
- **Numerical integration** — composite Simpson's rule (n=10000)
- **ASCII plots** — with zero-axes, y-labels, proper scaling
- **Constants reference** — math + physics + formulas + trig identities
- **Cross-command actions** — derive → plot, integrate → plot, etc.

## SDK v2 Showcase

This plugin demonstrates the Yoki Plugin SDK v2 in **JavaScript/Node.js**:

| Feature | File |
|---------|------|
| Detail mode with rich HTML | calc.js, trig.js, integrate.js, derive.js, plot.js |
| List mode with categories | constants.js |
| Metadata sidebar | all commands |
| Copy action | calc.js, trig.js, derive.js |
| Cross-plugin `yoki_run` actions | integrate.js ↔ plot.js ↔ derive.js |
| Query parsing | all commands |
| Zero dependencies | pure Node.js stdlib |

## File Layout

```
yoki-plugin-math/
├── plugin.json      manifest (v2 protocol)
├── lib.js           SDK helpers + safe math evaluator
├── calc.js          general calculator
├── trig.js          trigonometry
├── integrate.js     numerical integration
├── derive.js        symbolic differentiation
├── plot.js          ASCII function plotter
├── constants.js     constants & formulas reference
├── LICENSE          MIT
└── README.md
```
