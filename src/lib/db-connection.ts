/**
 * Builds pg connection options for the cloud Timescale database.
 *
 * Timescale serves a self-signed certificate chain, and pg lets the
 * `sslmode` query parameter in the connection string override the driver's
 * SSL settings. We strip `sslmode` and pass an explicit, lenient TLS
 * verification object so both Prisma's driver adapter and plain pg clients
 * connect reliably.
 */
export interface PgConnectionOptions {
  connectionString: string;
  ssl: { rejectUnauthorized: false };
}

export function buildPgConnectionOptions(connectionString: string): PgConnectionOptions {
  const url = new URL(connectionString);
  url.searchParams.delete("sslmode");
  return {
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false },
  };
}
