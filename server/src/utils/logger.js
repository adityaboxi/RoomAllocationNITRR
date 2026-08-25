
class Logger {
  constructor() {
    this.logs = [];
    this.maxLogs = 1000;
  }

  format(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const dataStr = data ? `\n${JSON.stringify(data, null, 2)}` : '';
    return `[${timestamp}] [${level}] ${message}${dataStr}`;
  }

  write(level, message, data = null) {
    const formatted = this.format(level, message, data);
    
    if (this.logs.length >= this.maxLogs) {
      this.logs.shift();
    }
    this.logs.push({ level, message, data, timestamp: new Date() });

    switch (level) {
      case 'ERROR':
        console.error(formatted);
        break;
      case 'WARN':
        console.warn(formatted);
        break;
      case 'INFO':
        console.log(formatted);
        break;
      case 'DEBUG':
      case 'TRACE':
        if (process.env.NODE_ENV === 'development') console.debug(formatted);
        break;
    }
  }

  error(message, data = null) {
    this.write('ERROR', message, data);
  }

  warn(message, data = null) {
    this.write('WARN', message, data);
  }

  info(message, data = null) {
    this.write('INFO', message, data);
  }

  debug(message, data = null) {
    this.write('DEBUG', message, data);
  }

  trace(message, data = null) {
    this.write('TRACE', message, data);
  }

  getLogs() {
    return this.logs;
  }

  clearLogs() {
    this.logs = [];
  }

  child(context) {
    return {
      error: (message, data) => this.error(`[${context}] ${message}`, data),
      warn: (message, data) => this.warn(`[${context}] ${message}`, data),
      info: (message, data) => this.info(`[${context}] ${message}`, data),
      debug: (message, data) => this.debug(`[${context}] ${message}`, data),
      trace: (message, data) => this.trace(`[${context}] ${message}`, data)
    };
  }
}

const logger = new Logger();

module.exports = { logger, Logger };
