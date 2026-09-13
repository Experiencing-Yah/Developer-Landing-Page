/**
 * Intro-once then seamless loop BGM for the games.
 * Mute pauses/resumes at the current position (localStorage: ey-games-muted).
 */
(function (global) {
  var MUTE_KEY = 'ey-games-muted';
  /** Default BGM level — quieter than full volume for long looping sessions */
  var DEFAULT_VOLUME = 0.35;
  var AudioCtx = global.AudioContext || global.webkitAudioContext;

  function readMuted() {
    try {
      return global.localStorage.getItem(MUTE_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function writeMuted(muted) {
    try {
      global.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch (e) {
      /* ignore */
    }
  }

  function decodeFetch(ctx, url) {
    return fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('missing');
        return res.arrayBuffer();
      })
      .then(function (buf) {
        return ctx.decodeAudioData(buf.slice(0));
      });
  }

  function loadTrack(ctx, basePath) {
    var extensions = ['.ogg', '.mp3', '.MP3', '.OGG'];
    function tryNext(i) {
      if (i >= extensions.length) {
        return Promise.reject(new Error('missing'));
      }
      return decodeFetch(ctx, basePath + extensions[i]).catch(function () {
        return tryNext(i + 1);
      });
    }
    return tryNext(0);
  }

  function GameMusic(options) {
    this.basePath = options.basePath.replace(/\/$/, '');
    this.fallbackBasePath = options.fallbackBasePath
      ? options.fallbackBasePath.replace(/\/$/, '')
      : null;
    this.toggleEl =
      options.toggleEl ||
      (options.toggleSelector
        ? document.querySelector(options.toggleSelector)
        : null);
    this.ctx = null;
    this.introBuffer = null;
    this.loopBuffer = null;
    this.introSource = null;
    this.loopSource = null;
    this.gain = null;
    this.ready = false;
    this.loading = false;
    this.started = false;
    this.userMuted = readMuted();
    this.pausedByMute = false;
    this.phase = null;
    this.phaseOffset = 0;
    this.phaseStartedAt = 0;
    this.waitingForGesture = false;
    this._unlockHandler = null;
    this._syncToggle();
    if (this.toggleEl) {
      var self = this;
      this.toggleEl._gameMusic = this;
      this.toggleEl.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        self.toggleMuted();
      });
    }
  }

  GameMusic.prototype._ensureCtx = function () {
    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = DEFAULT_VOLUME;
      this.gain.connect(this.ctx.destination);
    }
    return this.ctx;
  };

  GameMusic.prototype._syncToggle = function () {
    if (!this.toggleEl) return;
    var muted = this.userMuted;
    this.toggleEl.setAttribute('aria-pressed', muted ? 'true' : 'false');
    this.toggleEl.setAttribute(
      'aria-label',
      muted ? 'Unmute music' : 'Mute music'
    );
    this.toggleEl.classList.toggle('is-muted', muted);
  };

  GameMusic.prototype._stopSources = function () {
    if (this.introSource) {
      try {
        this.introSource.stop();
      } catch (e) {
        /* already stopped */
      }
      this.introSource = null;
    }
    if (this.loopSource) {
      try {
        this.loopSource.stop();
      } catch (e) {
        /* already stopped */
      }
      this.loopSource = null;
    }
  };

  GameMusic.prototype._captureOffset = function () {
    if (!this.ctx || !this.phase) {
      this.phaseOffset = 0;
      return;
    }
    var elapsed = this.ctx.currentTime - this.phaseStartedAt;
    if (this.phase === 'intro') {
      this.phaseOffset = Math.max(
        0,
        Math.min(elapsed + this.phaseOffset, this.introBuffer.duration)
      );
    } else if (this.phase === 'loop') {
      var len = this.loopBuffer.duration;
      this.phaseOffset = ((elapsed + this.phaseOffset) % len + len) % len;
    }
  };

  GameMusic.prototype._playFrom = function (phase, offset) {
    var ctx = this._ensureCtx();
    this._stopSources();
    this.phase = phase;
    this.phaseOffset = offset || 0;
    this.phaseStartedAt = ctx.currentTime;
    this.pausedByMute = false;

    if (phase === 'intro') {
      var remaining = this.introBuffer.duration - this.phaseOffset;
      if (remaining <= 0.02) {
        this._playFrom('loop', 0);
        return;
      }
      var intro = ctx.createBufferSource();
      intro.buffer = this.introBuffer;
      intro.connect(this.gain);
      this.introSource = intro;

      var loop = ctx.createBufferSource();
      loop.buffer = this.loopBuffer;
      loop.loop = true;
      loop.connect(this.gain);
      this.loopSource = loop;

      var startAt = ctx.currentTime;
      intro.start(startAt, this.phaseOffset);
      loop.start(startAt + remaining, 0);

      var self = this;
      intro.onended = function () {
        if (self.introSource === intro) {
          self.introSource = null;
          self.phase = 'loop';
          self.phaseOffset = 0;
          self.phaseStartedAt = ctx.currentTime;
        }
      };
    } else {
      var loopOnly = ctx.createBufferSource();
      loopOnly.buffer = this.loopBuffer;
      loopOnly.loop = true;
      loopOnly.connect(this.gain);
      this.loopSource = loopOnly;
      loopOnly.start(ctx.currentTime, this.phaseOffset);
    }
  };

  GameMusic.prototype._loadTrackNamed = function (name) {
    var ctx = this._ensureCtx();
    var primary = loadTrack(ctx, this.basePath + '/' + name);
    if (!this.fallbackBasePath) return primary;
    var self = this;
    return primary.catch(function () {
      return loadTrack(ctx, self.fallbackBasePath + '/' + name);
    });
  };

  GameMusic.prototype._load = function () {
    if (this.ready) return Promise.resolve(true);
    if (this.loading) {
      var self = this;
      return new Promise(function (resolve) {
        var id = setInterval(function () {
          if (!self.loading) {
            clearInterval(id);
            resolve(self.ready);
          }
        }, 50);
      });
    }
    this.loading = true;
    this._ensureCtx();
    var self = this;
    return this._loadTrackNamed('intro')
      .then(function (introBuf) {
        return self
          ._loadTrackNamed('loop')
          .catch(function () {
            /* Intro-only: loop the same track after it finishes once */
            return introBuf;
          })
          .then(function (loopBuf) {
            self.introBuffer = introBuf;
            self.loopBuffer = loopBuf;
            self.ready = true;
            self.loading = false;
            return true;
          });
      })
      .catch(function () {
        self.loading = false;
        self.ready = false;
        return false;
      });
  };

  GameMusic.prototype._removeUnlock = function () {
    if (!this._unlockHandler) return;
    document.removeEventListener('pointerdown', this._unlockHandler, true);
    document.removeEventListener('keydown', this._unlockHandler, true);
    document.removeEventListener('touchstart', this._unlockHandler, true);
    this._unlockHandler = null;
    this.waitingForGesture = false;
  };

  GameMusic.prototype._armUnlock = function () {
    if (this.waitingForGesture || this._unlockHandler) return;
    this.waitingForGesture = true;
    var self = this;
    this._unlockHandler = function () {
      self._removeUnlock();
      self._beginPlayback();
    };
    document.addEventListener('pointerdown', this._unlockHandler, true);
    document.addEventListener('keydown', this._unlockHandler, true);
    document.addEventListener('touchstart', this._unlockHandler, true);
  };

  GameMusic.prototype._beginPlayback = function () {
    var self = this;
    return this._load().then(function (ok) {
      if (!ok || self.userMuted) {
        self._syncToggle();
        return false;
      }
      var ctx = self._ensureCtx();
      var resume =
        ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
      return resume
        .then(function () {
          if (self.userMuted) return false;
          if (ctx.state === 'suspended') {
            self._armUnlock();
            return false;
          }
          if (!self.started || self.pausedByMute) {
            var phase = self.phase || 'intro';
            var offset = self.phase ? self.phaseOffset : 0;
            self.started = true;
            self._playFrom(phase, offset);
          }
          self._syncToggle();
          return true;
        })
        .catch(function () {
          self._armUnlock();
          return false;
        });
    });
  };

  GameMusic.prototype.start = function () {
    this._syncToggle();
    if (this.userMuted) return;
    var self = this;
    this._beginPlayback().then(function (playing) {
      if (!playing && self.ready && !self.userMuted) self._armUnlock();
    });
  };

  GameMusic.prototype.pause = function () {
    if (!this.started || this.pausedByMute) return;
    this._captureOffset();
    this._stopSources();
    this.pausedByMute = true;
  };

  GameMusic.prototype.resume = function () {
    if (!this.ready || this.userMuted) return;
    if (!this.started) {
      this._beginPlayback();
      return;
    }
    if (!this.pausedByMute && (this.introSource || this.loopSource)) return;
    var self = this;
    var ctx = this._ensureCtx();
    var p = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
    p.then(function () {
      if (self.userMuted) return;
      self._playFrom(self.phase || 'intro', self.phaseOffset || 0);
      self.started = true;
    }).catch(function () {
      self._armUnlock();
    });
  };

  GameMusic.prototype.toggleMuted = function () {
    this.userMuted = !this.userMuted;
    writeMuted(this.userMuted);
    this._syncToggle();
    this._removeUnlock();
    if (this.userMuted) {
      if (this.started) this.pause();
    } else {
      this.resume();
    }
  };

  GameMusic.create = function (options) {
    return new GameMusic(options);
  };

  global.GameMusic = GameMusic;
})(typeof window !== 'undefined' ? window : this);
