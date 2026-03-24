/**
 * PM2 Windows Bootstrap
 * Patches child_process.fork and child_process.spawn to always pass
 * windowsHide: true, preventing child processes from opening console windows.
 */
const cp = require("child_process");

const _fork = cp.fork.bind(cp);
const _spawn = cp.spawn.bind(cp);

cp.fork = function (modulePath, args, options) {
  if (typeof args === "object" && !Array.isArray(args)) {
    options = args;
    args = [];
  }
  options = { windowsHide: true, ...options };
  return _fork(modulePath, args, options);
};

cp.spawn = function (command, args, options) {
  if (typeof args === "object" && !Array.isArray(args)) {
    options = args;
    args = [];
  }
  options = { windowsHide: true, ...options };
  return _spawn(command, args, options);
};

// Run the target script passed as first argument
const target = process.argv[2];
if (!target) {
  console.error("pm2-bootstrap: no target script specified");
  process.exit(1);
}

process.argv.splice(2, 1); // remove bootstrap arg so target sees correct argv
require(target);
