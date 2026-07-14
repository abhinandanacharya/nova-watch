const { createWatch } = require('../src/nova-watch.js');
const assert = require('assert');

async function main() {
  console.log('Test 1: Date object as a value (must not throw)');
  {
    const w = createWatch({ createdAt: null });
    w.proxy.createdAt = new Date();
    assert(typeof w.proxy.createdAt.getTime() === 'number');
    console.log('  OK');
  }

  console.log('Test 2: Array splice/push/pop, batched into one callback');
  {
    const w = createWatch({ list: [1, 2, 3] });
    let fires = 0;
    w.watch(() => fires++);
    w.proxy.list.splice(1, 1);
    w.proxy.list.push(99);
    w.proxy.list.pop();
    await new Promise((r) => setTimeout(r, 0));
    assert.deepStrictEqual(w.proxy.list, [1, 3]);
    assert.strictEqual(fires, 1);
    console.log('  OK - list:', w.proxy.list, 'fires:', fires);
  }

  console.log('Test 3: Set/Map as a value (must not throw)');
  {
    const w = createWatch({ tags: new Set() });
    w.proxy.tags.add('a');
    assert.strictEqual(w.proxy.tags.size, 1);
    console.log('  OK');
  }

  console.log('Test 4: Referential equality - same nested object, two reads');
  {
    const w = createWatch({ nested: { a: 1 } });
    assert.strictEqual(w.proxy.nested, w.proxy.nested);
    console.log('  OK');
  }

  console.log('Test 5: Circular reference (must not stack-overflow)');
  {
    const obj = { name: 'root' };
    obj.self = obj;
    const w = createWatch(obj);
    assert.strictEqual(w.proxy.self.self.name, 'root');
    console.log('  OK');
  }

  console.log('Test 6: Overwriting a nested object with null');
  {
    const w = createWatch({ a: { b: 1 } });
    w.proxy.a = null;
    assert.strictEqual(w.proxy.a, null);
    console.log('  OK');
  }

  console.log('Test 7: push() on an array present since construction');
  {
    const w = createWatch({ product: [] });
    let fires = 0;
    w.watch(() => fires++);
    w.proxy.product.push({ id: 1 });
    w.proxy.product.push({ id: 2 });
    await new Promise((r) => setTimeout(r, 0));
    assert.strictEqual(w.proxy.product.length, 2);
    assert.strictEqual(fires, 1);
    console.log('  OK - product:', w.proxy.product, 'fires:', fires);
  }

  console.log('Test 8: watchPath receives every value in a batch, in order');
  {
    const w = createWatch({ order: { discount: { value: 0 } } });
    const values = [];
    w.watchPath('order.discount.value', (c) => values.push(c.value));
    w.proxy.order.discount.value = 5;
    w.proxy.order.discount.value = 10;
    await new Promise((r) => setTimeout(r, 0));
    assert.deepStrictEqual(values, [5, 10]);
    console.log('  OK - values:', values);
  }

  console.log('\nAll tests passed.');
}

main().catch((e) => {
  console.error('TEST FAILED:', e.message);
  process.exit(1);
});
