import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Hono } from 'hono'
import { MARKER_HEADER, markResponses } from './serverMarker.ts'

// The header that tells our 404 apart from the edge's.
//
// Worth pinning because the failure is invisible from the server side and
// expensive on the client: a deploy threw four people out of a live game at
// once, and the only reason it could is that a 404 with no provenance is
// indistinguishable from a 404 meaning "no such room". Both apps now require
// this header before they will believe a seat is gone, so if it stops being
// sent on an error response, deploys start kicking people out again — silently,
// and only in production.

function appWithRoutes() {
  const app = new Hono()
  app.use('*', markResponses)
  app.get('/ok', (c) => c.json({ ok: true }))
  app.get('/unknown-room', (c) => c.json({ error: 'Unknown room' }, 404))
  app.get('/not-in-room', (c) => c.json({ error: 'Not in this room' }, 403))
  // A route that returns a bare Response rather than going through c.json.
  app.get('/raw', () => new Response('hi', { status: 404 }))
  return app
}

test('a successful answer is marked', async () => {
  const res = await appWithRoutes().request('/ok')
  assert.equal(res.status, 200)
  assert.equal(res.headers.get(MARKER_HEADER), '1')
})

// These two are the whole point: they are the responses the apps act on by
// destroying a seat, and they are the ones the edge impersonates.
test('the answers that cost somebody their seat are marked', async () => {
  const app = appWithRoutes()
  for (const path of ['/unknown-room', '/not-in-room']) {
    const res = await app.request(path)
    assert.ok(res.status === 403 || res.status === 404, `${path} gave ${res.status}`)
    assert.equal(res.headers.get(MARKER_HEADER), '1', `${path} was not marked`)
  }
})

test('a handler that builds its own Response is marked too', async () => {
  const res = await appWithRoutes().request('/raw')
  assert.equal(res.headers.get(MARKER_HEADER), '1')
})

// And the other half of the rule, which no server test can reach: a response
// that never touched this middleware carries nothing, which is what the apps
// read as "this did not come from the server, so it is not a verdict on my
// seat". Spelled out here because it is the case that actually broke.
test('an answer from something else carries no marker', async () => {
  const edge = new Hono()
  edge.get('/unknown-room', (c) => c.json({ error: 'Application not found' }, 404))
  const res = await edge.request('/unknown-room')
  assert.equal(res.status, 404)
  assert.equal(res.headers.get(MARKER_HEADER), null)
})
