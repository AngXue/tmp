import { lazy, Suspense, useState } from 'react'
import {
  Box,
  ChevronRight,
  ClipboardCheck,
  Download,
  Layers3,
  Map,
  Menu,
  Save,
  Settings2,
  TriangleAlert,
} from 'lucide-react'
import './App.css'
import { MaterialView } from './components/MaterialView'
import { PlanEditor } from './components/PlanEditor'
import {
  calculateScaffold,
  countMembers,
  DEFAULT_PARAMETERS,
  type MemberType,
  type Point2D,
  type ScaffoldParameters,
} from './domain/scaffold'

type WorkspaceTab = 'plan' | 'model' | 'materials'

const ScaffoldViewer = lazy(() => import('./components/ScaffoldViewer').then((module) => ({
  default: module.ScaffoldViewer,
})))

const INITIAL_POINTS: Point2D[] = [
  { id: 'P1', x: 110, y: 125 },
  { id: 'P2', x: 520, y: 125 },
  { id: 'P3', x: 520, y: 380 },
]

const TAB_META = {
  plan: { label: '二维测量', icon: Map },
  model: { label: '三维检查', icon: Box },
  materials: { label: '材料结果', icon: ClipboardCheck },
} as const

function loadStoredProject() {
  try {
    const stored = localStorage.getItem('scaffold-project')
    if (!stored) return null
    return JSON.parse(stored) as {
      points: Point2D[]
      lengths: number[]
      parameters: ScaffoldParameters
    }
  } catch {
    return null
  }
}

function NumberField({ label, value, unit = 'm', step = 0.1, onChange }: {
  label: string
  value: number
  unit?: string
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <label className="parameter-field">
      <span>{label}</span>
      <span className="number-input">
        <input
          type="number"
          min="0.1"
          step={step}
          value={value}
          onChange={(event) => onChange(Math.max(0.1, Number(event.target.value)))}
        />
        <b>{unit}</b>
      </span>
    </label>
  )
}

