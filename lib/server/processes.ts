import type { ChildProcessWithoutNullStreams } from 'node:child_process';

type ManagedChild = ChildProcessWithoutNullStreams;

export function terminateChild(child: ManagedChild) {
  try {
    child.kill('SIGTERM');
  } catch {}
}

export function waitForChildExit(child: ManagedChild) {
  return new Promise<void>((resolve) => {
    child.once('close', () => resolve());
  });
}

export function createChildProcessRegistry() {
  const children = new Set<ManagedChild>();

  if (typeof process !== 'undefined') {
    process.on('beforeExit', () => {
      for (const child of children) {
        terminateChild(child);
      }
    });
  }

  return {
    track(child: ManagedChild) {
      children.add(child);
      return child;
    },
    untrack(child: ManagedChild) {
      children.delete(child);
    },
  };
}
