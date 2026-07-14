# NovaWatch

# nova-state-watch

A tiny (~2KB unminified, zero dependencies) deep reactive state watcher built on `Proxy`. Mutate a plain object naturally — arrays included — and get notified on change, batched into a single callback per tick.

Think `useEffect`, but for any plain JS object, anywhere (Node, vanilla browser, or a framework).

## Install

```bash
npm install nova-state-watch
```

Or drop it in via CDN:

```html

<script src="https://cdn.jsdelivr.net/gh/abhinandanacharya/nova-watch@main/dist/nova-watch.min.js"></script>
<script>
  const state = NovaWatch.createWatch({ count: 0 });
</script>
```

## Quick start

```js
const { createWatch } = require('nova-state-watch');

const billing = createWatch({
  order: { discount: { type: '', value: 0 } }
});

billing.watch((changes, state) => {
  console.log('Something changed:', changes);
  recalculateBilling(state);
});

const data = billing.proxy;
data.order.discount.type = 'flat';
data.order.discount.value = 500;
// -> your callback fires ONCE, after both sets, not twice
```

## Why batching matters

Setting several properties in the same synchronous block (very common in form handlers) used to mean one callback per `set()`. NovaWatch queues changes into a microtask and flushes them together, so a burst of 10 field updates triggers your expensive recalculation function once, not 10 times.

Turn it off per-instance if you want synchronous, immediate notifications instead:

```js
createWatch(target, { batch: false });
```

## API

### `createWatch(target, options?)`
Returns a `Watcher` instance. `target` defaults to `{}`.

### `watcher.proxy`
The reactive object. Mutate it like a normal object/array — nested objects are automatically wrapped too.

### `watcher.watch(fn)`
Subscribe to **all** changes. `fn(changes, proxy)` — `changes` is an array of `{ path, pathArr, value, oldValue, type }`. Returns an unsubscribe function.

### `watcher.watchPath(pattern, fn)`
Subscribe to one dotted path (`'order.discount.value'`) or a wildcard (`'order.discount.*'`, `'*'` for everything). `fn(change, proxy)` fires per matching change. Returns an unsubscribe function.

### `watcher.pause()` / `watcher.resume()`
Silence notifications during bulk programmatic writes, then resume.

### `watcher.flush()`
Immediately fire any pending batched changes without waiting for the microtask tick.

### `watcher.destroy()`
Clears all listeners. The proxy itself keeps working — it just goes quiet.

## Example: your original billing use case

See [`examples/billing-example.js`](./examples/billing-example.js) — a direct port of a hand-rolled `calculateBilling`-on-every-set Proxy into NovaWatch, with batching and path-scoped watching.

## License

MIT
