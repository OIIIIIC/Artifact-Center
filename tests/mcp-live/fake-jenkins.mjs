import { createServer } from 'node:http'
const files = Buffer.from('MCP isolated build artifact bytes\n')
const runs = new Map()
let next = 0
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://mcp-jenkins:8080')
  const json = (value, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'X-Jenkins': '2.580.1' })
    res.end(JSON.stringify(value))
  }
  if (
    req.headers.authorization !==
    `Basic ${Buffer.from('builder:e2e-only-token').toString('base64')}`
  )
    return json({}, 403)
  if (url.pathname === '/api/json')
    return json({ mode: 'NORMAL', nodeDescription: 'SIMULATED MCP E2E' })
  if (url.pathname === '/job/mcp-test/api/json')
    return json({
      _class: 'org.jenkinsci.plugins.workflow.job.WorkflowJob',
      fullName: 'mcp-test',
      buildable: true,
      property: [
        {
          parameterDefinitions: [
            { name: 'MODE', type: 'StringParameterDefinition' },
            { name: 'ARTIFACT_CENTER_REQUEST_ID', type: 'StringParameterDefinition' },
          ],
        },
      ],
      builds: [...runs.values()].map((r) => ({
        number: r.number,
        queueId: r.number,
        actions: [
          { parameters: [{ name: 'ARTIFACT_CENTER_REQUEST_ID', value: r.request }] },
        ],
      })),
    })
  if (url.pathname === '/job/mcp-test/buildWithParameters' && req.method === 'POST') {
    let body = ''
    for await (const chunk of req) body += chunk
    const values = new URLSearchParams(body),
      number = ++next
    runs.set(number, {
      number,
      request: values.get('ARTIFACT_CENTER_REQUEST_ID'),
      mode: values.get('MODE'),
      cancelled: false,
    })
    res
      .writeHead(201, { Location: `http://mcp-jenkins:8080/queue/item/${number}/` })
      .end()
    return
  }
  if (url.pathname === '/queue/api/json')
    return json({
      items: [...runs.values()].map((r) => ({
        id: r.number,
        task: { fullName: 'mcp-test' },
        actions: [
          { parameters: [{ name: 'ARTIFACT_CENTER_REQUEST_ID', value: r.request }] },
        ],
      })),
    })
  if (url.pathname === '/queue/cancelItem') {
    const run = runs.get(Number(url.searchParams.get('id')))
    if (run) run.cancelled = true
    res.writeHead(302, { Location: '/' }).end()
    return
  }
  const queued = url.pathname.match(/^\/queue\/item\/(\d+)\/api\/json$/)
  if (queued) {
    const run = runs.get(Number(queued[1]))
    return json({
      id: run.number,
      cancelled: run.cancelled,
      why: run.mode === 'wait' ? 'Test wait state' : null,
      ...(run.mode === 'wait' ? {} : { executable: { number: run.number } }),
    })
  }
  const build = url.pathname.match(/^\/job\/mcp-test\/(\d+)\/(.*)$/)
  if (build) {
    const run = runs.get(Number(build[1]))
    if (!run) return json({}, 404)
    if (build[2] === 'api/json')
      return json({
        number: run.number,
        queueId: run.number,
        building: false,
        result: run.cancelled ? 'ABORTED' : 'SUCCESS',
        timestamp: Date.now() - 1000,
        duration: 1000,
        artifacts: [{ fileName: 'mcp.zip', relativePath: 'artifacts/mcp.zip' }],
        actions: [{ lastBuiltRevision: { SHA1: 'a'.repeat(40) } }],
      })
    if (build[2] === 'stop') {
      run.cancelled = true
      res.writeHead(302, { Location: '/' }).end()
      return
    }
    if (build[2] === 'logText/progressiveText') {
      const text = Buffer.from('SIMULATED Jenkins MCP build\nSUCCESS\n')
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'X-Text-Size': String(text.length),
        'X-More-Data': 'false',
      })
      res.end(text.subarray(Number(url.searchParams.get('start') || 0)))
      return
    }
    if (build[2] === 'artifact/artifacts/mcp.zip') {
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(files.length),
      })
      res.end(files)
      return
    }
  }
  json({}, 404)
}).listen(8080, '0.0.0.0')
