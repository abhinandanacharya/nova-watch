/*!
 * NovaWatch v1.0.0
 * Deep reactive state watcher — Proxy-based, zero dependencies.
 * https://github.com/abhinandanacharya/nova-watch
 * MIT License
 */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined'
    ? (module.exports = factory())
    : typeof define === 'function' && define.amd
    ? define(factory)
    : ((global = typeof globalThis !== 'undefined' ? globalThis : global || self),
      (global.NovaWatch = factory()));
})(this, function () {
  'use strict';

  var PROXY_FLAG = '__isNovaWatchProxy';

  // Built-ins that rely on internal slots break when accessed through a Proxy
  // (e.g. `proxy.getTime()` throws because `this` inside getTime is the Proxy,
  // not the real Date). We leave these as-is: not deep-reactive internally,
  // but usable without throwing.
  function isWrappable(val) {
    if (val === null || typeof val !== 'object') return false;
    var tag = Object.prototype.toString.call(val);
    return tag === '[object Object]' || tag === '[object Array]';
  }

  function Watcher(target, options) {
    options = options || {};
    this._listeners = new Set();
    this._pathListeners = new Map(); // path pattern -> Set<fn>
    this._batch = options.batch !== false; // default: true
    this._pending = false;
    this._changes = [];
    this._paused = false;
    this._proxyCache = new WeakMap(); // raw object -> proxy (keeps === stable)
    this.proxy = this._wrap(target || {}, []);
  }

  Watcher.prototype._wrap = function (obj, path) {
    var self = this;

    // Don't double-wrap something that's already one of our proxies
    if (obj && obj[PROXY_FLAG]) return obj;

    // Return the same proxy instance on repeated wraps of the same object,
    // so `state.a === state.a` holds true.
    if (this._proxyCache.has(obj)) return this._proxyCache.get(obj);

    var p = new Proxy(obj, {
      get: function (target, prop, receiver) {
        if (prop === PROXY_FLAG) return true;
        var value = Reflect.get(target, prop, receiver);
        if (isWrappable(value)) {
          return self._wrap(value, path.concat(prop));
        }
        return value;
      },

      set: function (target, prop, value) {
        var oldValue = target[prop];
        // Store the raw value; wrapping happens lazily on `get` (keyed by
        // the proxy cache), so we never store a proxy inside a target.
        target[prop] = value;
        self._queue(path.concat(prop), value, oldValue, 'set');
        return true;
      },

      deleteProperty: function (target, prop) {
        if (!(prop in target)) return true;
        var oldValue = target[prop];
        delete target[prop];
        self._proxyCache.delete(oldValue);
        self._queue(path.concat(prop), undefined, oldValue, 'delete');
        return true;
      }
    });

    this._proxyCache.set(obj, p);
    return p;
  };

  Watcher.prototype._queue = function (pathArr, value, oldValue, type) {
    if (this._paused) return;

    var change = {
      path: pathArr.join('.'),
      pathArr: pathArr,
      value: value,
      oldValue: oldValue,
      type: type
    };

    if (!this._batch) {
      this._emit([change]);
      return;
    }

    this._changes.push(change);
    if (!this._pending) {
      this._pending = true;
      var self = this;
      Promise.resolve().then(function () {
        self._flush();
      });
    }
  };

  Watcher.prototype._flush = function () {
    var changes = this._changes;
    this._changes = [];
    this._pending = false;
    if (changes.length) this._emit(changes);
  };

  Watcher.prototype._emit = function (changes) {
    var self = this;

    this._listeners.forEach(function (fn) {
      fn(changes, self.proxy);
    });

    if (this._pathListeners.size === 0) return;

    changes.forEach(function (change) {
      self._pathListeners.forEach(function (fns, pattern) {
        if (self._matches(pattern, change.path)) {
          fns.forEach(function (fn) {
            fn(change, self.proxy);
          });
        }
      });
    });
  };

  Watcher.prototype._matches = function (pattern, path) {
    if (pattern === '*' || pattern === path) return true;
    if (pattern.slice(-2) === '.*') {
      var prefix = pattern.slice(0, -2);
      return path === prefix || path.indexOf(prefix + '.') === 0;
    }
    return false;
  };

  /** Subscribe to every change. Returns an unsubscribe function. */
  Watcher.prototype.watch = function (callback) {
    this._listeners.add(callback);
    var self = this;
    return function () {
      self._listeners.delete(callback);
    };
  };

  /**
   * Subscribe to a specific dotted path, or a wildcard like 'order.*'.
   * Returns an unsubscribe function.
   */
  Watcher.prototype.watchPath = function (path, callback) {
    if (!this._pathListeners.has(path)) {
      this._pathListeners.set(path, new Set());
    }
    this._pathListeners.get(path).add(callback);

    var self = this;
    return function () {
      var set = self._pathListeners.get(path);
      if (set) {
        set.delete(callback);
        if (set.size === 0) self._pathListeners.delete(path);
      }
    };
  };

  /** Temporarily stop emitting (e.g. during bulk programmatic updates). */
  Watcher.prototype.pause = function () {
    this._paused = true;
  };

  Watcher.prototype.resume = function () {
    this._paused = false;
  };

  /** Force-flush any pending batched changes immediately. */
  Watcher.prototype.flush = function () {
    if (this._pending) this._flush();
  };

  /** Remove all listeners. Proxy keeps working, just goes silent. */
  Watcher.prototype.destroy = function () {
    this._listeners.clear();
    this._pathListeners.clear();
    this._changes = [];
    this._pending = false;
  };

  function createWatch(target, options) {
    return new Watcher(target, options);
  }

  return { createWatch: createWatch, Watcher: Watcher };
});
