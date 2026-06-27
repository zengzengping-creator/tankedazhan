# 🚀 坦克大战 Tank Battle

一个用纯 HTML5 + Canvas + 原生 JavaScript 实现的经典 FC 风格坦克大战游戏，无任何依赖，开箱即玩。

![game](https://img.shields.io/badge/HTML5-Canvas-orange) ![license](https://img.shields.io/badge/license-MIT-blue)

## 🎮 玩法

- 控制黄色坦克，消灭所有红色敌方坦克即可过关
- 保护好屏幕底部的基地 🦅，基地被摧毁即游戏失败
- 共 **3 个关卡**，难度递增，通关即胜利
- 拥有 3 条命，敌人子弹击中会损失一条命

## ⌨️ 操作

| 按键 | 功能 |
| ---- | ---- |
| ⬆️ ⬇️ ⬅️ ➡️ | 移动坦克 |
| 空格 (Space) | 开火 |
| P | 暂停 / 继续 |

## 🧱 地形

- **砖墙**（棕色）：可被子弹击穿
- **钢墙**（灰色）：子弹无法摧毁，可阻挡
- **基地** 🦅：必须保护，被击中即失败

## ▶️ 运行方式

直接在浏览器中打开 `index.html` 即可，无需安装任何依赖或服务器。

```bash
# 或者用任意静态服务器
npx serve .
```

## 📁 项目结构

```
tank-battle/
├── index.html   # 页面结构与 HUD
├── style.css    # 样式
├── game.js      # 游戏核心逻辑（地图/坦克/子弹/AI/关卡）
└── README.md
```

## 📜 许可证

MIT License
