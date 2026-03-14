const { spawn } = require("node:child_process");
const path = require("node:path");
const readline = require("node:readline");

const rootDir = path.resolve(__dirname, "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const services = [
  { name: "api", cwd: path.join(rootDir, "api") },
  { name: "studio", cwd: path.join(rootDir, "studio") },
];

const children = new Map();
let shuttingDown = false;
let requestedExitCode = 0;

function writePrefixed(stream, serviceName, line) {
  stream.write(`[${serviceName}] ${line}\n`);
}

function pipeOutput(stream, serviceName, target) {
  const rl = readline.createInterface({ input: stream });

  rl.on("line", (line) => {
    writePrefixed(target, serviceName, line);
  });
}

function killChild(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
    });
    killer.on("error", () => {});
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch (error) {
    if (error.code !== "ESRCH") {
      throw error;
    }
  }

  setTimeout(() => {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch (error) {
      if (error.code !== "ESRCH") {
        throw error;
      }
    }
  }, 3000).unref();
}

function maybeExit() {
  if (children.size === 0) {
    process.exit(requestedExitCode);
  }
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  requestedExitCode = exitCode;

  for (const child of children.values()) {
    killChild(child);
  }

  setTimeout(() => {
    process.exit(requestedExitCode);
  }, 5000).unref();

  maybeExit();
}

function startService(service) {
  const child = spawn(npmCommand, ["run", "dev"], {
    cwd: service.cwd,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  });

  children.set(service.name, child);

  pipeOutput(child.stdout, service.name, process.stdout);
  pipeOutput(child.stderr, service.name, process.stderr);

  child.on("error", (error) => {
    writePrefixed(process.stderr, service.name, `failed to start: ${error.message}`);
    shutdown(1);
  });

  child.on("exit", (code, signal) => {
    children.delete(service.name);

    if (!shuttingDown) {
      const reason = signal ? `signal ${signal}` : `exit code ${code ?? 0}`;
      writePrefixed(process.stderr, service.name, `stopped with ${reason}`);
      shutdown(code === 0 && !signal ? 1 : code ?? 1);
      return;
    }

    maybeExit();
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

for (const service of services) {
  startService(service);
}
