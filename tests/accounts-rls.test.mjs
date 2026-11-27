import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';

const root = new URL('../', import.meta.url);
const files = await Promise.all(['001_init.sql', '005_rag.sql', '007_accounts.sql', '008_check_accounts.sql']
  .map(name => readFile(new URL(`supabase/${name}`, root), 'utf8')));
const [demoSql, ragSql, accountSql, auditSql] = files;
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const otherId = '33333333-3333-4333-8333-333333333333';
const tables = ['ieobom_user_profiles', 'ieobom_user_wardrobe', 'ieobom_user_outfits'];

test('account migration enforces real PostgreSQL RLS and preserves the shared RAG dataset', { timeout: 60000 }, async t => {
  const db = await PGlite.create({ extensions: { vector } });
  const fixture = new Map();
  const denied = (sql, params = []) => assert.rejects(db.query(sql, params), error => error.code === '42501');
  const invalid = (sql, params = []) => assert.rejects(db.query(sql, params), error => error.code === '23514');
  async function asUser(id, run) {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id ?? '']);
    await db.exec('SET ROLE authenticated');
    try { return await run(); }
    finally { await db.exec('RESET ROLE'); }
  }
  async function audit() {
    const result = await db.query(auditSql);
    assert.equal(result.rows.length, 9);
    assert.ok(result.rows.every(row => row['결과'] === '통과'), JSON.stringify(result.rows));
  }
  async function demoSnapshot() {
    return (await db.query(`SELECT
      (SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.ieobom_profiles p) AS profiles,
      (SELECT jsonb_agg(to_jsonb(w) ORDER BY id) FROM public.ieobom_wardrobe w) AS wardrobe,
      (SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM public.ieobom_outfits o) AS outfits,
      (SELECT jsonb_agg(to_jsonb(e) ORDER BY content_id) FROM public.content_embeddings e) AS embeddings`)).rows[0];
  }
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SET search_path = pg_catalog AS
        $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;`);
    await db.exec(demoSql);
    await db.exec(ragSql);
    // Synthetic embeddings exercise DB/RPC preservation without a paid external AI request.
    await db.exec(`INSERT INTO public.content_embeddings(content_id, profile_id, chunk_text, content_hash, model, dim, embedding)
      SELECT o.id, o.profile_id, public.ieobom_rag_document(o),
        encode(sha256(convert_to(public.ieobom_rag_document(o), 'UTF8')), 'hex'),
        'gemini-embedding-2', 768, ('[1,' || repeat('0,', 766) || '0]')::extensions.vector
      FROM public.ieobom_outfits o;`);
    const originalDemo = await demoSnapshot();
    await db.query('INSERT INTO auth.users(id) VALUES ($1), ($2)', [A, B]);

    await t.test('migration applies twice and its read-only audit passes', async () => {
      await db.exec(accountSql);
      await db.exec(accountSql);
      await audit();
      assert.deepEqual(await demoSnapshot(), originalDemo);
    });

    await t.test('A and B each create and edit their own profile, garment, and outfit', async () => {
      for (const [user, name] of [[A, 'A'], [B, 'B']]) {
        await asUser(user, async () => {
          const profile = (await db.query('INSERT INTO public.ieobom_user_profiles(style) VALUES ($1) RETURNING *', [`${name}의 취향`])).rows[0];
          assert.equal(profile.user_id, user);
          assert.equal(profile.goal, '');
          const wardrobe = (await db.query("INSERT INTO public.ieobom_user_wardrobe(name,category,color,swatch) VALUES ($1,'상의','화이트','#ffffff') RETURNING *", [`${name} 셔츠`])).rows[0];
          const outfit = (await db.query("INSERT INTO public.ieobom_user_outfits(title,description,occasion,worn_on,kind,analysis_key) VALUES ($1,'화이트 셔츠 · 청바지 · 운동화','일상','2026-11-28','ai','same-analysis-key') RETURNING *", [`${name} 코디`])).rows[0];
          for (const row of [wardrobe, outfit]) assert.equal(row.user_id, user);
          assert.match(wardrobe.id, /^[a-f0-9-]{36}$/);
          assert.match(outfit.id, /^[a-f0-9-]{36}$/);
          fixture.set(user, { profile, wardrobe, outfit });
          assert.equal((await db.query('UPDATE public.ieobom_user_profiles SET goal=$1 WHERE user_id=$2 RETURNING goal', [`${name} 목표`, user])).rows[0].goal, `${name} 목표`);
          assert.equal((await db.query('UPDATE public.ieobom_user_wardrobe SET name=$1 WHERE id=$2 RETURNING name', [`${name} 새 셔츠`, wardrobe.id])).rows[0].name, `${name} 새 셔츠`);
          const changed = (await db.query("UPDATE public.ieobom_user_outfits SET rating=5,status='착용 완료' WHERE id=$1 RETURNING rating,status", [outfit.id])).rows[0];
          assert.deepEqual(changed, { rating: 5, status: '착용 완료' });
        });
      }
    });

    await t.test('A cannot read, change, or delete B rows by guessing IDs, and vice versa', async () => {
      for (const [user, victim] of [[A, B], [B, A]]) {
        await asUser(user, async () => {
          for (const table of tables) {
            const visible = (await db.query(`SELECT * FROM public.${table}`)).rows;
            assert.equal(visible.length, 1);
            assert.equal(visible[0].user_id, user);
            assert.equal((await db.query(`SELECT * FROM public.${table} WHERE user_id=$1`, [victim])).rows.length, 0);
            const column = table.endsWith('profiles') ? 'goal' : table.endsWith('wardrobe') ? 'name' : 'title';
            assert.equal((await db.query(`UPDATE public.${table} SET ${column}='intrusion' WHERE user_id=$1 RETURNING user_id`, [victim])).rows.length, 0);
            assert.equal((await db.query(`DELETE FROM public.${table} WHERE user_id=$1 RETURNING user_id`, [victim])).rows.length, 0);
          }
          assert.equal((await db.query('SELECT * FROM public.ieobom_user_wardrobe WHERE id=$1', [fixture.get(victim).wardrobe.id])).rows.length, 0);
          assert.equal((await db.query('SELECT * FROM public.ieobom_user_outfits WHERE id=$1', [fixture.get(victim).outfit.id])).rows.length, 0);
        });
      }
    });

    await t.test('owner spoofing and immutable-column writes are rejected by PostgreSQL', async () => {
      await asUser(A, async () => {
        await denied('INSERT INTO public.ieobom_user_profiles(user_id,style) VALUES ($1,$2)', [B, 'spoof']);
        await denied("INSERT INTO public.ieobom_user_wardrobe(user_id,name,category,color,swatch) VALUES ($1,'spoof','상의','화이트','#ffffff')", [B]);
        await denied("INSERT INTO public.ieobom_user_outfits(user_id,title,description,occasion,worn_on) VALUES ($1,'spoof','옷 조합','일상','2026-11-28')", [B]);
        for (const table of tables) {
          await denied(`UPDATE public.${table} SET user_id=$1 WHERE user_id=$2`, [B, A]);
          await denied(`UPDATE public.${table} SET created_at='2000-01-01' WHERE user_id=$1`, [A]);
          await denied(`UPDATE public.${table} SET updated_at='2000-01-01' WHERE user_id=$1`, [A]);
        }
        for (const table of tables.slice(1)) await denied(`UPDATE public.${table} SET id=$1 WHERE user_id=$2`, [otherId, A]);
        await denied("INSERT INTO public.ieobom_user_wardrobe(id,name,category,color,swatch) VALUES ($1,'override','상의','화이트','#ffffff')", [otherId]);
        await denied("INSERT INTO public.ieobom_user_outfits(title,description,occasion,worn_on,created_at) VALUES ('override','옷','일상','2026-11-28','2000-01-01')");
        await denied("UPDATE public.ieobom_user_outfits SET analysis_key='changed' WHERE user_id=$1", [A]);
        // Standard upsert would try to UPDATE user_id; the API must use INSERT or a mutable-field UPDATE.
        await denied("INSERT INTO public.ieobom_user_profiles(user_id,style) VALUES ($1,'upsert') ON CONFLICT(user_id) DO UPDATE SET user_id=excluded.user_id,style=excluded.style", [A]);
      });
    });

    await t.test('anonymous and authenticated sessions without a user ID cannot access private records', async () => {
      await db.exec('SET ROLE anon');
      try {
        for (const table of tables) {
          await denied(`SELECT * FROM public.${table}`);
          await denied(`DELETE FROM public.${table}`);
        }
        await denied("INSERT INTO public.ieobom_user_profiles(user_id,style) VALUES ($1,'anonymous')", [A]);
      } finally { await db.exec('RESET ROLE'); }
      await asUser(null, async () => {
        for (const table of tables) assert.equal((await db.query(`SELECT * FROM public.${table}`)).rows.length, 0);
        await denied("INSERT INTO public.ieobom_user_profiles(user_id,style) VALUES ($1,'missing token subject')", [otherId]);
      });
    });

    await t.test('database constraints reject invalid data and duplicate analysis keys are scoped to the owner', async () => {
      await asUser(A, async () => {
        await invalid('UPDATE public.ieobom_user_profiles SET style=$1 WHERE user_id=$2', ['x'.repeat(161), A]);
        for (const [name, category, color, swatch] of [['\n\t', '상의', '화이트', '#ffffff'], ['x'.repeat(51), '상의', '화이트', '#ffffff'], ['옷', '잘못된 분류', '화이트', '#ffffff'], ['옷', '상의', ' ', '#ffffff'], ['옷', '상의', '화이트', 'javascript:bad']]) {
          await invalid('INSERT INTO public.ieobom_user_wardrobe(name,category,color,swatch) VALUES ($1,$2,$3,$4)', [name, category, color, swatch]);
        }
        await invalid('UPDATE public.ieobom_user_outfits SET rating=6 WHERE user_id=$1', [A]);
        await invalid("UPDATE public.ieobom_user_outfits SET worn_on='infinity' WHERE user_id=$1", [A]);
        await assert.rejects(db.query("UPDATE public.ieobom_user_outfits SET worn_on='2026-02-30' WHERE user_id=$1", [A]), error => error.code === '22008');
        await assert.rejects(db.query("INSERT INTO public.ieobom_user_outfits(title,description,occasion,worn_on,analysis_key) VALUES ('중복','옷','일상','2026-11-28','same-analysis-key')"), error => error.code === '23505');
        const created = (await db.query("INSERT INTO public.ieobom_user_outfits(title,description,occasion,worn_on) VALUES ('수동1','옷','일상','2026-11-28'),('수동2','옷','일상','2026-11-28') RETURNING id")).rows;
        assert.equal(created.length, 2);
        for (const row of created) assert.equal((await db.query('DELETE FROM public.ieobom_user_outfits WHERE id=$1 RETURNING id', [row.id])).rows.length, 1);
      });
      // Both A and B already saved the same analysis_key successfully in their own row.
      assert.equal(Number((await db.query("SELECT count(*) AS count FROM public.ieobom_user_outfits WHERE analysis_key='same-analysis-key'")).rows[0].count), 2);
    });

    await t.test('updated_at is maintained by the invoker trigger and member DELETE succeeds for own rows', async () => {
      await db.query("UPDATE public.ieobom_user_profiles SET updated_at='2000-01-01' WHERE user_id=$1", [A]);
      await asUser(A, async () => {
        const row = (await db.query("UPDATE public.ieobom_user_profiles SET goal='갱신 확인' WHERE user_id=$1 RETURNING updated_at", [A])).rows[0];
        assert.ok(new Date(row.updated_at).getUTCFullYear() >= 2026);
        const temp = (await db.query("INSERT INTO public.ieobom_user_wardrobe(name,category,color,swatch) VALUES ('삭제 시험','신발','블랙','#000000') RETURNING id")).rows[0];
        assert.equal((await db.query('DELETE FROM public.ieobom_user_wardrobe WHERE id=$1 RETURNING id', [temp.id])).rows.length, 1);
        assert.equal((await db.query('DELETE FROM public.ieobom_user_profiles WHERE user_id=$1 RETURNING user_id', [A])).rows.length, 1);
        await db.query("INSERT INTO public.ieobom_user_profiles(style) VALUES ('다시 저장')");
      });
    });

    await t.test('rerunning migration keeps private data, and unrelated policies cause a safe rollback', async () => {
      const before = (await db.query('SELECT jsonb_agg(to_jsonb(w) ORDER BY id) AS data FROM public.ieobom_user_wardrobe w')).rows[0].data;
      await db.exec(accountSql);
      await audit();
      assert.deepEqual((await db.query('SELECT jsonb_agg(to_jsonb(w) ORDER BY id) AS data FROM public.ieobom_user_wardrobe w')).rows[0].data, before);
      await db.exec('CREATE POLICY unexpected_policy ON public.ieobom_user_wardrobe FOR SELECT TO authenticated USING (false)');
      await assert.rejects(db.exec(accountSql), error => error.message === 'unexpected_private_table_policy');
      await db.exec('ROLLBACK');
      await db.exec('DROP POLICY unexpected_policy ON public.ieobom_user_wardrobe');
      await audit();
    });

    await t.test('deleting A cascades only A private records, and all shared records and RAG survive', async () => {
      await db.query('DELETE FROM auth.users WHERE id=$1', [A]);
      for (const table of tables) {
        assert.equal(Number((await db.query(`SELECT count(*) AS count FROM public.${table} WHERE user_id=$1`, [A])).rows[0].count), 0);
        assert.equal(Number((await db.query(`SELECT count(*) AS count FROM public.${table} WHERE user_id=$1`, [B])).rows[0].count), 1);
      }
      assert.deepEqual(await demoSnapshot(), originalDemo);
      await db.exec('SET ROLE service_role');
      try {
        const matches = (await db.query("SELECT * FROM public.match_contents(('[1,' || repeat('0,',766) || '0]')::extensions.vector, .45, 5, 'demo-profile', 'gemini-embedding-2')")).rows;
        assert.equal(matches.length, 5);
      } finally { await db.exec('RESET ROLE'); }
      await db.exec('SET ROLE anon');
      try {
        assert.equal((await db.query('SELECT id FROM public.ieobom_outfits')).rows.length, 20);
        await denied('SELECT * FROM public.content_embeddings');
      } finally { await db.exec('RESET ROLE'); }
      await audit();
    });
  } finally { await db.close(); }
});
