import type { IncomingMessage, ServerResponse } from 'http';

const ASSOCIATION_DATA =
  '7b2276657273696f6e223a312c227073704964223a2234424538444645374337303544443538353133393637344446363439463242374446383942343435393143433236323435423834384542323538364530383742222c22637265617465644f6e223a313738363534363038323435387d';

export default function handler(_req: IncomingMessage, res: ServerResponse) {
  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'public, max-age=86400',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(ASSOCIATION_DATA);
}

