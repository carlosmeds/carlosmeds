export interface Logger {
  info(message: string): void;
  warn(message: string): void;
}

export const consoleLogger: Logger = {
  info: (message) => console.log(message),
  warn: (message) => console.warn(`warning: ${message}`),
};

export const silentLogger: Logger = { info: () => {}, warn: () => {} };
