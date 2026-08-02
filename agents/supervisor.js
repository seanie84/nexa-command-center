const fs = require('fs')
const path = require('path')
const fetch = require('node-fetch')

const AGENTS_FILE = path.join(__dirname, 'agents.json')
let agents = []

function loadAgents(){
  try { agents = JSON.parse(fs.readFileSync(AGENTS_FILE)); } catch(e){ agents = [] }
}

async function checkHealth(agent){
  try{
    const base = process.env.ROOT_URL ? process.env.ROOT_URL : `http://localhost:${process.env.PORT||3000}`
    const url = agent.endpoint ? (base + agent.endpoint) : base
    const res = await fetch(url, { timeout: 5000 })
    if (res.ok) return {ok:true, status: res.status}
    return {ok:false, status: res.status}
  }catch(e){ return {ok:false, error: e.message} }
}

async function runAgent(agent){
  if(agent.type === 'monitor'){
    const result = await checkHealth(agent)
    console.log(`[agent:${agent.id}] result:`, result)
    if(!result.ok){
      console.log(`[agent:${agent.id}] detected problem, attempting repair (noop)`) 
    }
  }
  if(agent.type === 'orchestrator'){
    console.log('[orchestrator] checking agents...')
    for(const a of agents){
      if(a.id === 'supervisor') continue
      const r = await checkHealth(a)
      if(!r.ok){
        console.log(`[orchestrator] agent ${a.id} unhealthy`, r)
      }
    }
  }
}

function start(){
  loadAgents()
  agents.forEach(a => {
    setInterval(() => runAgent(a), (a.intervalSeconds || 60) * 1000)
  })
  console.log('Agent supervisor started, agents:', agents.map(a=>a.id))
}

module.exports = { start }
