import { DateTime } from "luxon";

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

// TODO: Set log level depending on environment
export class Logger {
  private static logLevel: LogLevel = LogLevel.DEBUG;

  static setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  private static shouldLog(level: LogLevel): boolean {
    const levels = [
      LogLevel.DEBUG,
      LogLevel.INFO,
      LogLevel.WARN,
      LogLevel.ERROR,
    ];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  private static getTimestamp(): string {
    return DateTime.now().toFormat("yyyy-LL-dd HH:mm:ss");
  }

  private static log(
    level: LogLevel,
    message: string,
    ...optionalParams: any[]
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const timestamp = this.getTimestamp();
    const formattedMessage = `[${timestamp}] [${level}] ${message}`;

    switch (level) {
      case LogLevel.ERROR:
        console.error(formattedMessage, ...optionalParams);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, ...optionalParams);
        break;
      default:
        console.log(formattedMessage, ...optionalParams);
        break;
    }
  }

  static debug(message: string, ...optionalParams: any[]): void {
    this.log(LogLevel.DEBUG, message, ...optionalParams);
  }

  static info(message: string, ...optionalParams: any[]): void {
    this.log(LogLevel.INFO, message, ...optionalParams);
  }

  static warn(message: string, ...optionalParams: any[]): void {
    this.log(LogLevel.WARN, message, ...optionalParams);
  }

  static error(message: string, ...optionalParams: any[]): void {
    this.log(LogLevel.ERROR, message, ...optionalParams);
  }
}
