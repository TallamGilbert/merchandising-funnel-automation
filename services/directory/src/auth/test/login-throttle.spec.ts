import { LOCKOUT_MS, LoginThrottle, MAX_FAILED_ATTEMPTS } from "../login-throttle";

describe("LoginThrottle", () => {
  const now = 1_000_000;

  function failTimes(throttle: LoginThrottle, n: number, at = now) {
    for (let i = 0; i < n; i++) throttle.recordFailure("amy", at);
  }

  it("allows attempts below the limit", () => {
    const throttle = new LoginThrottle();
    failTimes(throttle, MAX_FAILED_ATTEMPTS - 1);
    expect(throttle.lockedFor("amy", now)).toBe(0);
  });

  it("locks for 15 minutes at the limit", () => {
    const throttle = new LoginThrottle();
    failTimes(throttle, MAX_FAILED_ATTEMPTS);
    expect(throttle.lockedFor("amy", now)).toBe(LOCKOUT_MS);
    expect(throttle.lockedFor("amy", now + LOCKOUT_MS)).toBe(0);
  });

  it("starts counting again after a lock expires", () => {
    const throttle = new LoginThrottle();
    failTimes(throttle, MAX_FAILED_ATTEMPTS);
    throttle.recordFailure("amy", now + LOCKOUT_MS + 1);
    expect(throttle.lockedFor("amy", now + LOCKOUT_MS + 1)).toBe(0);
  });

  it("clears the count on success", () => {
    const throttle = new LoginThrottle();
    failTimes(throttle, MAX_FAILED_ATTEMPTS - 1);
    throttle.recordSuccess("amy");
    throttle.recordFailure("amy", now);
    expect(throttle.lockedFor("amy", now)).toBe(0);
  });

  it("tracks each staff id separately", () => {
    const throttle = new LoginThrottle();
    failTimes(throttle, MAX_FAILED_ATTEMPTS);
    expect(throttle.lockedFor("brian", now)).toBe(0);
  });
});
