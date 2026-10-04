// The owner of the seeded public library. One definition for auto-seed, the
// account purge and the reassign script. Imports nothing on purpose: the script
// runs under tsx and must not load lib/mongodb.ts.
export const SYSTEM_USER_ID = 'system';
