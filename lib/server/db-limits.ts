// Server-side deadline for a single MongoDB read. A list query that runs past it
// is aborted by the server (MaxTimeMSExpired) instead of holding the function
// open until the platform kills it.
export const DB_QUERY_MAX_TIME_MS = 5000;
