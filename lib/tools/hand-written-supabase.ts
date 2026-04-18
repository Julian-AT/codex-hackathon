/**
 * Hand-written Supabase-domain tools — SWR-08 kill-point safety net.
 *
 * 8 pure-compute, deterministic, offline-safe tools that pass the full
 * 5-gate validator. If the Phase 3 swarm produces <4 valid tools, the
 * coordinator swaps in these as the fallback manifest.
 *
 * Every jsBody runs in vm.createContext({}) — NO Buffer, NO atob, NO
 * Node globals. Only JS builtins (JSON, Math, Date constructor, RegExp,
 * String, Array, Object, etc.).
 */

import type { DynamicToolSpec } from '../discovery/types.js';

export const HAND_WRITTEN_SUPABASE_TOOLS: DynamicToolSpec[] = [
  // ── 1. supabase_rls_policy_template ──────────────────────────────
  {
    type: 'function',
    function: {
      name: 'supabase_rls_policy_template',
      description:
        'Emit a Supabase RLS policy DDL template for a given table, role, and operation.',
      parameters: {
        type: 'object',
        properties: {
          tableName: { type: 'string' },
          role: { type: 'string', enum: ['authenticated', 'anon', 'service_role'] },
          operation: { type: 'string', enum: ['select', 'insert', 'update', 'delete'] },
        },
        required: ['tableName', 'role', 'operation'],
        additionalProperties: false,
      },
    },
    meta: {
      jsBody: `function supabase_rls_policy_template(args) { var op = String(args.operation || '').toUpperCase(); var role = String(args.role || 'authenticated'); var table = String(args.tableName || ''); var policy = 'CREATE POLICY "' + table + '_' + op.toLowerCase() + '_' + role + '" ON public.' + table + ' FOR ' + op + ' TO ' + role + ' USING (auth.uid() = user_id);'; return { policy: policy }; }`,
      requiresNetwork: false,
      trajectories: [
        {
          userPrompt: 'Write an RLS policy for select on profiles for authenticated users.',
          call: {
            name: 'supabase_rls_policy_template',
            arguments: { tableName: 'profiles', role: 'authenticated', operation: 'select' },
          },
          result: {
            policy:
              'CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);',
          },
        },
        {
          userPrompt: 'RLS insert policy for posts table, authenticated.',
          call: {
            name: 'supabase_rls_policy_template',
            arguments: { tableName: 'posts', role: 'authenticated', operation: 'insert' },
          },
          result: {
            policy:
              'CREATE POLICY "posts_insert_authenticated" ON public.posts FOR INSERT TO authenticated USING (auth.uid() = user_id);',
          },
        },
        {
          userPrompt: 'RLS delete for comments, service role.',
          call: {
            name: 'supabase_rls_policy_template',
            arguments: { tableName: 'comments', role: 'service_role', operation: 'delete' },
          },
          result: {
            policy:
              'CREATE POLICY "comments_delete_service_role" ON public.comments FOR DELETE TO service_role USING (auth.uid() = user_id);',
          },
        },
      ],
      sourceWorker: 'hand-written',
      sourceChunks: [],
    },
  },

  // ── 2. supabase_select_query_builder ─────────────────────────────
  {
    type: 'function',
    function: {
      name: 'supabase_select_query_builder',
      description:
        'Build a parameterized SELECT query from table, columns, and filters.',
      parameters: {
        type: 'object',
        properties: {
          table: { type: 'string' },
          columns: { type: 'array', items: { type: 'string' } },
          filters: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                column: { type: 'string' },
                op: { type: 'string', enum: ['eq', 'neq', 'gt', 'lt'] },
                value: {},
              },
              required: ['column', 'op', 'value'],
              additionalProperties: false,
            },
          },
        },
        required: ['table', 'columns', 'filters'],
        additionalProperties: false,
      },
    },
    meta: {
      jsBody: `function supabase_select_query_builder(args) { var table = String(args.table || ''); var cols = Array.isArray(args.columns) && args.columns.length > 0 ? args.columns.map(function(c) { return String(c); }) : ['*']; var filters = Array.isArray(args.filters) ? args.filters : []; var sql = 'SELECT ' + cols.join(', ') + ' FROM ' + table; var wheres = []; var paramIdx = 1; for (var i = 0; i < filters.length; i++) { var f = filters[i]; if (f && typeof f === 'object' && !Array.isArray(f)) { var col = String(f.column || ''); var op = String(f.op || 'eq'); var opMap = { eq: '=', neq: '!=', gt: '>', lt: '<' }; var sqlOp = opMap[op] || '='; wheres.push(col + ' ' + sqlOp + ' $' + paramIdx); paramIdx++; } } if (wheres.length > 0) sql += ' WHERE ' + wheres.join(' AND '); sql += ';'; return { sql: sql }; }`,
      requiresNetwork: false,
      trajectories: [
        {
          userPrompt: 'Select id and email from users where id equals 123.',
          call: {
            name: 'supabase_select_query_builder',
            arguments: {
              table: 'users',
              columns: ['id', 'email'],
              filters: [{ column: 'id', op: 'eq', value: '123' }],
            },
          },
          result: { sql: 'SELECT id, email FROM users WHERE id = $1;' },
        },
        {
          userPrompt: 'Select all columns from orders with no filters.',
          call: {
            name: 'supabase_select_query_builder',
            arguments: { table: 'orders', columns: ['*'], filters: [] },
          },
          result: { sql: 'SELECT * FROM orders;' },
        },
        {
          userPrompt: 'Select name and price from products where price > 100 and name != test.',
          call: {
            name: 'supabase_select_query_builder',
            arguments: {
              table: 'products',
              columns: ['name', 'price'],
              filters: [
                { column: 'price', op: 'gt', value: 100 },
                { column: 'name', op: 'neq', value: 'test' },
              ],
            },
          },
          result: {
            sql: 'SELECT name, price FROM products WHERE price > $1 AND name != $2;',
          },
        },
      ],
      sourceWorker: 'hand-written',
      sourceChunks: [],
    },
  },

  // ── 3. supabase_storage_path_builder ─────────────────────────────
  {
    type: 'function',
    function: {
      name: 'supabase_storage_path_builder',
      description:
        'Build a Supabase Storage object path from bucket, userId, and filename.',
      parameters: {
        type: 'object',
        properties: {
          bucket: { type: 'string' },
          userId: { type: 'string' },
          filename: { type: 'string' },
        },
        required: ['bucket', 'userId', 'filename'],
        additionalProperties: false,
      },
    },
    meta: {
      jsBody: `function supabase_storage_path_builder(args) { var bucket = String(args.bucket || ''); var userId = String(args.userId || ''); var filename = String(args.filename || ''); return { path: bucket + '/' + userId + '/' + filename }; }`,
      requiresNetwork: false,
      trajectories: [
        {
          userPrompt: 'Build a storage path for user abc-123 uploading photo.png to avatars bucket.',
          call: {
            name: 'supabase_storage_path_builder',
            arguments: { bucket: 'avatars', userId: 'abc-123', filename: 'photo.png' },
          },
          result: { path: 'avatars/abc-123/photo.png' },
        },
        {
          userPrompt: 'Storage path for report.pdf in documents bucket for user-456.',
          call: {
            name: 'supabase_storage_path_builder',
            arguments: { bucket: 'documents', userId: 'user-456', filename: 'report.pdf' },
          },
          result: { path: 'documents/user-456/report.pdf' },
        },
        {
          userPrompt: 'Storage path for logo.svg in public bucket, no user.',
          call: {
            name: 'supabase_storage_path_builder',
            arguments: { bucket: 'public', userId: 'shared', filename: 'logo.svg' },
          },
          result: { path: 'public/shared/logo.svg' },
        },
      ],
      sourceWorker: 'hand-written',
      sourceChunks: [],
    },
  },

  // ── 4. supabase_edge_function_name_validator ─────────────────────
  {
    type: 'function',
    function: {
      name: 'supabase_edge_function_name_validator',
      description:
        'Validate a Supabase Edge Function name against Deno-compatible naming rules.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
        additionalProperties: false,
      },
    },
    meta: {
      jsBody: `function supabase_edge_function_name_validator(args) { var name = String(args.name || ''); if (name.length === 0) return { valid: false, reason: 'name must not be empty' }; if (name.length > 64) return { valid: false, reason: 'name must be at most 64 characters' }; if (!/^[a-z][a-z0-9_-]*$/.test(name)) return { valid: false, reason: 'name must start with lowercase letter and contain only a-z, 0-9, hyphens, underscores' }; return { valid: true }; }`,
      requiresNetwork: false,
      trajectories: [
        {
          userPrompt: 'Is hello-world a valid edge function name?',
          call: {
            name: 'supabase_edge_function_name_validator',
            arguments: { name: 'hello-world' },
          },
          result: { valid: true },
        },
        {
          userPrompt: 'Validate edge function name Hello.',
          call: {
            name: 'supabase_edge_function_name_validator',
            arguments: { name: 'Hello' },
          },
          result: {
            valid: false,
            reason:
              'name must start with lowercase letter and contain only a-z, 0-9, hyphens, underscores',
          },
        },
        {
          userPrompt: 'Validate empty edge function name.',
          call: {
            name: 'supabase_edge_function_name_validator',
            arguments: { name: '' },
          },
          result: { valid: false, reason: 'name must not be empty' },
        },
      ],
      sourceWorker: 'hand-written',
      sourceChunks: [],
    },
  },

  // ── 5. supabase_column_type_mapper ───────────────────────────────
  {
    type: 'function',
    function: {
      name: 'supabase_column_type_mapper',
      description:
        'Map a PostgreSQL column type to its TypeScript equivalent.',
      parameters: {
        type: 'object',
        properties: {
          postgresType: { type: 'string' },
        },
        required: ['postgresType'],
        additionalProperties: false,
      },
    },
    meta: {
      jsBody: `function supabase_column_type_mapper(args) { var pgType = String(args.postgresType || '').toLowerCase(); var map = { 'text': 'string', 'varchar': 'string', 'char': 'string', 'uuid': 'string', 'int2': 'number', 'int4': 'number', 'int8': 'number', 'float4': 'number', 'float8': 'number', 'numeric': 'number', 'integer': 'number', 'bigint': 'number', 'smallint': 'number', 'real': 'number', 'double precision': 'number', 'bool': 'boolean', 'boolean': 'boolean', 'json': 'Record<string, unknown>', 'jsonb': 'Record<string, unknown>', 'timestamp': 'string', 'timestamptz': 'string', 'date': 'string', 'time': 'string', 'bytea': 'string' }; return { tsType: map[pgType] || 'unknown' }; }`,
      requiresNetwork: false,
      trajectories: [
        {
          userPrompt: 'What TypeScript type maps to PostgreSQL text?',
          call: {
            name: 'supabase_column_type_mapper',
            arguments: { postgresType: 'text' },
          },
          result: { tsType: 'string' },
        },
        {
          userPrompt: 'Map int4 to TypeScript.',
          call: {
            name: 'supabase_column_type_mapper',
            arguments: { postgresType: 'int4' },
          },
          result: { tsType: 'number' },
        },
        {
          userPrompt: 'Map boolean to TypeScript.',
          call: {
            name: 'supabase_column_type_mapper',
            arguments: { postgresType: 'boolean' },
          },
          result: { tsType: 'boolean' },
        },
      ],
      sourceWorker: 'hand-written',
      sourceChunks: [],
    },
  },

  // ── 6. supabase_connection_string_parser ─────────────────────────
  {
    type: 'function',
    function: {
      name: 'supabase_connection_string_parser',
      description:
        'Parse a PostgreSQL connection string into host, port, database, and user components. Pure regex, no network.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string' },
        },
        required: ['url'],
        additionalProperties: false,
      },
    },
    meta: {
      jsBody: `function supabase_connection_string_parser(args) { var url = String(args.url || ''); var m = /^postgres(?:ql)?:\\/\\/([^:@]+)(?::([^@]*))?@([^:\\/]+)(?::(\\d+))?\\/(.+)$/.exec(url); if (!m) return { host: '', port: 5432, database: '', user: '' }; return { host: m[3] || '', port: m[4] ? Number(m[4]) : 5432, database: m[5] || '', user: m[1] || '' }; }`,
      requiresNetwork: false,
      trajectories: [
        {
          userPrompt: 'Parse postgresql://admin:secret@db.example.com:5432/mydb.',
          call: {
            name: 'supabase_connection_string_parser',
            arguments: { url: 'postgresql://admin:secret@db.example.com:5432/mydb' },
          },
          result: { host: 'db.example.com', port: 5432, database: 'mydb', user: 'admin' },
        },
        {
          userPrompt: 'Parse postgres://user@localhost/testdb.',
          call: {
            name: 'supabase_connection_string_parser',
            arguments: { url: 'postgres://user@localhost/testdb' },
          },
          result: { host: 'localhost', port: 5432, database: 'testdb', user: 'user' },
        },
        {
          userPrompt: 'Parse an invalid connection string.',
          call: {
            name: 'supabase_connection_string_parser',
            arguments: { url: 'not-a-url' },
          },
          result: { host: '', port: 5432, database: '', user: '' },
        },
      ],
      sourceWorker: 'hand-written',
      sourceChunks: [],
    },
  },

  // ── 7. supabase_jwt_claims_extractor ─────────────────────────────
  {
    type: 'function',
    function: {
      name: 'supabase_jwt_claims_extractor',
      description:
        'Extract sub, role, and exp claims from a JWT by base64url-decoding the payload segment. No signature verification.',
      parameters: {
        type: 'object',
        properties: {
          jwt: { type: 'string' },
        },
        required: ['jwt'],
        additionalProperties: false,
      },
    },
    meta: {
      jsBody: `function supabase_jwt_claims_extractor(args) { var jwt = String(args.jwt || ''); var parts = jwt.split('.'); if (parts.length < 3) return { sub: null, role: null, exp: null }; var seg = parts[1]; var b = seg.replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '='; var alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'; var out = ''; for (var i = 0; i < b.length; i += 4) { var a0 = alpha.indexOf(b[i]); if (a0 < 0) a0 = 0; var a1 = alpha.indexOf(b[i + 1]); if (a1 < 0) a1 = 0; var a2 = alpha.indexOf(b[i + 2]); if (a2 < 0) a2 = 0; var a3 = alpha.indexOf(b[i + 3]); if (a3 < 0) a3 = 0; var n = (a0 << 18) | (a1 << 12) | (a2 << 6) | a3; out += String.fromCharCode((n >> 16) & 255); if (b[i + 2] !== '=') out += String.fromCharCode((n >> 8) & 255); if (b[i + 3] !== '=') out += String.fromCharCode(n & 255); } try { var obj = JSON.parse(out); return { sub: typeof obj.sub === 'string' ? obj.sub : null, role: typeof obj.role === 'string' ? obj.role : null, exp: typeof obj.exp === 'number' ? obj.exp : null }; } catch (e) { return { sub: null, role: null, exp: null }; } }`,
      requiresNetwork: false,
      trajectories: [
        {
          userPrompt: 'Extract claims from an authenticated user JWT.',
          call: {
            name: 'supabase_jwt_claims_extractor',
            arguments: {
              jwt: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyIsInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzAwMDAwMDAwfQ.signature',
            },
          },
          result: { sub: 'user-123', role: 'authenticated', exp: 1700000000 },
        },
        {
          userPrompt: 'Extract claims from an anon JWT.',
          call: {
            name: 'supabase_jwt_claims_extractor',
            arguments: {
              jwt: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhbm9uLTQ1NiIsInJvbGUiOiJhbm9uIiwiZXhwIjoxODAwMDAwMDAwfQ.sig',
            },
          },
          result: { sub: 'anon-456', role: 'anon', exp: 1800000000 },
        },
        {
          userPrompt: 'Extract claims from a JWT with no role claim.',
          call: {
            name: 'supabase_jwt_claims_extractor',
            arguments: {
              jwt: 'header.eyJzdWIiOiJzdmMtNzg5IiwiZXhwIjoxNjAwMDAwMDAwfQ.sig',
            },
          },
          result: { sub: 'svc-789', role: null, exp: 1600000000 },
        },
      ],
      sourceWorker: 'hand-written',
      sourceChunks: [],
    },
  },

  // ── 8. supabase_migration_filename ───────────────────────────────
  {
    type: 'function',
    function: {
      name: 'supabase_migration_filename',
      description:
        'Generate a canonical Supabase migration filename from a timestamp and description (YYYYMMDDHHMMSS_snake_case.sql).',
      parameters: {
        type: 'object',
        properties: {
          timestampMs: { type: 'number' },
          description: { type: 'string' },
        },
        required: ['timestampMs', 'description'],
        additionalProperties: false,
      },
    },
    meta: {
      jsBody: `function supabase_migration_filename(args) { var ms = Number(args.timestampMs) || 0; var desc = String(args.description || ''); var d = new Date(ms); var y = d.getUTCFullYear(); var mo = d.getUTCMonth() + 1; var day = d.getUTCDate(); var h = d.getUTCHours(); var mi = d.getUTCMinutes(); var s = d.getUTCSeconds(); function pad(n, len) { var str = String(n); while (str.length < len) str = '0' + str; return str; } var ts = pad(y, 4) + pad(mo, 2) + pad(day, 2) + pad(h, 2) + pad(mi, 2) + pad(s, 2); var snake = desc.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); if (!snake) snake = 'migration'; return { filename: ts + '_' + snake + '.sql' }; }`,
      requiresNetwork: false,
      trajectories: [
        {
          userPrompt: 'Generate migration filename for "Add users table" at timestamp 1700000000000.',
          call: {
            name: 'supabase_migration_filename',
            arguments: { timestampMs: 1700000000000, description: 'Add users table' },
          },
          result: { filename: '20231114221320_add_users_table.sql' },
        },
        {
          userPrompt: 'Migration filename for "create-posts" at 2021-01-01 00:00:00 UTC.',
          call: {
            name: 'supabase_migration_filename',
            arguments: { timestampMs: 1609459200000, description: 'create-posts' },
          },
          result: { filename: '20210101000000_create_posts.sql' },
        },
        {
          userPrompt: 'Migration filename for "Initial Schema Setup" at epoch 0.',
          call: {
            name: 'supabase_migration_filename',
            arguments: { timestampMs: 0, description: 'Initial Schema Setup' },
          },
          result: { filename: '19700101000000_initial_schema_setup.sql' },
        },
      ],
      sourceWorker: 'hand-written',
      sourceChunks: [],
    },
  },
];
