// Runs before the test framework, before any PrismaClient is instantiated.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ??
  "postgresql://snackmanager:snackmanager@localhost:5434/snackmanager_test?schema=public";
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "test-access-secret";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "test-refresh-secret";
process.env.CORS_ORIGINS = "http://localhost:5273";
