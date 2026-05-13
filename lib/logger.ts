const isDev = import.meta.env.DEV;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const log = isDev ? console.log.bind(console) : (..._args: any[]) => {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const warn = isDev ? console.warn.bind(console) : (..._args: any[]) => {};
export const error = console.error.bind(console);
