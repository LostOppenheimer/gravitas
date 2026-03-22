/**
 * Camera — handles zoom and pan, converts between world and screen coordinates
 */
const Camera = (() => {
  let x      = 0;      // world origin offset
  let y      = 0;
  let zoom   = 1.0;
  let minZ   = 0.05;
  let maxZ   = 20;

  let panning    = false;
  let panStart   = { x: 0, y: 0 };
  let panOrigin  = { x: 0, y: 0 };

  let canvas;

  function init(c) {
    canvas = c;
    x = c.width  / 2;
    y = c.height / 2;
  }

  // world → screen
  function toScreen(wx, wy) {
    return {
      x: (wx - x) * zoom + canvas.width  / 2,
      y: (wy - y) * zoom + canvas.height / 2,
    };
  }

  // screen → world
  function toWorld(sx, sy) {
    return {
      x: (sx - canvas.width  / 2) / zoom + x,
      y: (sy - canvas.height / 2) / zoom + y,
    };
  }

  function applyTransform(ctx) {
    ctx.setTransform(zoom, 0, 0, zoom, canvas.width/2 - x*zoom, canvas.height/2 - y*zoom);
  }

  function resetTransform(ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    const newZoom = Math.min(maxZ, Math.max(minZ, zoom * factor));

    // zoom toward mouse cursor
    const wx = toWorld(e.clientX, e.clientY);
    zoom = newZoom;
    // adjust offset so mouse world pos stays fixed
    const sx2 = toScreen(wx.x, wx.y);
    x -= (sx2.x - e.clientX) / zoom;
    y -= (sx2.y - e.clientY) / zoom;
  }

  function startPan(e) {
    panning = true;
    panStart  = { x: e.clientX, y: e.clientY };
    panOrigin = { x, y };
  }

  function doPan(e) {
    if (!panning) return;
    x = panOrigin.x - (e.clientX - panStart.x) / zoom;
    y = panOrigin.y - (e.clientY - panStart.y) / zoom;
  }

  function endPan() { panning = false; }

  function centerOn(wx, wy) { x = wx; y = wy; }

  function getZoom() { return zoom; }
  function getPos()  { return { x, y }; }
  function isPanning() { return panning; }

  function reset(w, h) {
    x = w / 2; y = h / 2; zoom = 1;
  }

  return { init, toScreen, toWorld, applyTransform, resetTransform,
           onWheel, startPan, doPan, endPan, centerOn,
           getZoom, getPos, isPanning, reset };
})();
