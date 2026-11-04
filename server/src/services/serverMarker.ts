import type { MiddlewareHandler } from 'hono'

/**
 * The header every response from this server carries, so a client can tell an
 * answer FROM the app apart from an answer ABOUT the app.
 *
 * It exists because of a deploy that threw four people out of a live game at
 * once. While the container restarts there is nothing for Railway's edge to
 * route to, so the edge answers in our place — with a 404. The apps read a 404
 * on a room poll as "that room does not exist", which is exactly what this
 * server's own 404 means, so every device concluded its seat was gone, deleted
 * it and dropped to the lobby. The room was fine. The server was not up yet.
 *
 * A status code cannot carry the distinction, because the edge owns the same
 * codes we do. A header it has never heard of can, since the only way it can be
 * on a response is if the request reached this process.
 */
export const MARKER_HEADER = 'x-gtl-server'

export const markResponses: MiddlewareHandler = async (c, next) => {
  await next()
  c.header(MARKER_HEADER, '1')
}