function App() {
  const [initialProject] = useState(loadStoredProject)
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('plan')
  const [points, setPoints] = useState<Point2D[]>(initialProject?.points ?? INITIAL_POINTS)
  const [lengths, setLengths] = useState(initialProject?.lengths ?? [7.2, 4.8])
  const [parameters, setParameters] = useState<ScaffoldParameters>(initialProject?.parameters ?? DEFAULT_PARAMETERS)
  const [filter, setFilter] = useState<MemberType | 'all'>('all')
  const [saved, setSaved] = useState(false)

  const layout = calculateScaffold(points, lengths, parameters)
  const counts = countMembers(layout)

  const updateParameter = (key: keyof ScaffoldParameters, value: number) => {
    setParameters({ ...parameters, [key]: value })
    setSaved(false)
  }

  const saveProject = () => {
    localStorage.setItem('scaffold-project', JSON.stringify({ points, lengths, parameters }))
    setSaved(true)
  }

  const exportProject = () => {
    const project = { version: '0.3', points, lengths, parameters, layout }
    const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = '青岚别墅-脚手架项目.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <button className="icon-button mobile-menu" type="button" title="打开菜单"><Menu size={20} /></button>
          <div className="brand-mark"><Layers3 size={24} strokeWidth={1.8} /></div>
          <div><strong>架算</strong><span>SCAFFOLD FIELD</span></div>
        </div>
        <div className="project-title"><span>当前项目</span><strong>青岚别墅 · 东南立面</strong></div>
        <div className="topbar-actions">
          <span className={saved ? 'save-state saved' : 'save-state'}>{saved ? '已保存到本机' : '有未保存更改'}</span>
          <button className="secondary-button" type="button" onClick={saveProject}><Save size={17} /> 保存</button>
          <button className="icon-button" type="button" onClick={exportProject} title="导出项目数据"><Download size={19} /></button>
        </div>
      </header>

      <nav className="workflow-tabs" aria-label="项目流程">
        {(Object.entries(TAB_META) as Array<[WorkspaceTab, typeof TAB_META[WorkspaceTab]]>).map(([key, tab], index) => {
          const Icon = tab.icon
          return (
            <div className="workflow-step-wrap" key={key}>
              <button className={activeTab === key ? 'workflow-step active' : 'workflow-step'} type="button" onClick={() => setActiveTab(key)}>
                <span>{index + 1}</span><Icon size={18} /> {tab.label}
              </button>
              {index < 2 && <ChevronRight className="workflow-arrow" size={17} />}
            </div>
          )
        })}
      </nav>

      <main className="workspace">
        <section className="work-surface">
          <div className="surface-heading">
            <div>
              <span className="eyebrow">{activeTab === 'plan' ? 'PATH INPUT' : activeTab === 'model' ? 'LAYOUT REVIEW' : 'MATERIAL OUTPUT'}</span>
              <h1>{TAB_META[activeTab].label}</h1>
              <p>{activeTab === 'plan' ? '绘制实际搭设路径，并为每段录入现场测量值。' : activeTab === 'model' ? '旋转并点击构件，核查计算生成的空间关系。' : '查看钢管下料、利用率与扣件需求。'}</p>
            </div>
            <span className="calculation-badge"><i /> 计算结果已同步</span>
          </div>

          {activeTab === 'plan' && (
            <PlanEditor
              points={points}
              lengths={lengths}
              onPointsChange={(next) => { setPoints(next); setSaved(false) }}
              onLengthsChange={(next) => { setLengths(next); setSaved(false) }}
            />
          )}
          {activeTab === 'model' && (
            <Suspense fallback={<div className="viewer-loading">正在加载三维引擎…</div>}>
              <ScaffoldViewer layout={layout} filter={filter} onFilterChange={setFilter} />
            </Suspense>
          )}
          {activeTab === 'materials' && <MaterialView layout={layout} />}
        </section>

        <aside className="inspector">
          <div className="inspector-heading"><Settings2 size={18} /><strong>脚手架参数</strong><span>住宅模板</span></div>
          <div className="parameter-section">
            <h2>几何参数</h2>
            <div className="parameter-grid">
              <NumberField label="搭设高度" value={parameters.height} onChange={(value) => updateParameter('height', value)} />
              <NumberField label="脚手架宽度" value={parameters.width} onChange={(value) => updateParameter('width', value)} />
              <NumberField label="立杆纵距" value={parameters.postSpacing} onChange={(value) => updateParameter('postSpacing', value)} />
              <NumberField label="步距" value={parameters.liftHeight} onChange={(value) => updateParameter('liftHeight', value)} />
            </div>
          </div>
          <div className="parameter-section rule-section">
            <h2>规则配置</h2>
            <label className="range-row">
              <span>剪刀撑跨数 <b>{parameters.braceBayCount}</b></span>
              <input type="range" min="2" max="6" value={parameters.braceBayCount} onChange={(event) => updateParameter('braceBayCount', Number(event.target.value))} />
            </label>
            <label className="range-row">
              <span>连墙件水平跨 <b>{parameters.wallTieHorizontalBays}</b></span>
              <input type="range" min="2" max="6" value={parameters.wallTieHorizontalBays} onChange={(event) => updateParameter('wallTieHorizontalBays', Number(event.target.value))} />
            </label>
          </div>

          <div className="live-summary">
            <div className="summary-title"><span>实时估算</span><small>{layout.members.length} 个构件</small></div>
            <div className="summary-grid">
              <div><span>立杆</span><strong>{counts.post}</strong></div>
              <div><span>水平杆</span><strong>{counts.longitudinal}</strong></div>
              <div><span>横向杆</span><strong>{counts.transverse}</strong></div>
              <div><span>剪刀撑</span><strong>{counts.brace}</strong></div>
            </div>
            <div className="utilization-row"><span>钢管利用率</span><strong>{layout.materials.utilization}%</strong></div>
            <div className="utilization-track"><i style={{ width: `${layout.materials.utilization}%` }} /></div>
          </div>

          {layout.warnings.length > 0 && (
            <div className="warning-box"><TriangleAlert size={18} /><span>{layout.warnings[0].message}</span></div>
          )}

          <button className="primary-button" type="button" onClick={() => setActiveTab('model')}>
            <Box size={19} /> 计算并生成 3D <ChevronRight size={18} />
          </button>
          <p className="scope-note">结果用于现场材料估算，不替代结构安全验算。</p>
        </aside>
      </main>
    </div>
  )
}

export default App
