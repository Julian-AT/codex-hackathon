import vm from 'node:vm';
import { parentPort, workerData } from 'node:worker_threads';

try {
	const { jsBody, args } = workerData;
	// Extract function name from the body (convention: `function <name>(args) { ... }`)
	const nameMatch = /function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(jsBody);
	if (!nameMatch) {
		parentPort.postMessage({ ok: false, error: 'sandbox: no named function in body' });
		process.exit(0);
	}
	const fnName = nameMatch[1];
	const ctx = vm.createContext({}); // empty context: no fetch, no require, no process
	const script = new vm.Script(`${jsBody}\n;JSON.stringify(${fnName}(${JSON.stringify(args)}))`);
	const raw = script.runInContext(ctx, { timeout: 1500 });
	// Roundtrip to enforce serializability
	const value = JSON.parse(raw);
	parentPort.postMessage({ ok: true, value });
} catch (err) {
	parentPort.postMessage({
		ok: false,
		error: String(err?.message ? err.message : err).slice(0, 400),
	});
}
