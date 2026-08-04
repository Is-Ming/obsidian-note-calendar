# Note Calendar - Obsidian日历插件

**[English Version](README-en.md) | [中文版本](README.md)**

[![GitHub release](https://img.shields.io/github/v/release/Is-Ming/obsidian-note-calendar)](https://github.com/Is-Ming/obsidian-note-calendar/releases)
[![Downloads](https://img.shields.io/github/downloads/Is-Ming/obsidian-note-calendar/total)](https://github.com/Is-Ming/obsidian-note-calendar/releases)
[![License](https://img.shields.io/github/license/Is-Ming/obsidian-note-calendar)](LICENSE)

本人是obsidian和前端的初学者，初次接触obsidian，对前端技术也比较生疏，所以这个插件的实现和功能上有一些不足，希望大家多多包涵，也欢迎一起参与讨论或对插件的改进提出批评和建议。

## TODO LIST 
以下功能待实现，后续版本迭代中逐步实现（非顺序），欢迎大家一起参与贡献。
- [ ] 多视图支持：月视图、周视图、年视图切换
- [ ] 创建笔记支持添加模板：
    - [ ] 支持obsidian模板
    - [ ] 支持templatar插件模板
- [ ] 待办任务关联日历
    - [ ] 支持task插件
- [ ] 支持国际化
- [ ] 布局优化
- [ ] 支持老黄历的显示
- [ ] 支持特定人群日历切换
    - [ ] 支持佛历的显示
    - [ ] 支持道历的显示
- [ ] 支持移动端


## 更新日志

### v1.2.0 — 月度笔记与季度自定义（2026-07-28）
- 新增月度笔记创建与配置
- 日历标题季度显示（数字/季节/自定义命名）
- 笔记列表增加农历日期显示

### v1.1.0 — 笔记配置与内联改造（2026-07-24）
- 各类笔记独立配置标题格式和默认路径
- lunar.js 内联到 main.js，插件完全自包含
- 导航按钮美化，标题居中布局优化

### v1.0.5 — 修复已知问题（2026-07-24）
- 固定日历头部，笔记列表独立滚动

### v1.0.4 — 新增功能（2026-07-15）
- 新增主题模式设置（跟随 Obsidian / 深色 / 浅色）

### v1.0.3 — 修复与优化（2026-07-08）
- 使用 Obsidian 原生 CSS 变量替换硬编码颜色
- 修正 lunar.js 路径拼接问题

## 介绍

一个 Obsidian 日历插件，支持公历、农历、节日、调休、节气的显示，自动将笔记创建/修改日期关联到日历，并支持一键创建日记、周记、月记、季记和年记。

## 功能特性

1. **日历视图**：月视图，淡紫色调，显示周数、公历、农历、节日、节气、调休班休标记。

2. **笔记关联**：自动扫描仓库笔记，按创建/修改日期标记到日历上（绿色=新增，蓝色=更新）。

3. **笔记创建**：支持日记、周记、月度笔记、季度笔记、年度笔记五种类型，标题格式和保存路径各自独立配置。

4. **季度自定义**：日历标题可显示当前季度，支持数字（1季度）、季节（春季）或自定义命名，首季起始月可调。

5. **颜色管理**：主题色和周末色支持自定义，一键重置为默认。

## 插件设置说明

### 外观
- **主题模式**：跟随Obsidian / 深色 / 浅色
- **一周起始日**：周日或周一
- **周末颜色 / 主题颜色**：可自定义，点击旁 ⟳ 按钮还原默认
- **字体 / 字号**：11种字体，字号 10-20px

### 显示
- 公历假日、调休、农历日期、农历假日、节气 — 各独立开关

### 季度显示设置
- **季度显示模式**：数字（1季度）/ 春夏秋冬（春季）/ 自定义命名
- **首季起始月份**：季节/自定义模式下设置第一个季度从哪月开始
- **自定义季度名称**：逗号分隔4个名称，不足自动补齐

### 五类笔记设置（日记 / 周记 / 月度 / 季度 / 年度）
- 每类独立配置**标题格式**（支持 YYYY / MM / DD / {week} / {quarter} 等变量）
- 每类独立配置**默认文件夹路径**

### 笔记扫描
- **扫描目录**：限定只扫描某目录下的笔记（留空=全库），与创建笔记的保存路径无关
- **手动扫描**：点击立即重新扫描

## 使用方法

### 基础操作
- 点击 `‹‹` `‹` `›` `››` 切换月/年
- 点击「今」回到今天
- 点击任意日期查看当天笔记列表

### 创建笔记
列表顶部按钮 `[+ 周 月 季 年]`，分别创建对应类型笔记，弹窗中可修改标题和保存路径。

### 笔记管理
- 新建、修改、重命名、删除笔记时自动刷新
- 点击笔记名称直接打开对应文件

## 安装指南

### 方式一：手动安装
1. **下载插件**：从[发布页面](https://github.com/Is-Ming/obsidian-note-calendar/releases)下载最新版本的插件压缩包note-calendar.zip。

2. **安装插件**：将插件压缩包note-calendar.zip解压,解压后的文件夹名称为note-calendar,将其放入Obsidian的插件目录中。

3. **启用插件**：在Obsidian中打开设置，找到插件列表，启用"Note Calendar"插件。

### 方式二：使用Obsidian社区插件市场安装

1. **打开Obsidian社区插件市场**：在Obsidian中打开设置，找到社区插件市场。

2. **搜索插件**：在插件市场中搜索"Note Calendar"插件。

3. **安装插件**：点击插件列表中的"安装"按钮，确认安装。

4. **启用插件**：在Obsidian中打开设置，找到插件列表，启用"Note Calendar"插件。


## 反馈
- **问题反馈**：如果在使用过程中遇到问题，请在[GitHub Issues](https://github.com/Is-Ming/obsidian-note-calendar/issues)中提交问题报告。

- **功能建议**：如果有任何功能建议或改进意见，请在[GitHub Issues](https://github.com/Is-Ming/obsidian-note-calendar/issues)中提交建议。


## 依赖组件
### 1.lunar 组件
lunar是一款无第三方依赖的公历(阳历)、农历(阴历、老黄历)、佛历和道历工具
github地址：https://github.com/6tail/lunar-javascript
文档地址：https://6tail.cn/calendar/api.html