import type { CliEnvelope } from './main';

export function renderJson(envelope: CliEnvelope): string {
	const orderedEnvelope: CliEnvelope = {
		schemaVersion: envelope.schemaVersion,
		ok: envelope.ok,
		command: envelope.command,
		status: envelope.status,
		data: envelope.data,
		error: envelope.error,
	};
	return `${JSON.stringify(orderedEnvelope)}\n`;
}
