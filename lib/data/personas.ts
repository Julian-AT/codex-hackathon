/**
 * Persona pool + seedable PRNG helpers.
 * Source of truth: PRD SS7.1, SS7.2 and plan 04-01.
 */

import { createHash } from 'node:crypto';
import type { Persona } from './types';
import { DIFFICULTIES as _DIFFICULTIES } from './types';

/* Re-export DIFFICULTIES from the single source of truth */
export const DIFFICULTIES = _DIFFICULTIES;

/* ------------------------------------------------------------------ */
/*  Persona pool                                                      */
/* ------------------------------------------------------------------ */

export const PERSONAS: Persona[] = [
  {
    id: 'junior-dev',
    label: 'Junior Developer',
    voice: 'You are a junior developer new to Supabase, asking basic questions about setup, auth flows, and simple CRUD operations.',
  },
  {
    id: 'senior-backend',
    label: 'Senior Backend Engineer',
    voice: 'You are a senior backend engineer evaluating Postgres for production. Ask precise, schema-aware questions.',
  },
  {
    id: 'security-auditor',
    label: 'Security Auditor',
    voice: 'You are a security auditor probing for RLS misconfigurations, JWT weaknesses, and privilege-escalation vectors.',
  },
  {
    id: 'devops',
    label: 'DevOps Engineer',
    voice: 'You are a DevOps engineer focused on CI/CD pipelines, edge function deployments, and connection-pool tuning.',
  },
  {
    id: 'mobile-dev',
    label: 'Mobile Developer',
    voice: 'You are a mobile developer integrating Supabase into a React Native app, concerned with offline sync and auth tokens.',
  },
  {
    id: 'data-engineer',
    label: 'Data Engineer',
    voice: 'You are a data engineer designing ETL pipelines, asking about Postgres functions, triggers, and bulk-insert performance.',
  },
  {
    id: 'indie-hacker',
    label: 'Indie Hacker',
    voice: 'You are an indie hacker building fast with Supabase, asking about storage buckets, realtime subscriptions, and quick-start patterns.',
  },
  {
    id: 'dba',
    label: 'Database Administrator',
    voice: 'You are a DBA focused on index optimization, query plans, vacuum tuning, and Postgres extension management.',
  },
];

/* ------------------------------------------------------------------ */
/*  Seedable PRNG (mulberry32)                                        */
/* ------------------------------------------------------------------ */

/**
 * Create a deterministic PRNG from a string seed.
 * Uses SHA-256 to derive the initial state, then mulberry32 for the sequence.
 * NEVER use Math.random() — all randomness must go through this.
 */
export function makeRng(seed: string): () => number {
  const hash = createHash('sha256').update(seed).digest();
  let state = hash.readUInt32BE(0);

  // mulberry32
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/*  Sampling helpers                                                  */
/* ------------------------------------------------------------------ */

/** Pick a random persona using the given PRNG. */
export function samplePersona(rng: () => number): Persona {
  return PERSONAS[Math.floor(rng() * PERSONAS.length)];
}

/** Pick a random difficulty using the given PRNG. */
export function sampleDifficulty(rng: () => number): (typeof DIFFICULTIES)[number] {
  return DIFFICULTIES[Math.floor(rng() * DIFFICULTIES.length)];
}
