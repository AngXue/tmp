import { Download, FileSpreadsheet, Printer, Scissors } from 'lucide-react'
import type { ScaffoldLayout } from '../domain/scaffold'

type MaterialViewProps = {
  layout: ScaffoldLayout
}

const connectorLabels = {
  cross: '十字扣',
  universal: '万向扣',
  inline: '一字扣',
}

export function MaterialView({ layout }: MaterialViewProps) {
  const { materials } = layout

  const exportCsv = () => {
    const rows = [
      ['类别', '规格', '数量', '单位'],
      ...Object.entries(materials.stockSummary).map(([length, quantity]) => ['钢管', length, quantity, '根']),
      ...Object.entries(materials.connectorSummary).map(([type, quantity]) => [
        '扣件', connectorLabels[type as keyof typeof connectorLabels], quantity ?? '--', '个',
      ]),
      ['待定材料', '剪刀撑', materials.pendingMaterialSummary.brace ?? '--', '根'],
      ['铺设材料', '钢笆片', materials.deckCount, '片'],
      ['铺设材料', '钢笆覆盖面积', materials.deckArea, 'm²'],
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
        <div><span>搭接及富余</span><strong>{materials.wasteLength.toFixed(1)}<small> m</small></strong></div>
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
          <div className="section-title"><div><span className="field-caption">CONNECTORS & DECK</span><h2>扣件与钢笆</h2></div></div>
          <div className="connector-list">
            {Object.entries(materials.connectorSummary).map(([type, quantity]) => (
              <div key={type}><span className={`connector-icon ${type}`}><i /><i /></span><span>{connectorLabels[type as keyof typeof connectorLabels]}</span><strong>{quantity ?? '--'}</strong><small>个</small></div>
            ))}
            <div><span className="pending-material-icon">?</span><span>剪刀撑</span><strong>{materials.pendingMaterialSummary.brace ?? '--'}</strong><small>根</small></div>
            <div>
              <span className="deck-material-icon" />
              <span>钢笆片 <small>{materials.deckArea.toFixed(1)} m²</small></span>
              <strong>{materials.deckCount}</strong>
              <small>片</small>
            </div>
          </div>
        </section>
      </div>

      <section className="cutting-section">
        <div className="section-title">
          <div><span className="field-caption">PIPE ASSEMBLY</span><h2>标准管组管方案</h2></div>
          <span className="cutting-note"><Scissors size={15} /> 少接头优先 · 搭接计入用量</span>
        </div>
        <div className="cut-plan-table">
          <div className="cut-table-head"><span>构件</span><span>标准管组合</span><span>额外外伸</span></div>
          {materials.assemblyPlans.slice(0, 8).map((plan) => (
            <div className="cut-table-row" key={plan.memberId}>
              <strong>{plan.memberId}</strong>
              <div className="cut-bar">
                {plan.stockLengths.map((stockLength, segmentIndex) => (
                  <i key={`${stockLength}-${segmentIndex}`} style={{ flex: stockLength }}><span>{stockLength.toFixed(1)}m</span></i>
                ))}
              </div>
              <span>{plan.excessLength.toFixed(2)} m</span>
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