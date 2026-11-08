import type { IncomingMessage, ServerResponse } from 'node:http';

export interface VercelRequest extends IncomingMessage {
  query: Record<string, string | string[] | undefined>;
}

export interface VercelResponse extends ServerResponse {
  status(code: number): this;
  send(body: string): this;
  redirect(statusCode: number, url: string): void;
  json(body: object): this;
}
