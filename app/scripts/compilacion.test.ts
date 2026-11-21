import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import {
  consultarCanal,
  contar,
  datosCompilacion,
  decidir,
  resolverDecision
} from './compilacion.mjs'

const SHA = '9e07c55' + 'a'.repeat(33)
const temporales: string[] = []

function tieneGit(): boolean {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

afterEach(() => {
  for (const t of temporales.splice(0)) rmSync(t, { recursive: true, force: true })
})

describe('datosCompilacion', () => {
  it('acepta publicada y desarrollo con número y commit válidos', () => {
    for (const canal of ['publicada', 'desarrollo']) {
      const env = {
        SHINOBI_COMPILACION_CANAL: canal,
        SHINOBI_COMPILACION_NUMERO: '1234',
        SHINOBI_COMPILACION_COMMIT: SHA
      }
      expect(datosCompilacion({ env })).toEqual({ canal, numero: 1234, commit: SHA })
    }
  })

  it('falla si falta un dato, el commit no es válido o el canal es otro', () => {
    const base = {
      SHINOBI_COMPILACION_CANAL: 'desarrollo',
      SHINOBI_COMPILACION_NUMERO: '5',
      SHINOBI_COMPILACION_COMMIT: SHA
    }
    expect(() => datosCompilacion({ env: { ...base, SHINOBI_COMPILACION_NUMERO: '' } })).toThrow()
    expect(() => datosCompilacion({ env: { ...base, SHINOBI_COMPILACION_NUMERO: '0' } })).toThrow()
    expect(() => datosCompilacion({ env: { ...base, SHINOBI_COMPILACION_COMMIT: '' } })).toThrow()
    expect(() =>
      datosCompilacion({ env: { ...base, SHINOBI_COMPILACION_COMMIT: '9e07c55' } })
    ).toThrow()
    expect(() =>
      datosCompilacion({ env: { ...base, SHINOBI_COMPILACION_CANAL: 'otro' } })
    ).toThrow()
  })

  it('sin canal es local, con el commit de git si responde', () => {
    expect(datosCompilacion({ env: {}, git: () => SHA })).toEqual({
      canal: 'local',
      numero: null,
      commit: SHA
    })
    expect(
      datosCompilacion({
        env: {},
        git: () => {
          throw new Error('sin git')
        }
      })
    ).toEqual({ canal: 'local', numero: null, commit: null })
  })
})

describe.skipIf(!tieneGit())('contar', () => {
  function git(cwd: string, ...args: string[]): void {
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
      cwd,
      stdio: 'ignore'
    })
  }

  it('cuenta los commits y falla en un clon superficial', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'compilacion-'))
    temporales.push(raiz)
    const origen = join(raiz, 'origen')
    execFileSync('git', ['init', '-q', origen])
    for (const n of [1, 2]) {
      writeFileSync(join(origen, 'a.txt'), String(n))
      git(origen, 'add', '.')
      git(origen, 'commit', '-q', '-m', String(n))
    }
    const completo = contar({ cwd: origen })
    expect(completo.numero).toBe(2)
    expect(completo.commit).toMatch(/^[0-9a-f]{40}$/)

    const superficial = join(raiz, 'superficial')
    execFileSync('git', ['clone', '-q', '--depth', '1', pathToFileURL(origen).href, superficial], {
      stdio: 'ignore'
    })
    expect(() => contar({ cwd: superficial })).toThrow(/superficial/)
  })
})

describe('decidir (tabla del ADR 0020 §1)', () => {
  const develop = 'refs/heads/develop'
  const casos = [
    // evento, ref, configurado, compilado → desarrollo, construir, canal
    ['push', 'refs/tags/v0.2.0-alpha.2', false, false, 'omitir', true, 'publicada'],
    ['push', 'refs/tags/v0.2.0-alpha.2', true, false, 'omitir', true, 'publicada'],
    ['workflow_dispatch', develop, true, false, 'publicar', true, 'desarrollo'],
    ['workflow_dispatch', develop, true, true, 'ensayo', true, 'desarrollo'],
    ['workflow_dispatch', develop, false, false, 'ensayo', true, 'desarrollo'],
    ['workflow_dispatch', 'refs/heads/alpha-2', true, false, 'ensayo', true, 'desarrollo'],
    ['schedule', 'refs/heads/main', true, false, 'publicar', true, 'desarrollo'],
    ['schedule', 'refs/heads/main', true, true, 'omitir', false, 'desarrollo'],
    ['schedule', 'refs/heads/main', false, false, 'omitir', false, 'desarrollo']
  ] as const
  it.each(casos)('%s %s configurado=%s compilado=%s', (evento, ref, c, k, d, b, canal) => {
    const r = decidir({ evento, ref, configurado: c, compilado: k, faltas: ['X'], sha: SHA })
    expect([r.desarrollo, r.construir, r.canal_app]).toEqual([d, b, canal])
    expect(r.motivo !== '').toBe(evento === 'schedule' && !b)
  })

  it('explica por qué no se construye y rechaza eventos desconocidos', () => {
    const base = { evento: 'schedule', ref: 'refs/heads/main', sha: SHA }
    expect(decidir({ ...base, faltas: ['el secreto COMPILACIONES_TOKEN'] }).motivo).toBe(
      'Canal de desarrollo sin configurar: falta el secreto COMPILACIONES_TOKEN.'
    )
    expect(decidir({ ...base, configurado: true, compilado: true }).motivo).toContain(
      `Sin cambios: \`build-${SHA}\``
    )
    expect(() => decidir({ evento: 'push', ref: 'refs/heads/main' })).toThrow(/sin decisión/)
  })
})

