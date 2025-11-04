import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import fs from 'node:fs'
import path from 'node:path'
import { makeTestApp, resetDb } from './helpers/test-utils'

let app: any; let db: any
beforeEach(() => { const made = makeTestApp(); app = made.app; db = made.db; resetDb(db); })

describe('Bad CSV import', () => {
  it('returns 422 and does not modify DB for invalid CSV', async () => {
    const pre = await request(app).get('/api/summary/balance')
    const preCents = (pre.body?.data || pre.body)?.balanceCents ?? 0

    const tmp = path.join(process.cwd(), 'tests', '__tmp_bad.csv')
    fs.writeFileSync(tmp, 'foo;bar\n1;2;3\n', 'utf8')

    const res = await request(app)
      .post('/api/imports/csv')
      .attach('file', tmp)

    expect(res.status).toBe(422)
    expect(Boolean(res.body?.error)).toBe(true)

    const post = await request(app).get('/api/summary/balance')
    const postCents = (post.body?.data || post.body)?.balanceCents ?? 0
    expect(postCents).toBe(preCents)
  })
})


