// Whole-mission line chart for one channel: the mission sol on x, the value on y.
// Thin line, a marker on the latest value, min/max and first/last sol as recessive labels,
// and a crosshair with a readout under the pointer.
const LINE = '#ffb36b';
const INK = 'rgba(255,241,226,.95)';
const MUTED = 'rgba(255,226,196,.6)';
const GRID = 'rgba(255,226,196,.18)';
const SURFACE = '#2a1710';
const PAD = { left: 34, right: 8, top: 14, bottom: 14 };

export function createChart(canvas, channel) {
  const g = canvas.getContext('2d');
  let points = [];
  let hoverX = null;

  canvas.addEventListener('pointermove', (e) => {
    hoverX = e.offsetX;
    draw();
  });
  canvas.addEventListener('pointerleave', () => {
    hoverX = null;
    draw();
  });

  const axisLabel = (v) => v.toFixed(Math.min(channel.decimals, 1));

  function draw() {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || points.length < 2) return; // hidden or not loaded yet
    const dpr = Math.min(devicePixelRatio, 2);
    if (canvas.width !== width * dpr) [canvas.width, canvas.height] = [width * dpr, height * dpr];
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, width, height);

    const sol0 = points[0].sol, sol1 = points.at(-1).sol;
    let lo = Infinity, hi = -Infinity;
    for (const p of points) [lo, hi] = [Math.min(lo, p.value), Math.max(hi, p.value)];
    if (hi === lo) hi = lo + 1;
    const plotW = width - PAD.left - PAD.right, plotH = height - PAD.top - PAD.bottom;
    const x = (sol) => PAD.left + ((sol - sol0) / (sol1 - sol0)) * plotW;
    const y = (v) => PAD.top + (1 - (v - lo) / (hi - lo)) * plotH;

    // Recessive frame: min and max guides with their values
    g.font = '10px system-ui, sans-serif';
    g.fillStyle = MUTED;
    g.strokeStyle = GRID;
    g.lineWidth = 1;
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    for (const v of [lo, hi]) {
      g.beginPath();
      g.moveTo(PAD.left, Math.round(y(v)) + 0.5);
      g.lineTo(width - PAD.right, Math.round(y(v)) + 0.5);
      g.stroke();
      g.fillText(axisLabel(v), PAD.left - 5, y(v));
    }
    g.textBaseline = 'bottom';
    g.textAlign = 'left';
    g.fillText(`Sol ${Math.floor(sol0)}`, PAD.left, height);
    g.textAlign = 'right';
    g.fillText(`Sol ${Math.floor(sol1)}`, width - PAD.right, height);

    // The series
    g.strokeStyle = LINE;
    g.lineWidth = 2;
    g.lineJoin = 'round';
    g.beginPath();
    points.forEach((p, i) => (i ? g.lineTo(x(p.sol), y(p.value)) : g.moveTo(x(p.sol), y(p.value))));
    g.stroke();
    marker(x(sol1), y(points.at(-1).value));

    // Crosshair and readout for the stop nearest to the pointer
    if (hoverX !== null && hoverX >= PAD.left) {
      const sol = sol0 + ((hoverX - PAD.left) / plotW) * (sol1 - sol0);
      const p = nearest(sol);
      g.strokeStyle = MUTED;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(Math.round(x(p.sol)) + 0.5, PAD.top);
      g.lineTo(Math.round(x(p.sol)) + 0.5, height - PAD.bottom);
      g.stroke();
      marker(x(p.sol), y(p.value));
      const text = `Sol ${Math.floor(p.sol)} · ${p.value.toFixed(channel.decimals)} ${channel.unit}`;
      g.textBaseline = 'top';
      g.textAlign = x(p.sol) > width / 2 ? 'right' : 'left';
      const tx = x(p.sol) + (g.textAlign === 'right' ? -6 : 6);
      g.fillStyle = SURFACE;
      const w = g.measureText(text).width;
      g.fillRect(g.textAlign === 'right' ? tx - w - 3 : tx - 3, 0, w + 6, 13);
      g.fillStyle = INK;
      g.fillText(text, tx, 1);
    }
  }

  function marker(cx, cy) {
    g.beginPath();
    g.arc(cx, cy, 4, 0, Math.PI * 2);
    g.fillStyle = LINE;
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = SURFACE;
    g.stroke();
  }

  // Binary search: points are sorted by sol
  function nearest(sol) {
    let a = 0, b = points.length - 1;
    while (b - a > 1) {
      const m = (a + b) >> 1;
      if (points[m].sol < sol) a = m;
      else b = m;
    }
    return Math.abs(points[a].sol - sol) < Math.abs(points[b].sol - sol) ? points[a] : points[b];
  }

  return {
    setPoints(next) {
      points = next;
      draw();
    },
    draw,
  };
}
