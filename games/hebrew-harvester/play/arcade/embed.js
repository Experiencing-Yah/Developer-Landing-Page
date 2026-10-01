/**
 * Only active when a game is opened inside Hebrew Harvester's overlay.
 * Opened directly, the page is left alone.
 *
 * Inside the overlay the page is restyled to fill the screen (embed.css) and gets
 * the Harvester's own touch scheme: a floating stick wherever you drag (tap-to-walk only
 * where there are no walls), swipes for the snake, a pull-back sling for David, a round
 * Act button and a pause button. All of it drives the
 * game by sending the keyboard events it already listens for, so desktop keys keep
 * working unchanged.
 */
(function () {
  if (window.parent === window) return;

  var root = document.documentElement;
  root.classList.add('hh-embed');

  function exit() {
    window.parent.postMessage({ source: 'ey-arcade', type: 'exit' }, '*');
  }

  document.addEventListener(
    'click',
    function (e) {
      var node = e.target;
      var link = node && node.closest ? node.closest('a[href]') : null;
      if (!link) return;
      e.preventDefault();
      exit();
    },
    true,
  );

  document.addEventListener(
    'keydown',
    function (e) {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      exit();
    },
    true,
  );

  /* The parent knows the device safe areas; env() reads 0 inside an iframe on Android. */
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (e.source !== window.parent || !d || d.source !== 'hh-arcade' || d.type !== 'insets') return;
    ['top', 'right', 'bottom', 'left'].forEach(function (side) {
      var v = Number(d[side]);
      root.style.setProperty('--hh-inset-' + side, (isFinite(v) ? Math.max(0, v) : 0) + 'px');
    });
  });
  window.parent.postMessage({ source: 'ey-arcade', type: 'ready' }, '*');

  var muteTries = 0;
  function syncMute() {
    var muted = false;
    try {
      muted = localStorage.getItem('hh-music-muted') === '1';
    } catch (err) {
      return;
    }
    if (!muted) return;
    var toggle = document.getElementById('music-toggle');
    var music = toggle && toggle._gameMusic;
    if (music && typeof music.toggleMuted === 'function') {
      if (!music.userMuted) music.toggleMuted();
      return;
    }
    if (muteTries++ < 40) setTimeout(syncMute, 100);
  }

  // ---------- keys ----------

  var KEYS = {
    up: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
    down: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
    left: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
    right: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
    space: { key: ' ', code: 'Space', keyCode: 32 },
    j: { key: 'j', code: 'KeyJ', keyCode: 74 },
    k: { key: 'k', code: 'KeyK', keyCode: 75 },
    l: { key: 'l', code: 'KeyL', keyCode: 76 },
    p: { key: 'p', code: 'KeyP', keyCode: 80 },
  };

  var held = {};

  function send(type, name) {
    var def = KEYS[name];
    var ev = new KeyboardEvent(type, { key: def.key, code: def.code, bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'keyCode', { get: function () { return def.keyCode; } });
    Object.defineProperty(ev, 'which', { get: function () { return def.keyCode; } });
    // Every game listens on window; a document dispatch bubbles up to it.
    document.dispatchEvent(ev);
  }

  function press(name) {
    held[name] = (held[name] || 0) + 1;
    if (held[name] === 1) send('keydown', name);
  }

  function release(name) {
    if (!held[name]) return;
    held[name] -= 1;
    if (held[name] === 0) send('keyup', name);
  }

  // Several games poll their key map once per frame, so a press must outlast a frame or two.
  var MIN_HOLD_MS = 100;

  function tapKey(name) {
    press(name);
    setTimeout(function () {
      release(name);
    }, MIN_HOLD_MS);
  }

  /** For keys a game acts on at keydown: press and release at once, so repeats are never swallowed. */
  function pulse(name) {
    if (held[name]) return;
    send('keydown', name);
    send('keyup', name);
  }

  function axisDir(dx, dy) {
    return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  }

  /** Arrows that steer an 8-way walker toward a point: an axis counts once it is a real share of the way. */
  function steerDirs(dx, dy, slack) {
    var ax = Math.abs(dx);
    var ay = Math.abs(dy);
    var out = [];
    if (ax > Math.max(slack, ay * 0.41)) out.push(dx > 0 ? 'right' : 'left');
    if (ay > Math.max(slack, ax * 0.41)) out.push(dy > 0 ? 'down' : 'up');
    return out;
  }

  // ---------- board geometry ----------

  var SIDE_QUERY = '(orientation: landscape) and (min-aspect-ratio: 3/2)';

  function sideLayout() {
    return !!(window.matchMedia && window.matchMedia(SIDE_QUERY).matches);
  }

  function board() {
    return document.querySelector('#canvas-wrap canvas') || document.querySelector('canvas');
  }

  /** Screen point to canvas buffer coordinates; null off the board unless `anywhere`. */
  function toCanvas(x, y, anywhere) {
    var c = board();
    if (!c) return null;
    var r = c.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    if (!anywhere && (x < r.left || x > r.right || y < r.top || y > r.bottom)) return null;
    return { x: ((x - r.left) / r.width) * c.width, y: ((y - r.top) / r.height) * c.height };
  }

  function toScreen(pt) {
    var c = board();
    var r = c.getBoundingClientRect();
    return { x: r.left + (pt.x / c.width) * r.width, y: r.top + (pt.y / c.height) * r.height };
  }

  function inRect(pt, x, y, w, h) {
    return pt.x >= x && pt.x <= x + w && pt.y >= y && pt.y <= y + h;
  }

  // ---------- tap-to-move jobs ----------
  // A job runs once per frame after the game's own update and holds arrow keys until it is done.

  var nativeRaf = window.requestAnimationFrame.bind(window);
  var autoDirs = [];
  var job = null;
  var marker = document.createElement('div');
  marker.className = 'hh-target';

  function setAutoDirs(next) {
    autoDirs.forEach(function (d) {
      if (next.indexOf(d) < 0) release(d);
    });
    next.forEach(function (d) {
      if (autoDirs.indexOf(d) < 0) press(d);
    });
    autoDirs = next;
  }

  function placeMarker(pt) {
    if (!pt) {
      marker.classList.remove('is-on');
      return;
    }
    var s = toScreen(pt);
    marker.style.transform = 'translate(' + s.x + 'px, ' + s.y + 'px)';
    marker.classList.add('is-on');
  }

  function startJob(next) {
    cancelJob();
    next.t0 = Date.now();
    job = next;
    placeMarker(job.mark ? job.mark() : null);
  }

  function cancelJob() {
    if (!job) return;
    job = null;
    setAutoDirs([]);
    placeMarker(null);
  }

  function frame() {
    nativeRaf(frame);
    if (!job) return;
    if (isPaused() || !isPlaying(gameState())) {
      cancelJob();
      return;
    }
    var keep = false;
    try {
      keep = job.tick();
    } catch (err) {
      keep = false;
    }
    if (!keep || Date.now() - job.t0 > (job.maxMs || 8000)) cancelJob();
    else placeMarker(job.mark ? job.mark() : null);
  }

  /** Walk an 8-way character toward goal() until it is within `arrive`. */
  function walkJob(o) {
    var last = null;
    var still = 0;
    return {
      maxMs: 6000,
      mark: o.goal,
      tick: function () {
        var p = o.pos();
        var g = o.goal();
        if (!p || !g) return false;
        var dx = g.x - p.x;
        var dy = g.y - p.y;
        if (Math.hypot(dx, dy) <= o.arrive) {
          setAutoDirs([]);
          return false;
        }
        setAutoDirs(steerDirs(dx, dy, 2));
        if (last && Math.hypot(p.x - last.x, p.y - last.y) < 0.2) still++;
        else still = 0;
        last = { x: p.x, y: p.y };
        return still < 24;
      },
    };
  }

  // ---------- other games ----------

  function mannaTap(pt) {
    var w = board().width;
    var h = board().height;
    var r = player.r;
    var spot = { x: Math.max(r, Math.min(w - r, pt.x)), y: Math.max(r, Math.min(h - r, pt.y)) };
    startJob(
      walkJob({
        pos: function () {
          return player;
        },
        goal: function () {
          return spot;
        },
        arrive: 4,
      }),
    );
    return true;
  }

  /** Tap the piece's columns to turn it; tap beside it to slide it to the tapped column. */
  function babelTap(pt) {
    var piece = currentPiece;
    if (!piece) return false;
    var lo = Infinity;
    var hi = -Infinity;
    for (var r = 0; r < piece.shape.length; r++) {
      for (var c = 0; c < piece.shape[r].length; c++) {
        if (!piece.shape[r][c]) continue;
        lo = Math.min(lo, piece.x + c);
        hi = Math.max(hi, piece.x + c);
      }
    }
    var col = Math.floor((pt.x - FX) / CELL);
    if (col >= lo && col <= hi) {
      pulse('up');
      return true;
    }
    var steps;
    if (col < 0) steps = -1;
    else if (col >= COLS) steps = 1;
    else steps = col < lo ? col - lo : col - hi;
    for (var i = 0; i < Math.abs(steps); i++) pulse(steps < 0 ? 'left' : 'right');
    return true;
  }

  /** A quick downward flick drops the piece to the floor. */
  function babelFlick(dx, dy, ms) {
    if (ms > 350 || dy < 60 || dy < Math.abs(dx) * 2) return;
    for (var i = 0; i < ROWS + 2; i++) {
      if (!currentPiece || collides(currentPiece, 0, 1)) break;
      pulse('down');
    }
  }

  function charSelectTap(pt) {
    var cardW = 150;
    var cardH = 170;
    var gap = 18;
    var left = (board().width - (3 * cardW + 2 * gap)) / 2;
    var hit = -1;
    for (var i = 0; i < 3; i++) if (inRect(pt, left + i * (cardW + gap), 62, cardW, cardH)) hit = i;
    if (waterQuestUnlocked && inRect(pt, left, 282, 3 * cardW + 2 * gap, 52)) hit = 3;
    if (inRect(pt, (board().width - cardW) / 2, 374, cardW, cardH)) hit = 4;
    if (goliathSwordUnlocked && inRect(pt, (board().width - 280) / 2, 574, 280, 28)) hit = 5;
    if (hit < 0) return true;
    if (hit === charSelIdx) {
      pulse('space');
      return true;
    }
    window.charSelIdx = hit;
    if (hit <= 2) window.charSelTopIdx = hit;
    return true;
  }

  function davidTap(pt, s) {
    return s === 'charselect' ? charSelectTap(pt) : false;
  }

  // David's sling pulls like a slingshot: press anywhere on the field, drag back away from
  // Goliath and let go. The pull's direction sets the angle and its length the power.
  var PULL_MIN = 18;
  var PULL_MAX = 130;
  var pullBand = document.createElement('div');
  pullBand.className = 'hh-pull';
  var pullAnchor = document.createElement('div');
  pullAnchor.className = 'hh-pull-anchor';
  pullBand.appendChild(pullAnchor);
  var pullStrap = document.createElement('div');
  pullStrap.className = 'hh-pull-strap';
  pullBand.appendChild(pullStrap);

  function showPull(x0, y0, dx, dy, armed) {
    pullBand.style.transform = 'translate(' + x0 + 'px, ' + y0 + 'px)';
    pullStrap.style.width = Math.hypot(dx, dy) + 'px';
    pullStrap.style.transform = 'rotate(' + Math.atan2(dy, dx) + 'rad)';
    pullBand.classList.toggle('is-armed', armed);
    pullBand.classList.add('is-on');
  }

  function davidPress(pt, s, x0, y0) {
    if (s !== 'david_fight' || dv.phase !== 'aim' || dv.stones <= 0) return null;
    var armed = false;
    dv.power = 0;
    showPull(x0, y0, 0, 0, false);
    return {
      move: function (x, y) {
        var dx = x - x0;
        var dy = y - y0;
        var d = Math.min(PULL_MAX, Math.hypot(dx, dy));
        armed = d >= PULL_MIN && dv.phase === 'aim';
        if (armed) {
          dv.angle = Math.max(10, Math.min(80, (Math.atan2(dy, -dx) * 180) / Math.PI));
          dv.power = ((d - PULL_MIN) / (PULL_MAX - PULL_MIN)) * 100;
        } else dv.power = 0;
        var k = d / (Math.hypot(dx, dy) || 1);
        showPull(x0, y0, dx * k, dy * k, armed);
      },
      up: function (cancelled) {
        pullBand.classList.remove('is-on');
        if (armed && !cancelled && dv.phase === 'aim') throwStone();
        else dv.power = 0;
      },
    };
  }

  // ---------- per-game mapping ----------

  function gameState() {
    return typeof window.state === 'string' ? window.state : '';
  }

  var PLAYING = ['playing'];
  var GAMES = {
    'manna-mover': {
      dirs: 8,
      selfPause: true,
      tapAt: mannaTap,
      act: function () { return null; },
    },
    'babel-builder': {
      dirs: 4,
      noUp: true,
      tapInPlay: true,
      tapAt: babelTap,
      flick: babelFlick,
      act: function () { return { key: 'up', label: 'Turn' }; },
    },
    'passover-pillage': {
      dirs: 4,
      swipe: true,
      act: function () { return null; },
    },
    'temple-throwdown': {
      dirs: 8,
      act: function () { return { key: 'j', label: 'Whip' }; },
      alt: function () { return [{ key: 'k', label: 'Flip' }]; },
    },
    'davids-defenders': {
      dirs: function (s) { return s === 'charselect' ? 4 : 8; },
      playing: ['playing', 'david_fight', 'water_quest'],
      tapStates: ['charselect'],
      tapAt: davidTap,
      pressAt: davidPress,
      act: function (s) {
        if (s === 'water_quest') return { key: 'j', label: 'Sword' };
        if (s === 'david_fight') return { key: 'j', label: dv.phase === 'sword_fight' ? 'Sword' : 'Sling' };
        return { key: 'j', label: 'Strike' };
      },
      alt: function (s) {
        if (s !== 'water_quest') return [];
        return [
          { key: 'k', label: 'Spear' },
          { key: 'l', label: 'Bow' },
        ];
      },
    },
  };

  var parts = location.pathname.split('/').filter(Boolean);
  var gameId = parts[parts.length - 1] === 'index.html' ? parts[parts.length - 2] : parts[parts.length - 1];
  var cfg = GAMES[gameId] || { dirs: 8, act: function () { return null; } };
  root.classList.add('hh-game-' + gameId);
  if (cfg.swipe) root.classList.add('hh-swipe');

  function isPlaying(s) {
    return (cfg.playing || PLAYING).indexOf(s) >= 0;
  }

  /** What the Act button does right now: start/continue on menus, resume when paused, the game's action in play. */
  function actBinding() {
    var s = gameState();
    if (s === 'paused') return { key: 'p', label: 'Go' };
    if (!isPlaying(s)) return { key: 'space', label: 'Go' };
    return cfg.act(s);
  }

  // ---------- pause ----------
  // Manna Mover has no pause of its own: its frame loop is held back instead. It clamps each
  // frame's step to 50ms, so the day clock does not jump when the loop comes back.

  var selfPaused = false;
  var heldFrames = [];
  if (cfg.selfPause) {
    window.requestAnimationFrame = function (cb) {
      if (!selfPaused) return nativeRaf(cb);
      heldFrames.push(cb);
      return 0;
    };
  }

  function isPaused() {
    return cfg.selfPause ? selfPaused : gameState() === 'paused';
  }

  function canPause() {
    return isPlaying(gameState());
  }

  function pauseGame() {
    if (isPaused() || !canPause()) return;
    releaseAll();
    if (cfg.selfPause) selfPaused = true;
    else pulse('p');
    refresh();
  }

  function resumeGame() {
    if (!isPaused()) return;
    if (cfg.selfPause) {
      selfPaused = false;
      var frames = heldFrames;
      heldFrames = [];
      frames.forEach(function (cb) {
        nativeRaf(cb);
      });
    } else pulse('p');
    refresh();
  }

  window.addEventListener('keydown', function (e) {
    if (!e.isTrusted) return;
    cancelJob();
    if (cfg.selfPause && !e.repeat && e.key.toLowerCase() === 'p') {
      if (isPaused()) resumeGame();
      else pauseGame();
    }
  });

  // ---------- touch-friendly wording ----------

  var PHRASES = {
    'P Pause': '',
    'P \u2014 Pause': '',
    'Press ESC to return to character select': '',
  };

  var GAME_PHRASES = {
    'manna-mover': {
      'Arrow Keys, WASD, or on-screen pad': 'Tap to walk there, or drag to steer',
    },
    'passover-pillage': {
      'Arrow Keys, WASD, or on-screen pad': 'Swipe to turn',
      'Touch an Egyptian to plunder their gold jewelry.': 'Steer into an Egyptian to plunder their gold jewelry.',
    },
    'babel-builder': {
      'Arrow Keys / WASD / on-screen buttons': 'Tap a column to move, tap the piece to turn',
      'Down \u2014 Soft Drop \u00b7 P \u2014 Pause': 'Swipe down to drop',
      '\u2190 \u2192 Move': 'Tap a column',
      '\u2191 / W Rotate': 'Tap piece: turn',
      '\u2193 Soft Drop': 'Swipe \u2193: drop',
    },
    'temple-throwdown': {
      'WASD / Arrows \u2014 Move': 'Drag anywhere to move',
      'J / Enter \u2014 Whip (free animals)': 'Whip \u2014 free the animals',
      'K / Shift \u2014 Flip (flip tables)': 'Flip \u2014 overturn the tables',
    },
    'davids-defenders': {
      'Arrows / WASD \u2014 Move': 'Drag anywhere to move',
      'J / K \u2014 Attack   P \u2014 Pause': 'Strike button to attack',
      'K, L \u2014 Special attacks (Water Quest)': 'Spear and Bow buttons in the Water Quest',
      'J: Sword (Eleazar)': 'Sword (Eleazar)',
      'K: Spear (Josheb)': 'Spear (Josheb)',
      'L: Arrow (Shammah)': 'Bow (Shammah)',
      'Arrows/WASD to select \u00b7 Space to choose': 'Tap a warrior, tap again to choose',
      'Charging... release J to throw!': 'Let go!',
      'Hold J to charge': 'Pull back',
    },
  };

  function touchWords(text) {
    if (typeof text !== 'string') return text;
    var own = GAME_PHRASES[gameId] || {};
    if (Object.prototype.hasOwnProperty.call(own, text)) return own[text];
    if (Object.prototype.hasOwnProperty.call(PHRASES, text)) return PHRASES[text];
    return text
      .replace(/(tap go or )?press p(?: or space)? to resume/gi, function (m) {
        return m === m.toUpperCase() ? 'TAP TO RESUME' : 'Tap to resume';
      })
      .replace(/press space/gi, function (m) { return m === m.toUpperCase() ? 'TAP' : 'Tap'; })
      .replace('Hold J to charge, release to throw', 'Pull back and let go to throw')
      .replace('(J to swing, WASD to move)', '(drag to move, Sword to swing)');
  }

  var wordsPatched = false;
  function patchWords() {
    if (wordsPatched) return;
    wordsPatched = true;
    var proto = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
    if (proto) {
      var fill = proto.fillText;
      var stroke = proto.strokeText;
      proto.fillText = function (text) {
        var args = Array.prototype.slice.call(arguments);
        args[0] = touchWords(text);
        if (args[0] === '') return;
        return fill.apply(this, args);
      };
      proto.strokeText = function (text) {
        var args = Array.prototype.slice.call(arguments);
        args[0] = touchWords(text);
        if (args[0] === '') return;
        return stroke.apply(this, args);
      };
    }
    ['overlay', 'hud'].forEach(function (id) {
      var box = document.getElementById(id);
      if (!box) return;
      function sweep() {
        var walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
        for (var n = walker.nextNode(); n; n = walker.nextNode()) {
          var next = touchWords(n.nodeValue);
          if (next !== n.nodeValue) n.nodeValue = next;
        }
      }
      new MutationObserver(sweep).observe(box, { childList: true, subtree: true, characterData: true });
      sweep();
    });
  }

  // ---------- touch layer ----------

  var STICK_RADIUS = 48;
  var STICK_DEADZONE = 14;
  var SWIPE_MIN = 24;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  var pad = el('div', 'hh-pad');
  var stick = el('div', 'hh-stick');
  var knob = el('div', 'hh-stick-knob');
  stick.appendChild(knob);
  var stickHint = el('div', 'hh-stick-hint');
  var buttons = el('div', 'hh-buttons');
  var actBtn = el('button', 'hh-act');
  actBtn.type = 'button';
  var altBtns = [el('button', 'hh-act hh-alt'), el('button', 'hh-act hh-alt')];
  altBtns.forEach(function (b) {
    b.type = 'button';
  });
  buttons.appendChild(altBtns[1]);
  buttons.appendChild(altBtns[0]);
  buttons.appendChild(actBtn);

  var ICON_PAUSE = '<svg class="hh-icon-pause" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>';
  var ICON_PLAY = '<svg class="hh-icon-play" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13l10.5-6.5z"/></svg>';
  var pauseBtn = el('button', 'hh-pause-btn');
  pauseBtn.type = 'button';
  pauseBtn.innerHTML = ICON_PAUSE + ICON_PLAY;
  pauseBtn.setAttribute('aria-label', 'Pause');
  pauseBtn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (isPaused()) resumeGame();
    else pauseGame();
  });

  var pauseScreen = el('div', 'hh-pause-screen');
  pauseScreen.setAttribute('role', 'dialog');
  pauseScreen.setAttribute('aria-label', 'Paused');
  var pauseCard = el('div', 'hh-pause-card');
  var resumeBtn = el('button', 'hh-pause-resume', 'Resume');
  var homeBtn = el('button', 'hh-pause-home', 'Return home');
  resumeBtn.type = 'button';
  homeBtn.type = 'button';
  pauseCard.appendChild(el('div', 'hh-pause-title', 'Paused'));
  pauseCard.appendChild(resumeBtn);
  pauseCard.appendChild(homeBtn);
  pauseScreen.appendChild(pauseCard);
  resumeBtn.addEventListener('click', function (e) {
    e.preventDefault();
    resumeGame();
  });
  homeBtn.addEventListener('click', function (e) {
    e.preventDefault();
    exit();
  });
  pauseScreen.addEventListener('pointerdown', function (e) {
    e.stopPropagation();
  });

  function enableTouchUi() {
    if (root.classList.contains('hh-touch')) return;
    root.classList.add('hh-touch');
    patchWords();
  }

  var stickId = null;
  var downX = 0;
  var downY = 0;
  var downAt = 0;
  var steering = false;
  var stickDirs = [];
  var pressId = null;
  var pressing = null;

  function setDirs(next) {
    stickDirs.forEach(function (d) {
      if (next.indexOf(d) < 0) release(d);
    });
    next.forEach(function (d) {
      if (stickDirs.indexOf(d) < 0) press(d);
    });
    stickDirs = next;
  }

  var OCTANTS = [['right'], ['right', 'down'], ['down'], ['left', 'down'], ['left'], ['left', 'up'], ['up'], ['right', 'up']];
  var QUADRANTS = [['right'], ['down'], ['left'], ['up']];

  function dirsFor(dx, dy) {
    var angle = Math.atan2(dy, dx);
    var ways = typeof cfg.dirs === 'function' ? cfg.dirs(gameState()) : cfg.dirs;
    var set;
    if (ways === 4) set = QUADRANTS[((Math.round(angle / (Math.PI / 2)) % 4) + 4) % 4];
    else set = OCTANTS[((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8];
    if (cfg.noUp && isPlaying(gameState())) {
      set = set.filter(function (d) {
        return d !== 'up';
      });
    }
    return set;
  }

  function endStick() {
    stickId = null;
    steering = false;
    setDirs([]);
    stick.classList.remove('is-on');
    root.classList.remove('hh-steering');
  }

  function tap() {
    var s = gameState();
    if (s === 'paused') tapKey('p');
    else if (!isPlaying(s)) tapKey('space');
    else if (cfg.tapInPlay) {
      var b = cfg.act(s);
      if (b) tapKey(b.key);
    }
  }

  /** A tap on the board goes to the game's own handler first; menus fall back to Go. */
  function tapAt(x, y) {
    var s = gameState();
    var wants = cfg.tapAt && (isPlaying(s) || (cfg.tapStates || []).indexOf(s) >= 0);
    if (wants && !isPaused()) {
      var pt = toCanvas(x, y, !!cfg.tapAnywhere);
      if (pt && cfg.tapAt(pt, s)) return;
    }
    tap();
  }

  /** In the side-by-side layout the column right of the board belongs to the buttons. */
  function inButtonColumn(x) {
    if (!sideLayout()) return false;
    var c = board();
    return !!c && x > c.getBoundingClientRect().right + 2;
  }

  pad.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse') {
      window.focus();
      if (e.button === 0) tapAt(e.clientX, e.clientY);
      return;
    }
    enableTouchUi();
    e.preventDefault();
    if (stickId !== null || pressId !== null) {
      tap();
      return;
    }
    var s = gameState();
    if (inButtonColumn(e.clientX)) {
      if (!isPlaying(s)) tap();
      return;
    }
    if (cfg.pressAt && isPlaying(s)) {
      var pt = toCanvas(e.clientX, e.clientY, false);
      var hold = pt && cfg.pressAt(pt, s, e.clientX, e.clientY);
      if (hold) {
        cancelJob();
        pressId = e.pointerId;
        pressing = hold;
        try {
          pad.setPointerCapture(e.pointerId);
        } catch (err) {
          /* synthetic pointers cannot always be captured */
        }
        return;
      }
    }
    stickId = e.pointerId;
    downX = e.clientX;
    downY = e.clientY;
    downAt = Date.now();
    steering = false;
    try {
      pad.setPointerCapture(e.pointerId);
    } catch (err) {
      /* synthetic pointers cannot always be captured */
    }
  });

  pad.addEventListener('pointermove', function (e) {
    if (e.pointerId === pressId) {
      pressing.move(e.clientX, e.clientY);
      return;
    }
    if (e.pointerId !== stickId) return;
    var dx = e.clientX - downX;
    var dy = e.clientY - downY;
    var dist = Math.hypot(dx, dy);
    if (cfg.swipe && isPlaying(gameState())) {
      // Each stretch of a swipe turns once; the next stretch starts where this one ended.
      if (dist < SWIPE_MIN || isPaused()) return;
      steering = true;
      pulse(axisDir(dx, dy));
      downX = e.clientX;
      downY = e.clientY;
      return;
    }
    if (!steering && dist > STICK_DEADZONE) {
      steering = true;
      cancelJob();
      stick.style.left = downX + 'px';
      stick.style.top = downY + 'px';
      stick.classList.add('is-on');
      root.classList.add('hh-steering');
    }
    if (!steering) return;
    var r = Math.min(dist, STICK_RADIUS);
    knob.style.transform = 'translate(calc(-50% + ' + (dx / dist) * r + 'px), calc(-50% + ' + (dy / dist) * r + 'px))';
    setDirs(dist > STICK_DEADZONE ? dirsFor(dx, dy) : []);
  });

  function stickUp(e) {
    if (e.pointerId === pressId) {
      pressId = null;
      var done = pressing;
      pressing = null;
      done.up(e.type !== 'pointerup');
      return;
    }
    if (e.pointerId !== stickId) return;
    var wasSteering = steering;
    var dx = e.clientX - downX;
    var dy = e.clientY - downY;
    var ms = Date.now() - downAt;
    endStick();
    if (e.type !== 'pointerup') return;
    if (!wasSteering) tapAt(e.clientX, e.clientY);
    else if (cfg.flick && isPlaying(gameState())) cfg.flick(dx, dy, ms);
  }
  pad.addEventListener('pointerup', stickUp);
  pad.addEventListener('pointercancel', stickUp);

  function bindButton(btn, pick) {
    var active = null;
    btn.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.pointerType !== 'mouse') enableTouchUi();
      var b = pick();
      if (!b || active) return;
      active = { key: b.key, id: e.pointerId, at: Date.now() };
      btn.classList.add('is-down');
      press(b.key);
      try {
        btn.setPointerCapture(e.pointerId);
      } catch (err) {
        /* synthetic pointers cannot always be captured */
      }
    });
    function up(e) {
      if (!active || e.pointerId !== active.id) return;
      var key = active.key;
      var wait = MIN_HOLD_MS - (Date.now() - active.at);
      active = null;
      btn.classList.remove('is-down');
      if (wait > 0) {
        setTimeout(function () {
          release(key);
        }, wait);
      } else release(key);
    }
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('lostpointercapture', up);
    btn.addEventListener('click', function (e) {
      e.preventDefault();
    });
    btn.addEventListener('contextmenu', function (e) {
      e.preventDefault();
    });
  }

  bindButton(actBtn, actBinding);
  altBtns.forEach(function (btn, i) {
    bindButton(btn, function () {
      var s = gameState();
      var list = isPlaying(s) && cfg.alt ? cfg.alt(s) : [];
      return list[i] || null;
    });
  });

  function paint(btn, b) {
    var label = b ? b.label : '';
    if (btn.textContent !== label) btn.textContent = label;
    btn.classList.toggle('is-idle', !b);
    btn.setAttribute('aria-hidden', b ? 'false' : 'true');
  }

  var musicHeld = false;
  function holdMusic(paused) {
    var toggle = document.getElementById('music-toggle');
    var music = toggle && toggle._gameMusic;
    if (!music) return;
    if (paused && !musicHeld && music.started && !music.pausedByMute && !music.userMuted) {
      music.pause();
      musicHeld = true;
    } else if (!paused && musicHeld) {
      musicHeld = false;
      if (!music.userMuted) music.resume();
    }
  }

  var shownState = '';
  function refresh() {
    var s = gameState();
    var paused = isPaused();
    holdMusic(paused);
    if (s !== shownState) {
      if (shownState) root.classList.remove('hh-state-' + shownState);
      if (s) root.classList.add('hh-state-' + s);
      shownState = s;
    }
    paint(actBtn, actBinding());
    var alts = isPlaying(s) && cfg.alt ? cfg.alt(s) : [];
    paint(altBtns[0], alts[0] || null);
    paint(altBtns[1], alts[1] || null);
    root.classList.toggle('hh-paused', paused);
    root.classList.toggle('hh-in-play', isPlaying(s) || paused);
    pauseBtn.setAttribute('aria-label', paused ? 'Resume' : 'Pause');
  }

  function releaseAll() {
    cancelJob();
    endStick();
    if (pressing) {
      var done = pressing;
      pressing = null;
      pressId = null;
      done.up(true);
    }
    autoDirs = [];
    Object.keys(held).forEach(function (name) {
      if (held[name] > 0) {
        held[name] = 0;
        send('keyup', name);
      }
    });
    actBtn.classList.remove('is-down');
    altBtns.forEach(function (b) {
      b.classList.remove('is-down');
    });
  }
  window.addEventListener('blur', releaseAll);
  window.addEventListener('pagehide', function () {
    releaseAll();
    pauseGame();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'hidden') return;
    releaseAll();
    pauseGame();
  });

  // Pinch and double-tap zoom are the parent's business; the game never scrolls.
  document.addEventListener(
    'touchmove',
    function (e) {
      e.preventDefault();
    },
    { passive: false },
  );
  document.addEventListener('dblclick', function (e) {
    e.preventDefault();
  });

  function mount() {
    document.body.appendChild(pad);
    document.body.appendChild(stickHint);
    document.body.appendChild(marker);
    document.body.appendChild(pullBand);
    document.body.appendChild(stick);
    document.body.appendChild(buttons);
    document.body.appendChild(pauseScreen);
    var hud = document.getElementById('hud');
    var music = document.getElementById('music-toggle');
    if (music && music.parentNode) music.parentNode.insertBefore(pauseBtn, music);
    else if (hud) hud.appendChild(pauseBtn);
    else document.body.appendChild(pauseBtn);
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (coarse) enableTouchUi();
    refresh();
    setInterval(refresh, 120);
    nativeRaf(frame);
    syncMute();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
