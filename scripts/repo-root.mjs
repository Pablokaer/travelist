// The repository root for the scripts in this folder, as a path the filesystem accepts.
// `new URL(...).pathname` gives '/D:/…' on Windows, which path.join turns into 'D:\D:\…':
// sync-shared and seed-demo crashed there with ENOENT.
import { fileURLToPath } from 'node:url';

/**
 * The folder above the script at `scriptUrl` (its `import.meta.url`): the repository root.
 * @param {string} scriptUrl
 * @returns {string}
 * @example const root = repoRootOf(import.meta.url); // '/home/me/travelist/' or 'D:\\travelist\\'
 */
export function repoRootOf(scriptUrl) {
  return fileURLToPath(new URL('..', scriptUrl));
}
