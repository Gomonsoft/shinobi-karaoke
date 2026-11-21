import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parse } from 'yaml'

interface Paso {
  id?: string
  name?: string
  uses?: string
  run?: string
  if?: string
  env?: Record<string, string>
  with?: Record<string, unknown>
}

interface Trabajo {
  needs?: string | string[]
  if?: string
  env?: Record<string, string>
  permissions?: Record<string, string>
  'timeout-minutes'?: number
  steps: Paso[]
  strategy?: {
    'fail-fast': boolean
    matrix: { include: { os: string; forma?: string; informativa?: boolean }[] }
  }
}

const textoFlujo = readFileSync(
  new URL('../../.github/workflows/empaquetado.yml', import.meta.url),
  'utf8'
)
const flujo = parse(textoFlujo) as {
  on: { workflow_dispatch: unknown; push: { tags: string[] }; schedule: { cron: string }[] }
  permissions: Record<string, string>
  concurrency: Record<string, unknown>
  jobs: Record<string, Trabajo>
}

const checkouts = (t: Trabajo): Paso[] =>
  t.steps.filter(({ uses }) => uses?.startsWith('actions/checkout@'))
const SHA_SALIDA = '${{ needs.comprobar-version.outputs.sha }}'

describe('workflow de empaquetado y publicación', () => {
  it('se dispara a mano, con etiquetas v* o por la noche y solo publicar escribe en este repositorio', () => {
    expect(Object.keys(flujo.on).sort()).toEqual(['push', 'schedule', 'workflow_dispatch'])
    // Sin `inputs`: no está documentado que se lean del archivo de la rama (ADR 0020, fase 10).
    expect(flujo.on.workflow_dispatch).toBeNull()
    expect(flujo.on.push).toEqual({ tags: ['v*'] })
    expect(flujo.on.schedule).toEqual([{ cron: '23 4 * * *' }])
    expect(flujo.permissions).toEqual({ contents: 'read' })
    expect(flujo.concurrency).toEqual({
      group: 'empaquetado-${{ github.ref }}',
      'cancel-in-progress': false
    })
    for (const [nombre, trabajo] of Object.entries(flujo.jobs)) {
      if (nombre === 'publicar') continue
      if (trabajo.permissions) expect(trabajo.permissions).toEqual({ contents: 'read' })
    }
    const escritores = Object.entries(flujo.jobs).filter(
      ([, t]) => t.permissions?.contents === 'write'
    )
    expect(escritores.map(([n]) => n)).toEqual(['publicar'])
  })

  it('comprueba la versión primero, resuelve el commit antes del checkout y no interpola el evento en run', () => {
    const comprobar = flujo.jobs['comprobar-version']!
    expect(Object.keys(flujo.jobs)[0]).toBe('comprobar-version')
    expect(comprobar['timeout-minutes']).toBe(10)
    expect(comprobar.permissions).toBeUndefined()
    expect(comprobar.steps.some(({ run }) => run?.includes('npm ci'))).toBe(false)
    expect(comprobar.steps[0]!.id).toBe('sha')
    expect(comprobar.steps[0]!.run).toContain('repos/$GITHUB_REPOSITORY/branches/develop')
    expect(checkouts(comprobar)).toHaveLength(1)
    expect(checkouts(comprobar)[0]!.with).toEqual({
      ref: '${{ steps.sha.outputs.sha }}',
      'fetch-depth': 0
    })
    for (const trabajo of Object.values(flujo.jobs)) {
      for (const { run } of trabajo.steps) expect(run ?? '').not.toContain('${{')
    }
  })

  it('expone sha, numero, compilacion, canal_app, desarrollo y construir', () => {
    const salidas = (
      flujo.jobs['comprobar-version'] as unknown as { outputs: Record<string, string> }
    ).outputs
    for (const clave of ['sha', 'numero', 'compilacion', 'canal_app', 'desarrollo', 'construir']) {
      expect(salidas[clave], clave).toMatch(/^\$\{\{ steps\./)
    }
    const decidir = flujo.jobs['comprobar-version']!.steps.find(({ id }) => id === 'decision')!
    expect(decidir.run).toBe('node app/scripts/compilacion.mjs decidir --salida-github')
    const contar = flujo.jobs['comprobar-version']!.steps.find(({ id }) => id === 'contar')!
    expect(contar.run).toBe('node app/scripts/compilacion.mjs contar --salida-github')
    expect(contar.if).toBe("steps.decision.outputs.construir == 'true'")
  })

  it('fija por SHA todas las acciones y no utiliza acciones de publicación', () => {
    const acciones = Object.values(flujo.jobs).flatMap(({ steps }) =>
      steps.flatMap(({ uses }) => (uses ? [uses] : []))
    )
    expect(acciones.length).toBeGreaterThan(0)
    for (const accion of acciones) {
      expect(accion).toMatch(
        /^actions\/(checkout|setup-node|upload-artifact|download-artifact)@[a-f0-9]{40}$/
      )
    }
  })

  it('construye solo si comprobar-version lo decide, con el commit y los datos de compilación', () => {
    const construir = flujo.jobs.construir!
    expect(construir.needs).toBe('comprobar-version')
    expect(construir.if).toBe("needs.comprobar-version.outputs.construir == 'true'")
    expect(construir['timeout-minutes']).toBe(45)
    expect(construir.strategy?.['fail-fast']).toBe(false)
    expect(construir.strategy?.matrix.include.map(({ os }) => os)).toEqual([
      'windows-2025',
      'macos-26',
      'ubuntu-24.04'
    ])
    expect(checkouts(construir)[0]!.with).toEqual({ ref: SHA_SALIDA })
    const compilar = construir.steps.find(({ name }) => name === 'Compilar')!
    expect(compilar.run).toBe('npm run build')
    expect(compilar.env).toEqual({
      SHINOBI_COMPILACION_CANAL: '${{ needs.comprobar-version.outputs.canal_app }}',
      SHINOBI_COMPILACION_NUMERO: '${{ needs.comprobar-version.outputs.numero }}',
      SHINOBI_COMPILACION_COMMIT: SHA_SALIDA
    })
    const registro = construir.steps.find(({ id }) => id === 'instaladores')!
    expect(registro.run).toContain('process.env.COMMIT_CONSTRUIDO.slice(0, 7)')
    expect(registro.run).toContain('process.env.COMPILACION')
    const subida = construir.steps.find(({ uses }) => uses?.startsWith('actions/upload-artifact@'))
    expect(subida?.with).toMatchObject({
      'retention-days': 14,
      'if-no-files-found': 'error',
      path: '${{ steps.instaladores.outputs.rutas }}'
    })
  })

  it('ningún trabajo posterior usa GITHUB_SHA ni hace checkout de otro commit que el construido', () => {
    for (const [nombre, trabajo] of Object.entries(flujo.jobs)) {
      if (nombre === 'comprobar-version') continue
      expect(JSON.stringify(trabajo), nombre).not.toContain('GITHUB_SHA')
      if (nombre === 'publicar' || nombre === 'publicar-desarrollo') {
        expect(checkouts(trabajo), nombre).toHaveLength(0)
        continue
      }
      expect(checkouts(trabajo), nombre).toHaveLength(1)
      expect(checkouts(trabajo)[0]!.with, nombre).toEqual({ ref: SHA_SALIDA })
    }
    // Un trabajo con escritura no hace checkout.
    for (const trabajo of Object.values(flujo.jobs)) {
      if (trabajo.permissions?.contents === 'write') expect(checkouts(trabajo)).toHaveLength(0)
    }
  })

  it('prueba los instaladores en un runner separado y deja Ubuntu 26.04 como informativo', () => {
    const probar = flujo.jobs['probar-instalador']!
    expect(probar.needs).toEqual(['comprobar-version', 'construir'])
    expect(probar.if).toBe("needs.comprobar-version.outputs.construir == 'true'")
    expect(probar.strategy?.['fail-fast']).toBe(false)
    expect(
      probar.strategy?.matrix.include.map(({ os, forma, informativa }) => [os, forma, informativa])
    ).toEqual([
      ['windows-2025', 'NSIS', false],
      ['macos-26', 'DMG', false],
      ['macos-15', 'DMG', false],
      ['ubuntu-24.04', '.deb', false],
      ['ubuntu-26.04', '.deb', true],
      ['ubuntu-24.04', 'AppImage', false]
    ])
    expect(probar.steps.some(({ uses }) => uses?.startsWith('actions/download-artifact@'))).toBe(
      true
    )
    const identificar = probar.steps.find(({ id }) => id === 'artefacto')!
    expect(identificar.run).toContain('${COMMIT_CONSTRUIDO:0:7}')
  })

  it('comprueba la instalación NSIS de un clic y conserva los datos al desinstalar', () => {
    const paso = flujo.jobs['probar-instalador']!.steps.find(({ id }) => id === 'nsis')!.run!
    const paquete = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8')
    ) as {
      name: string
    }
    expect(paso).toContain(`Programs\\${paquete.name}`)
    expect(paso).toContain("'Shinobi Karaoke.exe'")
    expect(paso).toContain("'Uninstall Shinobi Karaoke.exe'")
    expect(paso).toContain('-PathType Leaf')
    expect(paso).toContain('npm run test:paquete')
    expect(paso).toContain('node scripts/humo-instalador.mjs datos')
    expect(paso).toContain('Get-FileHash -LiteralPath $config')
    expect(paso).toContain("throw 'El ejecutable sigue instalado'")
    expect(paso).toContain("throw 'La desinstalación alteró los datos'")
  })

  it('prepara la publicación sin permisos de escritura, nunca en schedule, y sube publicacion-…', () => {
    const preparar = flujo.jobs['preparar-publicacion']!
    expect(preparar.needs).toEqual(['comprobar-version', 'construir', 'probar-instalador'])
    expect(preparar.if).toBe(
      "github.event_name != 'schedule' && needs.comprobar-version.outputs.construir == 'true'"
    )
    expect(preparar.permissions).toEqual({ contents: 'read' })
    const subida = preparar.steps.find(({ uses }) => uses?.startsWith('actions/upload-artifact@'))
    expect(subida?.with).toMatchObject({
      name: 'publicacion-${{ needs.comprobar-version.outputs.version }}',
      'retention-days': 14,
      'if-no-files-found': 'error'
    })
    const descarga = preparar.steps.find(({ uses }) =>
      uses?.startsWith('actions/download-artifact@')
    )
    expect(descarga?.with).toMatchObject({ 'merge-multiple': true })
    const nombre = preparar.steps.find(({ id }) => id === 'artefactos')!
    expect(nombre.run).toContain('${COMMIT_CONSTRUIDO:0:7}')
    const paso = preparar.steps.find(({ run }) => run?.includes('preparar-publicacion.mjs'))!
    expect(paso.run).toContain('--compilacion "$COMPILACION" --sha "$COMMIT_CONSTRUIDO"')
    expect(paso.run).toContain('actions/runs/$GITHUB_RUN_ID')
  })

  it('publicar es el único con escritura, solo con etiqueta y sin ejecutar código del repositorio', () => {
    const publicar = flujo.jobs.publicar!
    expect(publicar.permissions).toEqual({ contents: 'write' })
    expect(publicar.if).toBe("github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')")
    expect(publicar.needs).toEqual(['comprobar-version', 'preparar-publicacion'])
    const acciones = publicar.steps.flatMap(({ uses }) => (uses ? [uses] : []))
    expect(acciones).toHaveLength(1)
    expect(acciones[0]).toMatch(/^actions\/download-artifact@[a-f0-9]{40}$/)
    expect(publicar.steps.some(({ run }) => run?.includes('npm') || run?.includes('node '))).toBe(
      false
    )
    expect(publicar.env).toMatchObject({ BORRADOR: '${{ vars.PUBLICACION_BORRADOR }}' })
  })

  it('publicar compone las notas con generate-notes y previous_tag_name, sin --generate-notes', () => {
    const publicar = flujo.jobs.publicar!
    const todo = publicar.steps.map(({ run }) => run ?? '').join('\n')
    expect(todo).not.toContain('--generate-notes')
    expect(todo).toContain('releases/generate-notes')
    expect(todo).toContain('previous_tag_name="$anterior"')
    expect(todo).toContain('gh release list --exclude-drafts')
    const crear = publicar.steps.find(({ name }) => name?.startsWith('Crear la Release'))!
    expect(crear.run).toContain('--notes-file notas-final.md')
  })

  it('preparar-desarrollo no escribe, renombra con el script y sube compilacion-<versión>-<N>', () => {
    const t = flujo.jobs['preparar-desarrollo']!
    expect(t.needs).toEqual(['comprobar-version', 'construir', 'probar-instalador'])
    expect(t.if).toBe(
      "needs.comprobar-version.outputs.desarrollo != 'omitir' && needs.comprobar-version.outputs.construir == 'true'"
    )
    expect(t.permissions).toEqual({ contents: 'read' })
    const paso = t.steps.find(({ run }) => run?.includes('--canal desarrollo'))!
    expect(paso.run).toContain('--anterior "$ANTERIOR"')
    const anterior = t.steps.find(({ id }) => id === 'anterior')!
    expect(anterior.if).toBe("needs.comprobar-version.outputs.configurado == 'true'")
    expect(anterior.env?.GH_TOKEN).toBe('${{ github.token }}')
    const subida = t.steps.find(({ uses }) => uses?.startsWith('actions/upload-artifact@'))
    expect(subida?.with).toMatchObject({
      name: 'compilacion-${{ needs.comprobar-version.outputs.compilacion }}',
      'retention-days': 14
    })
  })

  it('publicar-desarrollo es el único con el secreto del canal, sin checkout ni node/npm', () => {
    const t = flujo.jobs['publicar-desarrollo']!
    expect(t.needs).toEqual(['comprobar-version', 'preparar-desarrollo'])
    expect(t.if).toBe("needs.comprobar-version.outputs.desarrollo == 'publicar'")
    expect(t.permissions).toEqual({ contents: 'read' })
    expect(t.env).toMatchObject({
      GH_TOKEN: '${{ secrets.COMPILACIONES_TOKEN }}',
      GH_REPO: '${{ vars.COMPILACIONES_REPO }}'
    })
    expect(checkouts(t)).toHaveLength(0)
    const acciones = t.steps.flatMap(({ uses }) => (uses ? [uses] : []))
    expect(acciones).toHaveLength(1)
    expect(acciones[0]).toMatch(/^actions\/download-artifact@[a-f0-9]{40}$/)
    for (const { run } of t.steps) expect(run ?? '').not.toMatch(/\bnode\b|\bnpm\b|\bnpx\b/)
    const crear = t.steps.find(({ run }) => run?.includes('gh release create'))!
    expect(crear.run).toContain('--draft --title "$COMPILACION" --notes-file notas.md')
    expect(crear.run).not.toContain('--latest')
    const publicar = t.steps.find(({ run }) => run?.includes('gh release edit'))!
    expect(publicar.run).toBe('gh release edit "build-$SHA" --draft=false --latest')
  })

  it("el secreto COMPILACIONES_TOKEN solo está en publicar-desarrollo y, como `!= ''`, en comprobar-version", () => {
    const permitidas: Record<string, string[]> = {
      'comprobar-version': ["${{ secrets.COMPILACIONES_TOKEN != '' }}"],
      'publicar-desarrollo': ['${{ secrets.COMPILACIONES_TOKEN }}']
    }
    for (const [nombre, trabajo] of Object.entries(flujo.jobs)) {
      const apariciones = JSON.stringify(trabajo).match(/\$\{\{[^}]*COMPILACIONES_TOKEN[^}]*\}\}/g)
      expect(apariciones ?? [], nombre).toEqual(permitidas[nombre] ?? [])
    }
    expect(textoFlujo.match(/COMPILACIONES_TOKEN/g)).toHaveLength(2)
    // El valor de la variable del repositorio sí puede leerse sin riesgo en estos trabajos.
    const usan = Object.entries(flujo.jobs)
      .filter(([, t]) => JSON.stringify(t).includes('vars.COMPILACIONES_REPO'))
      .map(([n]) => n)
    expect(usan).toEqual(['comprobar-version', 'preparar-desarrollo', 'publicar-desarrollo'])
  })

  it('no usa acciones de terceros', () => {
    const acciones = Object.values(flujo.jobs).flatMap(({ steps }) =>
      steps.flatMap(({ uses }) => (uses ? [uses] : []))
    )
    for (const accion of acciones) expect(accion.startsWith('actions/')).toBe(true)
  })
})