describe('consultarCanal', () => {
  const repo = 'Gomonsoft/shinobi-karaoke-builds'
  const consultas: string[] = []
  const con =
    (codigos: Record<string, number | Error>) =>
    (ruta: string): number => {
      consultas.push(ruta)
      const c = codigos[ruta]
      if (c instanceof Error) throw c
      if (c === undefined) throw new Error(`sin respuesta para ${ruta}`)
      return c
    }

  it('configurado y sin compilar (404), o ya compilado (200)', () => {
    const base = { repo, hayToken: true, sha: SHA }
    expect(
      consultarCanal({
        ...base,
        gh: con({ [`repos/${repo}`]: 200, [`repos/${repo}/releases/tags/build-${SHA}`]: 404 })
      })
    ).toEqual({ configurado: true, compilado: false, faltas: [] })
    expect(
      consultarCanal({
        ...base,
        gh: con({ [`repos/${repo}`]: 200, [`repos/${repo}/releases/tags/build-${SHA}`]: 200 })
      })
    ).toMatchObject({ configurado: true, compilado: true })
  })

  it('un código inesperado al buscar build-<sha> hace fallar', () => {
    expect(() =>
      consultarCanal({
        repo,
        hayToken: true,
        sha: SHA,
        gh: con({ [`repos/${repo}`]: 200, [`repos/${repo}/releases/tags/build-${SHA}`]: 403 })
      })
    ).toThrow(/HTTP 403/)
  })

  it('sin repositorio, sin secreto o con repositorio ilegible no está configurado ni consulta build-<sha>', () => {
    consultas.length = 0
    const sinRepo = consultarCanal({ repo: '', hayToken: false, sha: SHA, gh: con({}) })
    expect(sinRepo.faltas).toEqual([
      'la variable COMPILACIONES_REPO',
      'el secreto COMPILACIONES_TOKEN'
    ])
    expect(consultas).toEqual([])
    const r404 = consultarCanal({
      repo,
      hayToken: true,
      sha: SHA,
      gh: con({ [`repos/${repo}`]: 404 })
    })
    expect(r404).toMatchObject({ configurado: false, compilado: false })
    expect(r404.faltas[0]).toContain('responde 404')
    const roto = consultarCanal({
      repo,
      hayToken: true,
      sha: SHA,
      gh: con({ [`repos/${repo}`]: new Error('red') })
    })
    expect(roto.configurado).toBe(false)
    expect(consultas.some((c) => c.includes('build-'))).toBe(false)
    expect(
      consultarCanal({ repo: 'a b', hayToken: true, sha: SHA, gh: con({}) }).faltas[0]
    ).toContain('válido')
  })

  it('resolverDecision solo consulta el canal en schedule y en dispatch contra develop', () => {
    consultas.length = 0
    const gh = con({})
    const base = { sha: SHA, repo, hayToken: true, gh }
    expect(resolverDecision({ ...base, evento: 'push', ref: 'refs/tags/v1.0.0' })).toMatchObject({
      desarrollo: 'omitir',
      configurado: false
    })
    expect(
      resolverDecision({ ...base, evento: 'workflow_dispatch', ref: 'refs/heads/alpha-2' })
        .desarrollo
    ).toBe('ensayo')
    expect(consultas).toEqual([])
    const ok = con({ [`repos/${repo}`]: 200, [`repos/${repo}/releases/tags/build-${SHA}`]: 404 })
    expect(
      resolverDecision({ ...base, gh: ok, evento: 'schedule', ref: 'refs/heads/main' })
    ).toMatchObject({
      desarrollo: 'publicar',
      construir: true,
      configurado: true
    })
  })
})
