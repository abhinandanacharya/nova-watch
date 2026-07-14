// Node: const { createWatch } = require('nova-watch');
// Browser: <script src=".../nova-watch.min.js"></script> then window.NovaWatch
const { createWatch } = require('../src/nova-watch.js');

function calculateBilling(data) {
  console.log('calculateBilling called with:', JSON.stringify(data));
}

// 1. Create the watcher instance
const billing = createWatch({
  product: [],
  order: {
    totals: {},
    discount: {
      type: '',
      value: 0
    }
  }
});

// 2. React to ANY change, batched into one call per tick
billing.watch((changes, state) => {
  calculateBilling(state);
});

// 3. Or react only to specific paths (no wildcard noise)
const unwatchDiscount = billing.watchPath('order.discount.*', (change) => {
  console.log(`${change.path} changed:`, change.oldValue, '->', change.value);
});

// --- usage ---
const data = billing.proxy;

data.order.discount.type = 'percentage';
data.order.discount.value = 10;
data.product.push({ id: 1, name: 'Sofa', price: 25000 });

// All three sets above happened synchronously in the same tick,
// so calculateBilling fires ONCE (microtask-batched), not 3 times.

// Bulk-load without triggering anything, then flush once at the end:
billing.pause();
data.order.totals = { subtotal: 25000, tax: 4500, grand: 29500 };
data.order.discount.value = 15;
billing.resume();
billing.flush(); // calculateBilling fires now, with the final state

unwatchDiscount(); // stop listening to discount changes
