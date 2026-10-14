process.env.TESTCONTAINERS_RYUK_DISABLED ??= "true";

export default {
  test: {
    hookTimeout: 180_000,
  },
};
