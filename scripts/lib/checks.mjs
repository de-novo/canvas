/**
 * Shared runner for the `verify-*.mjs` scripts.
 *
 * Two properties matter here, because both were previously missing:
 *
 * 1. **Failure isolation.** A failing assertion records itself and the run
 *    continues, so one break does not hide every check behind it.
 * 2. **The report reflects what actually ran.** `ok` is derived from the
 *    collected failures and `checks` from the names that executed — neither is
 *    written by hand. A deleted check disappears from the report instead of
 *    lingering as a name that looks like it passed.
 */

/**
 * @typedef {{ name: string, error: string }} CheckFailure
 */

export function createCheckRunner() {
  /** @type {string[]} */
  const passed = [];
  /** @type {CheckFailure[]} */
  const failed = [];

  /**
   * Runs one named check.
   *
   * A synchronous `fn` is settled synchronously, so existing call sites that do
   * not `await` keep their original ordering. An async `fn` returns a promise
   * the caller must await.
   *
   * @param {string} name
   * @param {() => unknown | Promise<unknown>} fn
   * @returns {void | Promise<void>}
   */
  function check(name, fn) {
    if (passed.includes(name) || failed.some((entry) => entry.name === name)) {
      throw new Error(`Duplicate check name: ${name}`);
    }

    const record = (error) => {
      if (error === undefined) {
        passed.push(name);
        return;
      }
      failed.push({
        name,
        error: error instanceof Error ? error.message : String(error)
      });
    };

    let result;
    try {
      result = fn();
    } catch (error) {
      record(error);
      return;
    }

    if (result instanceof Promise) {
      return result.then(
        () => record(undefined),
        (error) => record(error)
      );
    }

    record(undefined);
    return undefined;
  }

  /**
   * Prints the JSON report and sets a non-zero exit code when anything failed.
   *
   * @param {Record<string, unknown>} [extra] Additional fields to include.
   */
  function report(extra = {}) {
    const ok = failed.length === 0;

    console.log(
      JSON.stringify(
        {
          checks: passed,
          ...(ok ? {} : { failures: failed }),
          ...extra,
          ok
        },
        null,
        2
      )
    );

    if (!ok) {
      process.exitCode = 1;
    }

    return ok;
  }

  return { check, report };
}
