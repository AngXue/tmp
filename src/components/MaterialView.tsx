import { Download, FileSpreadsheet, Printer, Scissors } from 'lucide-react'
import type { ScaffoldLayout } from '../domain/scaffold'

type MaterialViewProps = {
  layout: ScaffoldLayout
}

const connectorLabels = {
  rightAngle: '直角扣件',
  swivel: '旋转扣件',
  butt: '对接扣件',
}

export function MaterialView({ layout }: MaterialViewProps) {
  const { materials } = layout

  const exportCsv = () => {
    const rows = [
      ['类别', '规格', '数量', '单位'],
      ...Object.entries(materials.stockSummary).map(([length, quantity]) => ['钢管', length, quantity, '根']),
      ...Object.entries(materials.connectorSummary).map(([type, quantity]) => [
        '扣件', connectorLabels[type as keyof typeof connectorLabels], quantity, '个',
      ]),
    ]
    const csv = `\uFEFF${rows.map((row) => row.join(',')).join('\n')}`
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = '青岚别墅-材料清单.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="materials-view">
      <div className="material-kpis">
        <div><span>理论需求</span><strong>{materials.theoreticalLength.toFixed(1)}<small> m</small></strong></div>
        <div><span>采购总长</span><strong>{materials.purchasedLength.toFixed(1)}<small> m</small></strong></div>
        <div><span>预计余料</span><strong>{materials.wasteLength.toFixed(1)}<small> m</small></strong></div>
        <div className="accent-kpi"><span>综合利用率</span><strong>{materials.utilization}<small> %</small></strong></div>
      </div>

      <div className="material-columns">
        <section className="material-section">
          <div className="section-title"><div><span className="field-caption">PIPE INVENTORY</span><h2>标准钢管</h2></div><strong>{Object.values(materials.stockSummary).reduce((sum, count) => sum + count, 0)} 根</strong></div>
          <div className="stock-list">
            {Object.entries(materials.stockSummary).sort(([a], [b]) => Number.parseFloat(b) - Number.parseFloat(a)).map(([length, quantity]) => (
              <div className="stock-row" key={length}>
                <span className="pipe-swatch" style={{ width: `${Math.max(48, Number.parseFloat(length) * 18)}px` }} />
                <strong>{length}</strong><span>× {quantity}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="material-section">
          <div className="section-title"><div><span className="field-caption">CONNECTORS</span><h2>扣件</h2></div></div>
          <div className="connector-list">
            {Object.entries(materials.connectorSummary).map(([type, quantity]) => (
              <div key={type}><span className={`connector-icon ${type}`}><i /><i /></span><span>{connectorLabels[type as keyof typeof connectorLabels]}</span><strong>{quantity}</strong><small>个</small></div>
            ))}
          </div>
        </section>
      </div>

      <section className="cutting-section">
        <div className="section-title">
          <div><span className="field-caption">CUTTING PLAN</span><h2>下料方案</h2></div>
          <span className="cutting-note"><Scissors size={15} /> 优先适配最短可用标准管</span>
        </div>
        <div className="cut-plan-table">
          <div className="cut-table-head"><span>原材</span><span>切割组合</span><span>余料</span></div>
          {materials.cutPlans.slice(0, 8).map((plan, index) => (
            <div className="cut-table-row" key={`${plan.stockLength}-${index}`}>
              <strong>{plan.stockLength.toFixed(1)} m</strong>
              <div className="cut-bar">
                {plan.cuts.map((cut, cutIndex) => (
                  <i key={`${cut}-${cutIndex}`} style={{ flex: cut }}><span>{cut.toFixed(2)}</span></i>
                ))}
                {plan.remainder > 0.01 && <em style={{ flex: plan.remainder }} />}
              </div>
              <span>{plan.remainder.toFixed(2)} m</span>
            </div>
          ))}
        </div>
      </section>

      <div className="export-actions">
        <button className="secondary-button" type="button" onClick={() => window.print()}><Printer size={17} /> 打印 / PDF</button>
        <button className="primary-button export-button" type="button" onClick={exportCsv}><FileSpreadsheet size={18} /> 导出 Excel CSV <Download size={16} /></button>
      </div>
    </div>
  )
}