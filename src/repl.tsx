import type { ChildProcess } from 'node:child_process';
import { Box, Text, useApp } from 'ink';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type ServerStatus, getCompletions, loadCommand, processUserInput } from './commands/index';
import { InputPrompt } from './components/input-prompt';
import { type Message, MessageList, type MessageRole } from './components/message-list';
import { StatusBar } from './components/status-bar';
import { StreamingText } from './components/streaming-text';
import { type ResolvedConfig, loadConfig as loadConfigFromDisk } from './lib/config';
import { ContextStore } from './lib/context-store';
import {
	checkServerHealth,
	startModelServer,
	stopModelServer,
	waitForServer,
} from './lib/server-manager';

let msgCounter = 0;
function makeMessage(role: MessageRole, content: string): Message {
	return { id: String(++msgCounter), role, content, timestamp: Date.now() };
}

interface ReplProps {
	config?: ResolvedConfig;
	noServe?: boolean;
}

export function Repl({ config: initialConfig, noServe }: ReplProps) {
	const { exit } = useApp();
	const config = useMemo(() => {
		const c = initialConfig ?? loadConfigFromDisk();
		if (!process.env.LOCAL_MODEL) {
			process.env.LOCAL_MODEL = c.model;
		}
		return c;
	}, [initialConfig]);

	const [messages, setMessages] = useState<Message[]>([
		makeMessage(
			'system',
			'MLX — the personal coding dataset and model pipeline. This retained interface is not connected to the public mlx command.',
		),
	]);
	const [isRunning, setIsRunning] = useState(false);
	const [serverStatus, setServerStatus] = useState<ServerStatus>('stopped');
	const [activeComponent, setActiveComponent] = useState<React.ReactNode>(null);
	const [streamingText, setStreamingText] = useState('');
	const [isStreaming, setIsStreaming] = useState(false);

	const abortRef = useRef<AbortController | null>(null);
	const serverProcRef = useRef<ChildProcess | null>(null);
	const healthIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const contextStore = useRef(new ContextStore()).current;

	const addMessage = useCallback((role: MessageRole, content: string) => {
		setMessages((prev) => [...prev, makeMessage(role, content)]);
	}, []);

	const getServerStatus = useCallback((): ServerStatus => serverStatus, [serverStatus]);

	const stopHealthCheck = useCallback(() => {
		if (healthIntervalRef.current) {
			clearInterval(healthIntervalRef.current);
			healthIntervalRef.current = null;
		}
	}, []);

	const startHealthCheck = useCallback(
		(url: string) => {
			stopHealthCheck();
			healthIntervalRef.current = setInterval(async () => {
				const ok = await checkServerHealth(url);
				if (!ok) {
					setServerStatus((prev) => {
						if (prev === 'ready') {
							addMessage('error', 'Server became unreachable. Run /serve start to restart.');
							return 'error';
						}
						return prev;
					});
					stopHealthCheck();
				}
			}, 10_000);
		},
		[stopHealthCheck, addMessage],
	);

	const startServer = useCallback(async () => {
		if (serverStatus === 'ready' || serverStatus === 'starting') return;

		const url = config.serverUrl ?? `http://localhost:${config.serverPort}/v1/models`;
		try {
			const res = await fetch(url);
			if (res.ok) {
				setServerStatus('ready');
				startHealthCheck(url);
				return;
			}
		} catch {
			// not running
		}

		setServerStatus('starting');
		const proc = startModelServer({
			model: config.model,
			port: config.serverPort,
		});
		serverProcRef.current = proc;

		const waitAbort = new AbortController();

		proc.on('exit', (code) => {
			waitAbort.abort();
			if (serverProcRef.current === proc) {
				serverProcRef.current = null;
				setServerStatus((prev) => {
					if (prev === 'ready' || prev === 'starting') {
						addMessage(
							'error',
							`Server process exited${code != null ? ` (code ${code})` : ''}. Run /serve start to restart.`,
						);
						return 'error';
					}
					return prev;
				});
				stopHealthCheck();
			}
		});

		let stderrOutput = '';
		proc.stderr?.on('data', (d: Buffer) => {
			stderrOutput += d.toString();
		});

		try {
			await waitForServer({ url, signal: waitAbort.signal });
			setServerStatus('ready');
			startHealthCheck(url);
		} catch {
			setServerStatus('error');
			const hint = stderrOutput.includes('ModuleNotFoundError')
				? 'mlx_lm is not installed. Run: pip install mlx-lm'
				: stderrOutput.includes('Address already in use')
					? `Port ${config.serverPort} is already in use. Another server may be running.`
					: 'Server failed to start. Check your model and Python environment.';
			addMessage('error', hint);
		}
	}, [config, serverStatus, addMessage, startHealthCheck, stopHealthCheck]);

	const stopServer = useCallback(() => {
		stopHealthCheck();
		if (serverProcRef.current) {
			stopModelServer(serverProcRef.current);
			serverProcRef.current = null;
		}
		setServerStatus('stopped');
	}, [stopHealthCheck]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally run once on mount
	useEffect(() => {
		if (!noServe && config.repl.autoStartServer) {
			startServer();
		}

		const cleanup = () => {
			if (serverProcRef.current) {
				stopModelServer(serverProcRef.current);
			}
		};
		process.on('exit', cleanup);
		return () => {
			cleanup();
			stopHealthCheck();
			process.removeListener('exit', cleanup);
		};
	}, []);

	const handleCancel = useCallback(() => {
		if (abortRef.current) {
			abortRef.current.abort();
			abortRef.current = null;
			setIsRunning(false);
			setIsStreaming(false);
			setActiveComponent(null);
			addMessage('system', 'Cancelled.');
		}
	}, [addMessage]);

	const handleSubmit = useCallback(
		async (input: string) => {
			const parsed = processUserInput(input);

			if (parsed.kind === 'quit') {
				stopServer();
				exit();
				return;
			}

			if (parsed.kind === 'unknown_command') {
				const suggestions = getCompletions(parsed.name);
				const hint = suggestions.length > 0 ? ` Did you mean /${suggestions[0]}?` : '';
				addMessage('error', `Unknown command: /${parsed.name}.${hint}`);
				return;
			}

			if (parsed.kind === 'conversation') {
				if (!parsed.text) return;
				addMessage('user', parsed.text);

				setIsRunning(true);
				setIsStreaming(true);
				setStreamingText('');
				abortRef.current = new AbortController();

				try {
					const { streamConversation } = await import('./lib/conversation');
					const history = messages
						.filter((m) => m.role === 'user' || m.role === 'assistant')
						.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

					await streamConversation({
						userMessage: parsed.text,
						history,
						context: contextStore,
						signal: abortRef.current.signal,
						onChunk: (chunk) => setStreamingText((prev) => prev + chunk),
						onComplete: (fullText) => {
							setIsStreaming(false);
							setStreamingText('');
							addMessage('assistant', fullText || 'No response.');
						},
					});
				} catch (err) {
					setIsStreaming(false);
					setStreamingText('');
					const msg = err instanceof Error ? err.message : String(err);
					if (msg !== 'This operation was aborted') {
						addMessage('error', `Chat error: ${msg}`);
					}
				} finally {
					setIsRunning(false);
					abortRef.current = null;
				}
				return;
			}

			addMessage('user', input);
			setIsRunning(true);
			abortRef.current = new AbortController();

			try {
				const cmd = await loadCommand(parsed.name);
				if (!cmd) {
					addMessage('error', `Unknown command: ${parsed.name}`);
					return;
				}

				const ctx = {
					args: parsed.args,
					rawInput: input,
					config,
					log: (msg: string) => {
						if (msg === '__clear__') {
							setMessages([]);
							return;
						}
						addMessage('pipeline', msg);
					},
					setComponent: (node: React.ReactNode) => setActiveComponent(node),
					signal: abortRef.current?.signal ?? new AbortController().signal,
					serverStatus: getServerStatus,
					updateContext: (key: string, value: unknown) => contextStore.set(key, value),
					getContext: (key: string) => contextStore.get(key),
					hasContext: (key: string) => contextStore.has(key),
					startServer,
					stopServer,
				};

				if (cmd.kind === 'action') {
					await cmd.run(ctx);
				} else {
					cmd.run(ctx);
				}
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				if (msg !== 'This operation was aborted') {
					addMessage('error', `Command error: ${msg}`);
				}
			} finally {
				setIsRunning(false);
				setActiveComponent(null);
				abortRef.current = null;
			}
		},
		[messages, config, contextStore, addMessage, getServerStatus, startServer, stopServer, exit],
	);

	return (
		<Box flexDirection="column" minHeight={10}>
			<Box paddingX={1}>
				<Text bold color="magenta">
					MLX — the personal coding dataset and model pipeline
				</Text>
			</Box>

			<MessageList
				messages={messages}
				maxVisible={config.repl.maxVisibleMessages}
				activeComponent={
					<>
						{activeComponent}
						{isStreaming && (
							<Box paddingX={1}>
								<StreamingText text={streamingText} />
							</Box>
						)}
					</>
				}
			/>

			<InputPrompt onSubmit={handleSubmit} onCancel={handleCancel} disabled={isRunning} />
			<StatusBar
				serverStatus={serverStatus}
				model={config.model}
				adapter={config.training.adapterDir}
			/>
		</Box>
	);
}
