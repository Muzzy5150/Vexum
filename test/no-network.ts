// Unit tests may use explicitly supplied transports/mocks only.
process.env.VEXUM_NO_BROADCAST = "1";
process.env.NODE_ENV = "test";
globalThis.fetch = async () => {
  throw new Error("External HTTP is disabled in unit tests");
};