const hayJq = process.platform !== 'win32' && spawnSync('jq', ['--version']).status === 0

describe.skipIf(!hayJq)('publicar: composición de la parte 2 con un body de ejemplo', () => {
  const temporales: string[] = []
  afterEach(() => {
    for (const t of temporales.splice(0)) rmSync(t, { recursive: true, force: true })
  })

  const cuerpoGitHub = [
    "## What's Changed",
    '* Corrige el barrido by @Gomonsoft in https://github.com/Gomonsoft/shinobi-karaoke/pull/58',
    '',
    '## New Contributors',
    '* @nueva made their first contribution in https://github.com/Gomonsoft/shinobi-karaoke/pull/59',
    '',
    '**Full Changelog**: https://github.com/Gomonsoft/shinobi-karaoke/compare/v0.2.0-alpha.1...v0.2.0-alpha.2',
    ''
  ].join('\n')
  const soloEnlace =
    '**Full Changelog**: https://github.com/Gomonsoft/shinobi-karaoke/compare/v0.2.0-alpha.1...v0.2.0-alpha.2\n'
  const publicadas = JSON.stringify([
    { tagName: 'v0.2.0-alpha.1', publishedAt: '2026-11-01T10:00:00Z' },
    { tagName: 'v0.2.0-alpha.0', publishedAt: '2026-10-01T10:00:00Z' }
  ])

  function componer(releases: string, cuerpo: string): { codigo: number | null; notas: string } {
    const raiz = mkdtempSync(join(tmpdir(), 'componer-'))
    temporales.push(raiz)
    const carpeta = join(raiz, 'publicacion')
    const bin = join(raiz, 'bin')
    mkdirSync(carpeta)
    mkdirSync(bin)
    const publicacion = new URL('../../.github/publicacion/', import.meta.url)
    copyFileSync(new URL('que-cambio.json', publicacion), join(carpeta, 'que-cambio.json'))
    writeFileSync(join(carpeta, 'notas.md'), 'Notas escritas a mano.\n')
    writeFileSync(join(carpeta, 'pie.md'), '**Compilación:** `0.2.0-alpha.2-7`.\n')
    writeFileSync(join(raiz, 'releases.json'), releases)
    writeFileSync(join(raiz, 'cuerpo.md'), cuerpo)
    // Doble de `gh`: `release list` da las publicadas y `api` da lo que imprimiría `--jq .body`.
    const gh = join(bin, 'gh')
    writeFileSync(
      gh,
      '#!/usr/bin/env bash\ncase "$1" in\n  release) cat "$STUB_RELEASES" ;;\n  api) cat "$STUB_BODY" ;;\n  *) echo "gh: $*" >&2; exit 1 ;;\nesac\n'
    )
    chmodSync(gh, 0o755)
    const paso = flujo.jobs.publicar!.steps.find(({ name }) =>
      name?.startsWith('Componer las notas')
    )!
    const r = spawnSync('bash', ['-c', paso.run!], {
      cwd: carpeta,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}${delimiter}${process.env.PATH}`,
        ETIQUETA: 'v0.2.0-alpha.2',
        GH_REPO: 'Gomonsoft/shinobi-karaoke',
        STUB_RELEASES: join(raiz, 'releases.json'),
        STUB_BODY: join(raiz, 'cuerpo.md')
      }
    })
    if (r.status !== 0) throw new Error(`${r.stdout}\n${r.stderr}`)
    return { codigo: r.status, notas: readFileSync(join(carpeta, 'notas-final.md'), 'utf8') }
  }

  it('con anterior: encabezados en español, sin las líneas de GitHub y con el enlace de comparación', () => {
    const { notas } = componer(publicadas, cuerpoGitHub)
    expect(notas).toBe(
      [
        'Notas escritas a mano.',
        '',
        '---',
        '',
        '## Qué cambió',
        '',
        '* Corrige el barrido by @Gomonsoft in https://github.com/Gomonsoft/shinobi-karaoke/pull/58',
        '',
        '### Personas que colaboran por primera vez',
        '* @nueva made their first contribution in https://github.com/Gomonsoft/shinobi-karaoke/pull/59',
        '',
        '**Todos los cambios:** [v0.2.0-alpha.1…v0.2.0-alpha.2](https://github.com/Gomonsoft/shinobi-karaoke/compare/v0.2.0-alpha.1...v0.2.0-alpha.2)',
        '',
        '**Compilación:** `0.2.0-alpha.2-7`.',
        ''
      ].join('\n')
    )
  })

  it('sin PR en el intervalo usa la frase fija y conserva «Todos los cambios»', () => {
    const { notas } = componer(publicadas, soloEnlace)
    expect(notas).toContain(
      '## Qué cambió\n\nNo hay solicitudes de cambio (PR) en este intervalo: mira todos los cambios en la comparación.\n\n**Todos los cambios:**'
    )
    expect(notas).not.toContain('Full Changelog')
  })

  it('sin Release anterior pone la frase de la primera versión publicada', () => {
    const { notas } = componer('[]', cuerpoGitHub)
    expect(notas).toContain(
      '## Qué cambió\n\nEs la primera versión publicada de Shinobi Karaoke: no hay una anterior con la que comparar.\n\n**Compilación:**'
    )
    expect(notas).not.toContain('Todos los cambios')
    expect(notas).not.toContain('Corrige el barrido')
  })
})
