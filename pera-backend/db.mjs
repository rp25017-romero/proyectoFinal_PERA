import pg from 'pg';

export const db = new pg.Pool({ connectionTimeoutMillis: 5000 });
