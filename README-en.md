# Note Calendar - Obsidian Calendar Plugin

**[English Version](README-en.md) | [中文版本](README.md)**

[![GitHub release](https://img.shields.io/github/v/release/Is-Ming/obsidian-note-calendar)](https://github.com/Is-Ming/obsidian-note-calendar/releases)
[![Downloads](https://img.shields.io/github/downloads/Is-Ming/obsidian-note-calendar/total)](https://github.com/Is-Ming/obsidian-note-calendar/releases)
[![License](https://img.shields.io/github/license/Is-Ming/obsidian-note-calendar)](LICENSE)

I'm a beginner with both Obsidian and front-end development, and this is my first time working with Obsidian. My front-end skills are still rough, so the plugin's implementation and features may have shortcomings. I hope you'll bear with me, and you're welcome to join the discussion or offer criticism and suggestions for improving the plugin.

## TODO LIST
The following features are planned for future iterations (in no particular order). Contributions are welcome!
- [ ] Multi-view support: switch between month, week, and year views
- [ ] Template support when creating notes:
    - [ ] Support Obsidian templates
    - [ ] Support Templater plugin templates
- [ ] Task calendar integration
    - [ ] Support Tasks plugin
- [ ] Internationalization (i18n)
- [ ] Layout optimization
- [ ] Calendar pop-out window: 
    - open the calendar as an independent floating window to check daily tasks/files, with one click back to the main window
- [ ] Traditional Chinese almanac (老黄历) display
- [ ] Calendar switching for specific audiences
    - [ ] Buddhist calendar display
    - [ ] Taoist calendar display
- [ ] Mobile support

## Changelog

### v1.3.1 — Internal Refactoring (2026-08-07)
- Pure internal refactoring, no functional changes
### v1.3.0 — Folder Filtering in Note Creation Dialog (2026-08-05)
- Folder path input in the note creation dialog now supports type-to-filter
- Added 📁 folder picker with lazy-loaded tree and auto-scroll

### v1.2.0 — Monthly Notes & Quarterly Display (2026-07-28)
- Added monthly note creation and configuration
- Quarterly display in calendar header (numeric/season/custom)
- Lunar date shown in notes list

### v1.1.0 — Note Config & Inline Lunar (2026-07-24)
- Independent title format and folder path per note type
- lunar.js inlined into main.js, fully self-contained
- Nav button restyling, centered title layout

### v1.0.5 — Bug Fixes (2026-07-24)
- Fixed calendar header, notes list scrolling independently

### v1.0.4 — New Features (2026-07-15)
- Added theme mode setting (Follow Obsidian / Dark / Light)

### v1.0.3 — Fixes & Improvements (2026-07-08)
- Replaced hardcoded colors with Obsidian native CSS variables
- Fixed lunar.js path resolution

## Introduction

An Obsidian calendar plugin that displays Gregorian dates, lunar calendar, holidays, work-day adjustments, and solar terms. It automatically associates notes with dates and supports quick creation of daily, weekly, monthly, quarterly, and yearly notes.

## Features

1. **Calendar View** — Monthly view with week numbers, Gregorian + lunar + festivals + work adjustments + solar terms.

2. **Note Association** — Automatically scans vault notes and marks them on the calendar by creation/modification date (green = new, blue = updated).

3. **Note Creation** — Supports five note types: daily, weekly, monthly, quarterly, yearly. Each type has its own configurable title format and folder path. The dialog's folder path field supports filtering and a 📁 tree picker.

4. **Quarterly Display** — Shows the current quarter in the calendar header. Supports numeric (Q1), seasonal (Spring), or custom naming with adjustable start month.

5. **Color Reset** — Theme color and weekend color are customizable and can be reset to defaults with one click.

## Plugin Settings

### Appearance
- **Theme Mode**: Follow Obsidian / Dark / Light
- **Week Start Day**: Sunday or Monday
- **Weekend Color / Theme Color**: Customizable, click ⟳ to reset
- **Font / Font Size**: 11 font options, size 10-20px

### Display
- Solar holidays, work adjustments, lunar dates, lunar holidays, solar terms — each with an independent toggle

### Quarterly Display
- **Quarter Mode**: Numeric (Q1) / Seasonal (Spring) / Custom naming
- **Start Month**: Set which month the first quarter begins (seasonal/custom mode only)
- **Custom Quarter Names**: Comma-separated 4 names, auto-padded if incomplete

### Note Type Settings (Daily / Weekly / Monthly / Quarterly / Yearly)
- Each type has its own **title format** (supports YYYY / MM / DD / {week} / {quarter}, etc.)
- Each type has its own **default folder path**, with a 📁 button next to it to pick a folder in a dialog and auto-fill

### Note Scanning
- **Scan Directory**: Limit scanning to a subdirectory (leave blank for whole vault). Independent from note creation paths. Supports 📁 folder picker.
- **Scan Now**: Manually trigger a re-scan.

## Usage

### Basic Operations
- Use `‹‹` `‹` `›` `››` to navigate between months/years
- Click **Today** to jump back to current date
- Click any date to view its notes

### Create Notes
Buttons on the note list header: `[+ 周 月 季 年]` — click to create daily, weekly, monthly, quarterly, or yearly notes. Title and path are editable in the dialog; the folder path field supports type-to-filter and a 📁 tree picker.

### Note Management
- Auto-refresh on file create/modify/rename/delete
- Click a note title to open the corresponding file

## Installation Guide

### Method 1: Manual Installation
1. **Download Plugin**：Download the latest version of the plugin zip file note-calendar.zip from the [releases page](https://github.com/Is-Ming/obsidian-note-calendar/releases).

2. **Install Plugin**：Unzip the plugin zip file note-calendar.zip, the unzipped folder name is note-calendar, put it into Obsidian's plugin directory.

3. **Enable Plugin**：Open settings in Obsidian, find the plugin list, and enable the "Note Calendar" plugin.

### Method 2: Install using Obsidian Community Plugin Market (under review, not yet available)

1. **Open Obsidian Community Plugin Market**：Open settings in Obsidian, find the Community Plugin Market.

2. **Search Plugin**：Search for "Note Calendar" plugin in the plugin market.

3. **Install Plugin**：Click the "Install" button in the plugin list to confirm installation.

4. **Enable Plugin**：Open settings in Obsidian, find the plugin list, and enable the "Note Calendar" plugin.

## Feedback
- **Issue Feedback**：If you encounter any problems during use, please submit an issue report in [GitHub Issues](https://github.com/Is-Ming/obsidian-note-calendar/issues).

- **Feature Suggestions**：If you have any feature suggestions or improvement ideas, please submit suggestions in [GitHub Issues](https://github.com/Is-Ming/obsidian-note-calendar/issues).

## Dependencies
### 1. lunar Component
lunar is a tool for Gregorian calendar (solar calendar), lunar calendar (lunar calendar, traditional Chinese calendar), Buddhist calendar and Taoist calendar without third-party dependencies.
GitHub URL: https://github.com/6tail/lunar-javascript
Documentation URL: https://6tail.cn/calendar/api.html