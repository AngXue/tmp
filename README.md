# 架算 Scaffold Field

平板优先的脚手架现场测量与材料估算 MVP。应用围绕统一的 `ScaffoldLayout` 构建，打通：

> 二维路径输入 → 参数化构件计算 → 三维人工检查 → 钢管下料与 BOM

## 已实现

- SVG 二维路径编辑器：节点拖动、路径段新增、真实长度独立录入
- 参数化计算：立杆、纵向水平杆、横向杆、剪刀撑、连墙件
- 转角共享立杆去重
- Three.js 轻量三维视图：旋转、缩放、平移、视角切换、构件选择、图层过滤
- 钢管标准长度组合与下料余料估算
- 直角、旋转、对接扣件统计
- 本地项目保存与 JSON 导出
- 材料 CSV 导出及浏览器打印/PDF
- 桌面、平板和移动端响应式布局

## 开发

```bash
npm install
npm run dev
```

打开 `http://localhost:5173`。

## 验证

```bash
npm test
npm run lint
npm run build
```

## 架构

核心领域模型位于 `src/domain/scaffold.ts`。二维编辑器、三维渲染器和材料视图都消费同一份计算结果，不各自维护构件数据。

```text
ScaffoldPath + Parameters
          ↓
   calculateScaffold
          ↓
    ScaffoldLayout
       ↙       ↘
3D Viewer    Material/BOM
```

## 当前边界

这是规则可配置方向的产品原型，目前构件布置和下料采用通用启发式算法，尚未固化特定地区、脚手架类型或工程规范。结果用于现场测量和材料估算，不替代结构安全验算、正式施工设计或施工图。
