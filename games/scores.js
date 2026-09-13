/**
 * Persisted high scores for the browser games (localStorage).
 */
(function (global) {
  var PREFIX = 'ey-games-best-';

  function read(id) {
    try {
      var n = parseInt(global.localStorage.getItem(PREFIX + id), 10);
      return isNaN(n) ? 0 : n;
    } catch (e) {
      return 0;
    }
  }

  function write(id, value) {
    try {
      global.localStorage.setItem(PREFIX + id, String(value));
    } catch (e) {
      /* ignore */
    }
  }

  /** Store value if higher; returns the current best. */
  function update(id, value) {
    var best = read(id);
    var v = value | 0;
    if (v > best) {
      best = v;
      write(id, best);
    }
    return best;
  }

  global.GameHighScore = {
    get: read,
    update: update,
  };
})(typeof window !== 'undefined' ? window : this);
