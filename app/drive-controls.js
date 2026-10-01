/** Stable four-way input. The dead zone prevents accidental turns near the centre. */
export function directionFromVector(dx, dy, previous = null, deadZone = 12) {
  if (Math.hypot(dx, dy) < deadZone) return null;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if ((previous === 'e' && dx > 0 || previous === 'w' && dx < 0) && ax * 1.22 >= ay) return previous;
  if ((previous === 'n' && dy < 0 || previous === 's' && dy > 0) && ay * 1.22 >= ax) return previous;
  return ax > ay ? dx > 0 ? 'e' : 'w' : dy > 0 ? 's' : 'n';
}

/** Snap short gaps in a finger-drawn route to connected roads, never through walls. */
export function connectedPath(cells, from, to, maxEdges = 2) {
  if (!cells[from] || !cells[to]) return null;
  const queue = [[from]], seen = new Set([from]);
  for (const path of queue) {
    const end = path.at(-1);
    if (end === to) return path;
    if (path.length > maxEdges) continue;
    for (const next of Object.values(cells[end].links)) {
      if (!seen.has(next)) { seen.add(next); queue.push([...path, next]); }
    }
  }
  return null;
}

export function extendDrawnRoute(cells, route, target) {
  if (!route.length || target === route.at(-1)) return route;
  const previous = route.lastIndexOf(target);
  if (previous >= 0) return route.slice(0, previous + 1);
  const extension = connectedPath(cells, route.at(-1), target, 2);
  return extension ? [...route, ...extension.slice(1)] : route;
}

/** Shared by touch, keyboard, and the drawn route. Releasing stops at the next node. */
export function nextDriveDirection(cells, state, drive) {
  const links = cells[state.current].links;
  if (drive.routeActive) {
    while (drive.route[0] === state.current) drive.route.shift();
    const next = drive.route.shift();
    if (next !== undefined) return Object.keys(links).find(dir => links[dir] === next) ?? null;
    drive.routeActive = false;
    return null;
  }
  if (drive.held) {
    state.buffer = null;
    if (links[drive.held] !== undefined) return drive.held;
    const reverse = {n:'s', e:'w', s:'n', w:'e'}[state.heading];
    if (drive.held !== reverse && links[state.heading] !== undefined && links[state.heading] !== state.prev) return state.heading;
    return null;
  }
  const queued = state.buffer;
  state.buffer = null;
  return queued && links[queued] !== undefined ? queued : null;
}

export function validateRoadRoute(cells, route, anchor) {
  if (!Array.isArray(route) || route.length < 2 || route.length > 200 || route[0] !== anchor) return false;
  return route.every((id, index) => Number.isInteger(id) && cells[id] &&
    (index === 0 || Object.values(cells[route[index - 1]].links).includes(id)));
}
